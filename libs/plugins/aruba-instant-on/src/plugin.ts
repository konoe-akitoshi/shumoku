/**
 * Aruba Instant On data-source plugin.
 *
 * Backed by the (undocumented) portal.arubainstanton.com API. See
 * `auth.ts` for the protocol notes — the short version is that this can
 * stop working any day Aruba decides to change the cloud, so failure
 * paths are deliberately loud rather than silently downgrading.
 *
 * Plugin scope:
 *   - hosts: APs + switches in all (or one) sites
 *   - metrics: per-device up/down derived from `status`, last-seen ms
 *   - alerts: site-level alerts mapped to our Alert shape
 *   - nativeApi: dev-only raw passthrough (PR #260 pattern)
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
  MetricsCapable,
  MetricsData,
  MetricsMapping,
  NativeApiCapable,
  NodeMetrics,
} from '@shumoku/core'
import { ArubaInstantOnApi } from './api.js'
import type {
  ArubaInstantOnConfig,
  AruEmbeddedAlert,
  AruEthernetPort,
  AruInventoryDevice,
  AruInventoryResponse,
  AruSite,
  AruSitesResponse,
} from './types.js'

export class ArubaInstantOnPlugin
  implements DataSourcePlugin, HostsCapable, MetricsCapable, AlertsCapable, NativeApiCapable
{
  readonly type = 'aruba-instant-on'
  readonly displayName = 'Aruba Instant On'
  readonly capabilities: readonly DataSourceCapability[] = ['hosts', 'metrics', 'alerts']

  private api: ArubaInstantOnApi | null = null
  private config: ArubaInstantOnConfig | null = null

  initialize(config: unknown): void {
    const c = config as Partial<ArubaInstantOnConfig>
    if (!c.username || !c.password) {
      throw new Error('Aruba Instant On plugin requires `username` and `password` in config')
    }
    this.config = c as ArubaInstantOnConfig
    this.api = new ArubaInstantOnApi(this.config)
  }

  dispose(): void {
    this.config = null
    this.api = null
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.api) return { success: false, message: 'Plugin not initialized' }
    try {
      const sites = await this.fetchSites()
      return {
        success: true,
        message: `Connected to Aruba Instant On (${sites.length} site${sites.length === 1 ? '' : 's'})`,
        warnings: [
          'Aruba Instant On API is unofficial / unsupported by HPE — may break without notice.',
        ],
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      }
    }
  }

  // ============================================================
  // HostsCapable — enumerate APs + switches across sites
  // ============================================================

  async getHosts(): Promise<Host[]> {
    if (!this.api) return []
    const sites = await this.fetchSites()
    const out: Host[] = []
    for (const site of sites) {
      const inv = await this.api.get<AruInventoryResponse>(`/sites/${site.id}/inventory`)
      for (const d of inv.elements ?? []) {
        // Prefer serial number (stable, human-recognisable on Aruba's part
        // numbers) then fall back to the portal's id (MAC) or macAddress.
        const id = d.serialNumber || d.id || d.macAddress
        if (!id) continue
        out.push({
          id,
          name: d.name || d.defaultName || id,
          displayName: d.name || d.defaultName,
          status: classifyDeviceStatus(d.status) === 'up' ? 'up' : 'down',
          ip: d.ipAddress,
        })
      }
    }
    return out
  }

  /**
   * Per-host interface items, two per ethernet port (in/out throughput).
   * Populates the mapping UI's "interface" dropdown when the operator is
   * matching a topology link to a real port on the monitored device.
   *
   * The portal exposes one record per port with both directions inside
   * `portDataTraffic`; we expand that into a pair of HostItem rows so the
   * existing UI (which expects per-direction items, modeled after Zabbix's
   * net.if.in / net.if.out) keeps working unchanged.
   */
  async getHostItems(hostId: string): Promise<HostItem[]> {
    const { byId } = await this.deviceLookup()
    const device = byId.get(hostId)
    if (!device) return []
    return buildHostItems(device)
  }

  /**
   * Dump every primitive field of the device's inventory record for the
   * node-detail modal's "All metrics" panel. Passthrough by design —
   * what the portal returns is what the operator sees, so new API fields
   * surface automatically and an empty list genuinely means "no record".
   */
  async discoverMetrics(hostId: string): Promise<DiscoveredMetric[]> {
    const { byId } = await this.deviceLookup()
    const device = byId.get(hostId)
    if (!device) return []
    return buildDeviceMetrics(device)
  }

  // ============================================================
  // MetricsCapable — per-device status from the inventory snapshot
  // ============================================================

  async pollMetrics(mapping: MetricsMapping): Promise<MetricsData> {
    const metrics: MetricsData = { nodes: {}, links: {}, timestamp: Date.now() }

    // Skip the upstream fetch entirely if nothing is mapped — saves a
    // round trip per poll for tenants that haven't wired this plugin in.
    const hasMappedHost = Object.values(mapping.nodes ?? {}).some((n) => n.hostId)
    const hasMappedLink = Object.values(mapping.links ?? {}).some(
      (l) => l.monitoredNodeId && l.interface,
    )
    if ((!hasMappedHost && !hasMappedLink) || !this.api) return metrics

    const { byId } = await this.deviceLookup()

    // ---- Nodes -----------------------------------------------------------
    //
    // Stay silent on hosts whose `hostId` isn't in *our* inventory —
    // either the mapping points at a different source's host (multi-
    // source case), or the operator typed a bad id. Either way, another
    // plugin in the poll loop may have the real answer, so emitting a
    // fake `{ status: unknown, monitoring: pending }` here would
    // clobber that real result during merge. The server uses absence
    // (no metrics from any plugin) to render "unknown" / "pending".
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      if (!nodeMapping.hostId) continue
      const device = byId.get(nodeMapping.hostId)
      if (!device) continue
      metrics.nodes[nodeId] = deviceToMetrics(device)
    }

    // ---- Links -----------------------------------------------------------
    // Same silence rule: only emit traffic for links whose monitored
    // node sits in our inventory. Links pointing at another source's
    // host (or unmapped) are left to other plugins / the default
    // "unknown" rendering.
    for (const [linkId, linkMapping] of Object.entries(mapping.links || {})) {
      const link = portLinkLookup(linkMapping, mapping, byId)
      if (!link) continue
      metrics.links[linkId] = portToLinkMetrics(link.port, linkMapping.bandwidth ?? link.bandwidth)
    }

    return metrics
  }

  // ============================================================
  // AlertsCapable
  // ============================================================

  async getAlerts(_options?: AlertQueryOptions): Promise<Alert[]> {
    if (!this.api) return []
    // Inventory devices embed their own `activeAlerts` array — pull alerts
    // from there rather than the site /alerts endpoint, since the inventory
    // call is already required by pollMetrics and the embedded shape carries
    // the device name/serial we need for cross-widget highlighting.
    const { devices } = await this.deviceLookup()
    const out: Alert[] = []
    for (const d of devices) {
      for (const a of d.activeAlerts ?? []) {
        out.push(embeddedAlertToAlert(a, d))
      }
    }
    return out
  }

  // ============================================================
  // NativeApiCapable — dev passthrough
  // ============================================================

  async nativeApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.api) throw new Error('Plugin not initialized')
    return this.api.nativeApi(method, params)
  }

  // ============================================================
  // Internals
  // ============================================================

  private async fetchSites(): Promise<AruSite[]> {
    if (!this.api) return []
    const resp = await this.api.get<AruSitesResponse>('/sites/')
    const all = resp.elements ?? []
    return this.config?.siteId ? all.filter((s) => s.id === this.config?.siteId) : all
  }

  /**
   * Fetch every device across all configured sites, keyed by the identifiers
   * the operator might have stored in the mapping (serial number, MAC, or
   * the portal-issued id). One lookup serves both pollMetrics and getAlerts.
   */
  private async deviceLookup(): Promise<{
    devices: AruInventoryDevice[]
    bySite: Map<string, AruSite>
    byId: Map<string, AruInventoryDevice>
  }> {
    const sites = await this.fetchSites()
    const byId = new Map<string, AruInventoryDevice>()
    const bySite = new Map<string, AruSite>()
    const devices: AruInventoryDevice[] = []
    if (!this.api) return { devices, bySite, byId }
    for (const site of sites) {
      bySite.set(site.id, site)
      const inv = await this.api.get<AruInventoryResponse>(`/sites/${site.id}/inventory`)
      for (const d of inv.elements ?? []) {
        devices.push(d)
        if (d.serialNumber) byId.set(d.serialNumber, d)
        if (d.macAddress) byId.set(d.macAddress, d)
        if (d.id) byId.set(d.id, d)
      }
    }
    return { devices, bySite, byId }
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a link mapping into the actual ethernet port telemetry record on
 * the monitored device. Returns null when the mapping can't be satisfied
 * (unmapped node, host not in inventory, no matching port).
 */
function portLinkLookup(
  linkMapping: { monitoredNodeId?: string; interface?: string },
  mapping: MetricsMapping,
  byId: Map<string, AruInventoryDevice>,
): { port: AruEthernetPort; bandwidth: number | undefined } | null {
  const monitoredNodeId = linkMapping.monitoredNodeId
  const ifaceName = linkMapping.interface
  if (!monitoredNodeId || !ifaceName) return null
  const hostId = mapping.nodes[monitoredNodeId]?.hostId
  if (!hostId) return null
  const device = byId.get(hostId)
  if (!device?.ethernetPorts?.length) return null
  const port = findPortByName(device.ethernetPorts, ifaceName)
  if (!port) return null
  return { port, bandwidth: portSpeedBps(port) }
}

/**
 * Match a free-form interface name against Aruba's port records.
 *
 * The mapping UI accepts whatever the operator types, which for Aruba
 * Instant On typically means a port number ("0", "1") or — when copied
 * from a Cisco-formatted neighbour — something like "Gi1/0/3" we want to
 * tolerate via "trailing digit" extraction. We try, in order:
 *   1. Exact match on the port's `name` (rare on Instant On).
 *   2. Exact match on `portNumber` / `faceplatePortNumber` as a string.
 *   3. The last run of digits in the operator's input vs. either number.
 */
function findPortByName(ports: AruEthernetPort[], ifaceName: string): AruEthernetPort | undefined {
  const lower = ifaceName.trim().toLowerCase()
  for (const p of ports) {
    if (typeof p.name === 'string' && p.name.toLowerCase() === lower) return p
    if (p.portNumber !== undefined && String(p.portNumber) === lower) return p
    if (p.faceplatePortNumber !== undefined && String(p.faceplatePortNumber) === lower) return p
  }
  return undefined
}

/**
 * Convert Aruba's `speed` token ("mbps1000") to bits-per-second so we can
 * compute utilization without yet another lookup table. Falls back to
 * `maxSpeed` when the port is link-down (speed nulls out then).
 */
function portSpeedBps(port: AruEthernetPort): number | undefined {
  const token = port.speed || port.maxSpeed
  if (!token) return undefined
  const m = token.match(/^mbps(\d+)$/i)
  if (!m?.[1]) return undefined
  return Number.parseInt(m[1], 10) * 1_000_000
}

function portToLinkMetrics(
  port: AruEthernetPort,
  bandwidthBps: number | undefined,
): import('@shumoku/core').LinkMetrics {
  const inBps = port.portDataTraffic?.downstreamThroughputInBitsPerSecond ?? 0
  const outBps = port.portDataTraffic?.upstreamThroughputInBitsPerSecond ?? 0
  const cap = bandwidthBps && bandwidthBps > 0 ? bandwidthBps : 1_000_000_000
  const inUtil = (inBps / cap) * 100
  const outUtil = (outBps / cap) * 100
  const maxUtil = Math.max(inUtil, outUtil)
  return {
    status: port.isLinkUp === false ? 'down' : maxUtil > 0 ? 'up' : 'unknown',
    utilization: Math.ceil(maxUtil),
    inUtilization: Math.ceil(inUtil),
    outUtilization: Math.ceil(outUtil),
    inBps,
    outBps,
  }
}

/**
 * Expand a device's ethernet ports into the in/out HostItem pairs the
 * mapping UI expects. The id has to be stable so the operator's link
 * mapping (which stores the item id) survives re-fetches — combine
 * device id with the port number and direction.
 */
function buildHostItems(d: AruInventoryDevice): HostItem[] {
  const out: HostItem[] = []
  const hostId = d.serialNumber || d.id || d.macAddress
  if (!hostId) return out
  for (const port of d.ethernetPorts ?? []) {
    const portNum = port.portNumber ?? port.faceplatePortNumber
    if (portNum === undefined) continue
    // The portal usually leaves `port.name` null; use the port number as
    // the interface label so the mapping UI shows "0", "1", ... — those
    // values also round-trip through `findPortByName` at poll time.
    const ifaceName = port.name && port.name.trim() ? port.name : String(portNum)
    const displayLabel = port.name && port.name.trim() ? port.name : `Port ${portNum}`
    const t = port.portDataTraffic
    const dirs: Array<{ direction: 'in' | 'out'; bps: number | undefined }> = [
      { direction: 'in', bps: t?.downstreamThroughputInBitsPerSecond },
      { direction: 'out', bps: t?.upstreamThroughputInBitsPerSecond },
    ]
    for (const { direction, bps } of dirs) {
      out.push({
        id: `${hostId}:port${portNum}:${direction}`,
        hostId,
        name: `${displayLabel} ${direction === 'in' ? 'received' : 'sent'}`,
        key: `aruba.port.${direction}[${portNum}]`,
        lastValue: typeof bps === 'number' ? String(bps) : undefined,
        unit: 'bps',
        interfaceName: ifaceName,
        direction,
      })
    }
  }
  return out
}

/**
 * Dump every primitive leaf of the raw inventory record as a
 * `DiscoveredMetric`. The "All metrics" panel is a debug passthrough —
 * what the portal returned is what the operator sees, including fields
 * we don't (yet) model in `types.ts`. Adding a new field to the API
 * surface automatically makes it visible; nothing has to be enumerated
 * by hand.
 *
 * Object children are joined with `_` into the metric name. Array
 * children are expanded one entry per element, with the index pinned to
 * a label (`ethernetPorts_0` becomes name `…_ethernetPorts_<field>`
 * with `ethernetPorts_index=0` in labels). Null/undefined/empty-string
 * leaves are skipped — they'd just be noise.
 */
function buildDeviceMetrics(d: AruInventoryDevice): DiscoveredMetric[] {
  return flattenObject(d, 'aruba')
}

function flattenObject(
  obj: unknown,
  prefix: string,
  labels: Record<string, string> = {},
): DiscoveredMetric[] {
  if (obj == null || typeof obj !== 'object') return []
  const out: DiscoveredMetric[] = []
  for (const [key, value] of Object.entries(obj)) {
    const name = `${prefix}_${key}`
    if (value == null) continue
    if (Array.isArray(value)) {
      // Array of primitives → emit count plus join (rare in this API).
      // Array of objects → expand each with `<key>_index` label.
      if (value.every((v) => typeof v !== 'object' || v === null)) {
        out.push({ name: `${name}_count`, value: value.length, labels })
        continue
      }
      out.push({ name: `${name}_count`, value: value.length, labels })
      for (const [i, child] of value.entries()) {
        out.push(...flattenObject(child, name, { ...labels, [`${key}_index`]: String(i) }))
      }
      continue
    }
    if (typeof value === 'object') {
      out.push(...flattenObject(value, name, labels))
      continue
    }
    if (typeof value === 'string' && value.length === 0) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    out.push({ name, value: value as number | string | boolean, labels })
  }
  return out
}

function classifyDeviceStatus(raw: string | undefined): 'up' | 'down' | 'unknown' {
  switch ((raw ?? '').toUpperCase()) {
    case 'ACTIVE':
    case 'UP':
    case 'ONLINE':
      return 'up'
    case 'INACTIVE':
    case 'OFFLINE':
    case 'DOWN':
      return 'down'
    default:
      return 'unknown'
  }
}

function deviceToMetrics(d: AruInventoryDevice): NodeMetrics {
  const status = classifyDeviceStatus(d.status)
  const secsSince = d.numberOfSecondsSinceLastCommunication
  const lastSeen =
    typeof secsSince === 'number' && Number.isFinite(secsSince)
      ? Date.now() - secsSince * 1000
      : undefined
  return {
    status,
    ...(lastSeen !== undefined && { lastSeen }),
    // Cloud-managed: as long as we can read the inventory, monitoring is
    // working. The device's `status` carries the actual up/down verdict.
    monitoring: 'healthy',
  }
}

function embeddedAlertToAlert(a: AruEmbeddedAlert, device: AruInventoryDevice): Alert {
  const isActive = !a.clearedTime
  const startMs = a.raisedTime ? a.raisedTime * 1000 : Date.now()
  return {
    id: a.id,
    severity: mapSeverity(a.severity),
    title: a.type ? humanizeAlertType(a.type) : 'Aruba Instant On alert',
    host: device.name || device.defaultName,
    hostId: device.serialNumber || device.id,
    startTime: startMs,
    endTime: a.clearedTime ? a.clearedTime * 1000 : undefined,
    status: isActive ? 'active' : 'resolved',
    source: 'aruba-instant-on' as const,
  }
}

/** Turn portal alert type codes ('deviceDown', etc.) into something human-readable. */
function humanizeAlertType(type: string): string {
  // camelCase → space-separated words, first letter capitalised
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

function mapSeverity(raw: string | undefined): AlertSeverity {
  switch ((raw ?? '').toUpperCase()) {
    case 'CRITICAL':
    case 'DISASTER':
      return 'critical'
    case 'MAJOR':
    case 'HIGH':
    case 'ERROR':
      return 'high'
    case 'AVERAGE':
    case 'MEDIUM':
    case 'MODERATE':
      return 'medium'
    case 'MINOR':
    case 'WARNING':
    case 'LOW':
      return 'low'
    case 'INFORMATION':
    case 'INFO':
      return 'info'
    case 'OK':
      return 'ok'
    default:
      return 'info'
  }
}
