/**
 * Arista CV-CUE (CloudVision Cognitive Unified Edge) data-source plugin.
 *
 * CV-CUE can't push telemetry out, so metrics come from polling its Open API
 * (`/wifi/api`). Modeled on the Aruba Instant On plugin: one inventory fetch
 * feeds several capabilities.
 *
 * Plugin scope (v1):
 *   - hosts: managed APs + LLDP-discovered uplink switches
 *   - metrics: per-node up/down from device `active`, last-seen
 *   - alerts: CV-CUE events mapped to our Alert shape
 *   - nativeApi: dev-only raw passthrough
 *
 * Topology (AP↔switch edges via `uplinkWiredInterfacesInfo`) and live link
 * throughput are a deliberate phase-2 follow-up.
 */

import type {
  Alert,
  AlertQueryOptions,
  AlertSeverity,
  AlertsCapable,
  ConnectionResult,
  DataSourceCapability,
  DataSourcePlugin,
  DiscoveredMetric,
  Host,
  HostItem,
  HostsCapable,
  LinkMetrics,
  MetricsCapable,
  MetricsData,
  MetricsMapping,
  NetworkGraph,
  NodeMetrics,
  TopologyCapable,
} from '@shumoku/core'
import { buildIdentity, flattenObject, severityAtLeast } from '@shumoku/core'
import { AristaCvCueApi } from './api.js'
import { buildTopology, primaryUplink } from './topology.js'
import type {
  AristaCvCueConfig,
  CvEvent,
  CvEventsResponse,
  CvLocation,
  CvManagedDevice,
  CvManagedDevicesResponse,
  CvSwitch,
} from './types.js'

/** How many recent events to scan when surfacing alerts. */
const ALERT_EVENT_LIMIT = 300

export class AristaCvCuePlugin
  implements DataSourcePlugin, HostsCapable, MetricsCapable, AlertsCapable, TopologyCapable
{
  readonly type = 'arista-cv-cue'
  readonly displayName = 'Arista CV-CUE'
  readonly capabilities: readonly DataSourceCapability[] = [
    'topology',
    'hosts',
    'metrics',
    'alerts',
  ]

  private api: AristaCvCueApi | null = null
  private config: AristaCvCueConfig | null = null
  private apsCache: { value: CvManagedDevice[]; expiresAt: number } | null = null
  private apsInFlight: Promise<CvManagedDevice[]> | null = null

  initialize(config: unknown): void {
    const c = config as Partial<AristaCvCueConfig>
    if (!c.baseUrl || !c.keyId || !c.keyValue) {
      throw new Error('Arista CV-CUE plugin requires `baseUrl`, `keyId`, and `keyValue` in config')
    }
    this.config = c as AristaCvCueConfig
    this.api = new AristaCvCueApi(this.config)
    this.apsCache = null
    this.apsInFlight = null
  }

  dispose(): void {
    this.config = null
    this.api = null
    this.apsCache = null
    this.apsInFlight = null
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.api) return { success: false, message: 'Plugin not initialized' }
    try {
      const page = await this.api.get<CvManagedDevicesResponse>('/manageddevices/aps', {
        pagesize: 1,
      })
      const total = page.totalCount ?? page.managedDevices?.length ?? 0
      return {
        success: true,
        message: `Connected to Arista CV-CUE (${total} managed AP${total === 1 ? '' : 's'})`,
      }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  // ============================================================
  // TopologyCapable — AP↔switch wired topology
  // ============================================================

  /**
   * Emit the wireless-edge topology CV-CUE knows that a wired-inventory source
   * doesn't: managed APs, their LLDP uplink switches, and the AP↔switch links.
   * Composition merges the shared switch onto the wired source's node by
   * identity (chassisId / sysName).
   */
  async fetchTopology(): Promise<NetworkGraph> {
    if (!this.api) return { version: '1.0.0', name: 'Arista CV-CUE', nodes: [], links: [] }
    const [aps, switches, locations] = await Promise.all([
      this.fetchAps(),
      this.fetchSwitches(),
      this.fetchLocations(),
    ])
    return buildTopology(aps, switches, locations)
  }

  // ============================================================
  // HostsCapable — APs + uplink switches
  // ============================================================

  async getHosts(): Promise<Host[]> {
    if (!this.api) return []
    const [aps, switches] = await Promise.all([this.fetchAps(), this.fetchSwitches()])
    const out: Host[] = []
    for (const d of aps) {
      const host = apToHost(d)
      if (host) out.push(host)
    }
    for (const s of switches) {
      const host = switchToHost(s)
      if (host) out.push(host)
    }
    return out
  }

  /**
   * Dump every primitive field of the AP's inventory record for the node-detail
   * "All metrics" panel. Passthrough by design — new CV-CUE fields surface
   * automatically and an empty list genuinely means "no record for this id".
   */
  async discoverMetrics(hostId: string): Promise<DiscoveredMetric[]> {
    if (!this.api) return []
    const aps = await this.fetchAps()
    const ap = aps.find((d) => apId(d) === hostId)
    if (ap) return flattenObject(ap, 'cvcue')
    const sw = (await this.fetchSwitches()).find((s) => s.chassisId === hostId)
    return sw ? flattenObject(sw, 'cvcue') : []
  }

  /**
   * Per-host interface items for the link-mapping UI. An AP has exactly one
   * mappable link — its wired uplink to the switch — so we expose that port as
   * an in/out pair (mirroring the net.if.in/out convention other plugins use).
   * The interface name matches the port `fetchTopology` puts on the link, so
   * auto-map binds the AP↔switch link to this item.
   */
  async getHostItems(hostId: string): Promise<HostItem[]> {
    if (!this.api) return []
    const ap = (await this.fetchAps()).find((d) => apId(d) === hostId)
    if (!ap) return []
    const uplink = primaryUplink(ap)
    if (!uplink) return []
    const ifaceName = uplink.name || 'uplink'
    return (['in', 'out'] as const).map((direction) => ({
      id: `${hostId}:uplink:${direction}`,
      hostId,
      name: `${ifaceName} ${direction === 'in' ? 'received' : 'sent'}`,
      key: `cvcue.uplink.${direction}`,
      interfaceName: ifaceName,
      direction,
    }))
  }

  // ============================================================
  // MetricsCapable — per-node status + AP↔switch link status
  // ============================================================

  async pollMetrics(mapping: MetricsMapping): Promise<MetricsData> {
    const metrics: MetricsData = { nodes: {}, links: {}, timestamp: Date.now() }
    const hasMappedHost = Object.values(mapping.nodes ?? {}).some((n) => n.hostId)
    const hasMappedLink = Object.values(mapping.links ?? {}).some(
      (l) => l.monitoredNodeId && l.interface,
    )
    if ((!hasMappedHost && !hasMappedLink) || !this.api) return metrics

    const [aps, switches] = await Promise.all([this.fetchAps(), this.fetchSwitches()])
    const apById = new Map<string, CvManagedDevice>()
    for (const d of aps) {
      const id = apId(d)
      if (id) apById.set(id, d)
      if (d.macaddress) apById.set(d.macaddress, d)
    }
    const swById = new Map<string, CvSwitch>()
    for (const s of switches) if (s.chassisId) swById.set(s.chassisId, s)

    // ---- Nodes ----
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      const hostId = nodeMapping.hostId
      if (!hostId) continue
      const ap = apById.get(hostId)
      if (ap) {
        metrics.nodes[nodeId] = apToMetrics(ap)
        continue
      }
      const sw = swById.get(hostId)
      // Stay silent on ids that aren't ours — another source may own the node,
      // and emitting a fake status here would clobber the real one on merge.
      if (sw) metrics.nodes[nodeId] = switchToMetrics(sw)
    }

    // ---- Links ----
    // A link's metrics come from the AP its `monitoredNodeId` maps to — the AP
    // owns the wired-uplink status and the aggregate radio-usage telemetry used
    // as its approximate throughput.
    for (const [linkId, linkMapping] of Object.entries(mapping.links || {})) {
      const monitoredNodeId = linkMapping.monitoredNodeId
      if (!monitoredNodeId || !linkMapping.interface) continue
      const hostId = mapping.nodes[monitoredNodeId]?.hostId
      if (!hostId) continue
      const ap = apById.get(hostId)
      if (!ap) continue // not ours — let another source answer
      metrics.links[linkId] = uplinkToLinkMetrics(ap)
    }
    return metrics
  }

  // ============================================================
  // AlertsCapable — CV-CUE events
  // ============================================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    if (!this.api) return []
    const events = await this.api.getPaged<CvEvent, CvEventsResponse>(
      '/events',
      (p) => p.eventList ?? [],
      undefined,
      { pageSize: 100, maxItems: ALERT_EVENT_LIMIT },
    )
    // CV-CUE's `deleted` flag is set on ~every event (a retention marker, not a
    // "hide me" signal), so it isn't a filter. Active vs resolved comes from
    // `activityStatus`; option filtering matches the other plugins.
    const cutoff = Date.now() - (options?.timeRange ?? 3600) * 1000
    const out: Alert[] = []
    for (const e of events) {
      const alert = eventToAlert(e)
      if (options?.activeOnly && alert.status !== 'active') continue
      if (options?.minSeverity && !severityAtLeast(alert.severity, options.minSeverity)) continue
      // Keep active alerts regardless of age; window-filter the historical ones.
      if (alert.status !== 'active' && alert.startTime < cutoff) continue
      out.push(alert)
    }
    return out
  }

  // ============================================================
  // Internals
  // ============================================================

  private async fetchAps(): Promise<CvManagedDevice[]> {
    if (!this.api) return []
    const now = Date.now()
    if (this.apsCache && this.apsCache.expiresAt > now) return this.apsCache.value
    if (this.apsInFlight) return this.apsInFlight

    const request = this.api.getPaged<CvManagedDevice, CvManagedDevicesResponse>(
      '/manageddevices/aps',
      (page) => page.managedDevices ?? [],
    )
    this.apsInFlight = request
    try {
      const value = await request
      // Link auto-map asks once per mapped host. Reuse the same inventory snapshot
      // across that burst instead of downloading the complete AP list per host.
      this.apsCache = { value, expiresAt: Date.now() + 10_000 }
      return value
    } finally {
      if (this.apsInFlight === request) this.apsInFlight = null
    }
  }

  private async fetchSwitches(): Promise<CvSwitch[]> {
    if (!this.api) return []
    // `/switches` returns a plain array (no paging envelope).
    const resp = await this.api.get<CvSwitch[] | { switches?: CvSwitch[] }>('/switches')
    return Array.isArray(resp) ? resp : (resp.switches ?? [])
  }

  /** The location tree (root with nested children); undefined if unavailable. */
  private async fetchLocations(): Promise<CvLocation | undefined> {
    if (!this.api) return undefined
    try {
      return await this.api.get<CvLocation>('/locations')
    } catch {
      // Locations are only used to group APs into zone subgraphs — a failure
      // here should degrade to an ungrouped (but still valid) topology.
      return undefined
    }
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (upstream vocab → core vocab at the boundary)
// ---------------------------------------------------------------------------

/** Stable id for an AP: CV-CUE boxId, falling back to its MAC. */
function apId(d: CvManagedDevice): string | undefined {
  return d.boxId !== undefined ? String(d.boxId) : d.macaddress
}

function apToHost(d: CvManagedDevice): Host | null {
  const id = apId(d)
  if (!id) return null
  // The AP `name` is operator-editable (a display string), so it stays out of
  // sysName; the MAC + management IP are the stable machine keys.
  const identity = buildIdentity({
    mgmtIp: d.ipAddress,
    mac: d.macaddress,
    vendorIds: d.boxId !== undefined ? { 'cvcue-boxid': String(d.boxId) } : undefined,
  })
  return {
    id,
    name: d.name || id,
    ...(d.name ? { displayName: d.name } : {}),
    status: d.active ? 'up' : 'down',
    ...(d.ipAddress ? { ip: d.ipAddress } : {}),
    ...(identity ? { identity } : {}),
  }
}

function switchToHost(s: CvSwitch): Host | null {
  if (!s.chassisId) return null
  // Switches are discovered via the LLDP neighbor of AP uplinks, so `name` is
  // the switch's self-reported (LLDP) system name — a valid sysName. The
  // chassis id is the strong cross-source key.
  const identity = buildIdentity({
    chassisId: s.chassisId,
    ...(s.name ? { sysName: s.name } : {}),
    vendorIds: { 'cvcue-switch-chassis': s.chassisId },
  })
  return {
    id: s.chassisId,
    name: s.name || s.chassisId,
    // No direct health in the switch list; treat "has connected APs" as alive
    // and otherwise leave it unknown rather than pretend.
    status: (s.numAps ?? 0) > 0 ? 'up' : 'unknown',
    ...(identity ? { identity } : {}),
  }
}

function apToMetrics(d: CvManagedDevice): NodeMetrics {
  const lastSeen =
    typeof d.lastUpdateTime === 'number' && d.lastUpdateTime > 0 ? d.lastUpdateTime : undefined
  return {
    status: d.active ? 'up' : 'down',
    // Cloud-managed: if we can read the inventory, our monitoring path is fine.
    // The device's `active` flag carries the actual up/down verdict.
    monitoring: 'healthy',
    ...(lastSeen !== undefined ? { lastSeen } : {}),
  }
}

function switchToMetrics(s: CvSwitch): NodeMetrics {
  return {
    status: (s.numAps ?? 0) > 0 ? 'up' : 'unknown',
    monitoring: 'healthy',
  }
}

/**
 * Link metrics for an AP↔switch uplink.
 *
 * Status comes from the wired link's `linkStatus`. Throughput is derived from
 * the AP's radios: all client traffic rides the single uplink, so the uplink
 * load ≈ the sum of per-radio usage. `downstreamUsage` (network→client) is the
 * bytes arriving at the AP → link `in`; `upstreamUsage` (client→network) leaves
 * the AP → link `out`. Utilization is vs the negotiated wired speed.
 *
 * CV-CUE's usage figures refresh periodically (not per-second) and their unit
 * is undocumented — read as bps by magnitude. We only emit throughput when the
 * radios actually report some (idle APs get status only, never a fake 0).
 */
export function uplinkToLinkMetrics(d: CvManagedDevice): LinkMetrics {
  // A disconnected AP's uplink record is a stale snapshot (43/47 inactive APs
  // on the JANOG58 tenant still reported linkStatus=1), so we can't trust it.
  // But an AP that isn't checking in is *absence of data*, not a confirmed link
  // failure: report 'unknown' (renders idle/gray) rather than 'down' (red), so
  // an unreachable AP doesn't masquerade as a downed uplink. The AP node itself
  // still reports 'down' — that verdict is real (the controller sees it offline);
  // the wired uplink's actual state simply isn't known while the AP is dark.
  if (!d.active) return { status: 'unknown' }
  const uplink = primaryUplink(d)
  const status: LinkMetrics['status'] = uplink
    ? uplink.linkStatus === 1
      ? 'up'
      : 'down'
    : 'unknown'

  let inBps = 0
  let outBps = 0
  for (const r of d.radios ?? []) {
    inBps += r.downstreamUsage ?? 0
    outBps += r.upstreamUsage ?? 0
  }
  if (inBps === 0 && outBps === 0) return { status }

  const capacityBps = (uplink?.linkSpeed ?? d.uplinkWiredInterfacesInfo?.sensorLinkSpeed ?? 0) * 1e6
  const util = (bps: number): number | undefined =>
    capacityBps > 0 ? Math.min(100, (bps / capacityBps) * 100) : undefined
  const inUtil = util(inBps)
  const outUtil = util(outBps)
  return {
    status,
    inBps,
    outBps,
    ...(inUtil !== undefined ? { inUtilization: inUtil } : {}),
    ...(outUtil !== undefined ? { outUtilization: outUtil } : {}),
    ...(inUtil !== undefined && outUtil !== undefined
      ? { utilization: Math.max(inUtil, outUtil) }
      : {}),
  }
}

export function eventToAlert(e: CvEvent): Alert {
  // `LIVE` = an ongoing condition (an active alert). `EXPIRED` = a condition
  // that has ended; `INSTANTANEOUS` = a point-in-time event. Neither of the
  // latter is an ongoing alarm, so both map to `resolved`.
  const active = (e.activityStatus ?? '').toUpperCase() === 'LIVE'
  const endTime = typeof e.stopTime === 'number' && e.stopTime > 0 ? e.stopTime : undefined
  return {
    id: String(e.id ?? `${e.startTime ?? 0}-${e.minorType ?? ''}`),
    severity: mapEventSeverity(e.eventSeverity),
    title: e.summary || String(e.minorType ?? e.category ?? 'CV-CUE event'),
    ...(e.description ? { description: e.description } : {}),
    startTime: typeof e.startTime === 'number' ? e.startTime : Date.now(),
    ...(!active && endTime !== undefined ? { endTime } : {}),
    status: active ? 'active' : 'resolved',
    source: 'arista-cv-cue',
    ...(e.category ? { labels: { category: String(e.category) } } : {}),
  }
}

/** CV-CUE severity token → core's neutral CVSS-style scale. */
export function mapEventSeverity(raw: string | undefined): AlertSeverity {
  switch ((raw ?? '').toUpperCase()) {
    case 'CRITICAL':
      return 'critical'
    case 'HIGH':
    case 'MAJOR':
      return 'high'
    case 'MEDIUM':
    case 'AVERAGE':
      return 'medium'
    case 'LOW':
    case 'MINOR':
    case 'WARNING':
      return 'low'
    case 'INFO':
    case 'INFORMATION':
      return 'info'
    case 'OK':
    case 'NONE':
      return 'ok'
    default:
      return 'info'
  }
}
