/**
 * Huawei iMaster NCE-Campus data-source plugin.
 *
 * NCE-Campus is Huawei's campus SDN controller (cloud or on-prem). It exposes
 * a northbound RESTful API (NBI, port 18002) that this plugin polls — the
 * controller can't push to us in v1.
 *
 * Plugin scope (v1):
 *   - topology: managed devices + the controller's reported links
 *     (LLDP-neighbor fallback), grouped by site
 *   - hosts: managed devices with up/down from controller status
 *   - metrics: per-node status/CPU/memory from basic performance; per-link
 *     utilization from interface performance
 *   - alerts: current alarms mapped to our Alert shape
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
import { buildIdentity, flattenObject, mapWithConcurrency, severityAtLeast } from '@shumoku/core'
import { HuaweiNceCampusApi } from './api.js'
import { buildTopology, linkCapacityBps } from './topology.js'
import type {
  HuaweiNceCampusConfig,
  NceAlarm,
  NceAlarmScrollResponse,
  NceDevice,
  NceDevicePerformance,
  NceDevicePerformanceResponse,
  NceInterfacePerformance,
  NceInterfacePerformanceResponse,
  NceLldpNeighbor,
  NceLldpResponse,
  NceNetworkLink,
  NceNetworkLinkResponse,
} from './types.js'

/** What Link Management reports about one device port. */
interface NcePortLinkFacts {
  status?: number
  capacityBps?: number
}

/** Concurrent per-device NBI calls (LLDP / performance fan-out). */
const FANOUT_CONCURRENCY = 5

/** Upper bound on current alarms pulled per poll. */
const ALARM_LIMIT = 500

/** Alarm scroll batch size. */
const ALARM_BATCH = 100

/** Page size and page cap for the Link Management walk. */
const LINK_PAGE_SIZE = 200
const LINK_MAX_PAGES = 25

export class HuaweiNceCampusPlugin
  implements DataSourcePlugin, TopologyCapable, HostsCapable, MetricsCapable, AlertsCapable
{
  readonly type = 'huawei-nce-campus'
  readonly displayName = 'Huawei iMaster NCE-Campus'
  readonly capabilities: readonly DataSourceCapability[] = [
    'topology',
    'hosts',
    'metrics',
    'alerts',
  ]

  private api: HuaweiNceCampusApi | null = null
  private config: HuaweiNceCampusConfig | null = null
  private devicesCache: { value: NceDevice[]; expiresAt: number } | null = null
  private devicesInFlight: Promise<NceDevice[]> | null = null
  private linksCache: { value: NceNetworkLink[]; expiresAt: number } | null = null
  private linksInFlight: Promise<NceNetworkLink[]> | null = null

  initialize(config: unknown): void {
    const c = config as Partial<HuaweiNceCampusConfig>
    if (!c.baseUrl || !c.userName || !c.password) {
      throw new Error(
        'Huawei NCE-Campus plugin requires `baseUrl`, `userName`, and `password` in config',
      )
    }
    this.config = c as HuaweiNceCampusConfig
    this.api = new HuaweiNceCampusApi(this.config)
    this.devicesCache = null
    this.devicesInFlight = null
    this.linksCache = null
    this.linksInFlight = null
  }

  dispose(): void {
    this.config = null
    this.api = null
    this.devicesCache = null
    this.devicesInFlight = null
    this.linksCache = null
    this.linksInFlight = null
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.api) return { success: false, message: 'Plugin not initialized' }
    try {
      const devices = await this.fetchDevices()
      return {
        success: true,
        message: `Connected to iMaster NCE-Campus (${devices.length} device${devices.length === 1 ? '' : 's'})`,
      }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  // ============================================================
  // TopologyCapable — devices + LLDP links, grouped by site
  // ============================================================

  async fetchTopology(): Promise<NetworkGraph> {
    if (!this.api) return { version: '1.0.0', name: 'Huawei NCE-Campus', nodes: [], links: [] }
    const devices = await this.fetchDevices()

    // Preferred link source: Link Management — one paged call that names both
    // endpoints by device UUID. Only when it yields nothing do we fan out to
    // per-device LLDP tables; that's N calls and some tenants answer none.
    const networkLinks = await this.fetchNetworkLinks()
    const neighborsByDeviceId = new Map<string, NceLldpNeighbor[]>()
    if (networkLinks.length === 0) {
      await mapWithConcurrency(devices, FANOUT_CONCURRENCY, async (d) => {
        if (!d.id) return
        const neighbors = await this.fetchNeighbors(d.id)
        if (neighbors.length > 0) neighborsByDeviceId.set(d.id, neighbors)
      })
    }
    return buildTopology(devices, networkLinks, neighborsByDeviceId)
  }

  // ============================================================
  // HostsCapable
  // ============================================================

  async getHosts(): Promise<Host[]> {
    if (!this.api) return []
    const devices = await this.fetchDevices()
    const out: Host[] = []
    for (const d of devices) {
      const host = deviceToHost(d)
      if (host) out.push(host)
    }
    return out
  }

  /**
   * Dump every primitive field of the device's inventory + basic performance
   * records for the node-detail "All metrics" panel. Passthrough by design —
   * new NBI fields surface automatically.
   */
  async discoverMetrics(hostId: string): Promise<DiscoveredMetric[]> {
    if (!this.api) return []
    const device = (await this.fetchDevices()).find((d) => d.id === hostId)
    if (!device) return []
    const out = flattenObject(device, 'nce')
    const perf = await this.fetchPerformance(hostId)
    if (perf) out.push(...flattenObject(perf, 'nce.perf'))
    return out
  }

  /**
   * Per-host interface items for the link-mapping UI — the ports that
   * actually carry inter-device links. The interface names match the ports
   * `fetchTopology` puts on the links, so auto-map binds each link to its
   * device-side port.
   */
  async getHostItems(hostId: string): Promise<HostItem[]> {
    if (!this.api) return []
    // Ports that carry inter-device links: this device's ends of the reported
    // links, plus its LLDP local ports (covers the fallback topology too).
    const ifNames: string[] = []
    for (const l of await this.fetchNetworkLinks()) {
      if (l.anedn === hostId && l.aportname) ifNames.push(l.aportname)
      if (l.znedn === hostId && l.zportname) ifNames.push(l.zportname)
    }
    for (const n of await this.fetchNeighbors(hostId)) {
      if (n.localIfName) ifNames.push(n.localIfName)
    }
    const seen = new Set<string>()
    const out: HostItem[] = []
    for (const ifName of ifNames) {
      if (seen.has(ifName)) continue
      seen.add(ifName)
      for (const direction of ['in', 'out'] as const) {
        out.push({
          id: `${hostId}:${ifName}:${direction}`,
          hostId,
          name: `${ifName} ${direction === 'in' ? 'received' : 'sent'}`,
          key: `nce.if.${direction}`,
          interfaceName: ifName,
          interfaceIdentity: buildIdentity({ ifName }),
          direction,
        })
      }
    }
    return out
  }

  // ============================================================
  // MetricsCapable
  // ============================================================

  async pollMetrics(mapping: MetricsMapping): Promise<MetricsData> {
    const metrics: MetricsData = { nodes: {}, links: {}, timestamp: Date.now() }
    if (!this.api) return metrics

    // Which devices do we need performance for? Mapped nodes, plus the devices
    // that own a mapped link's interface.
    const nodeEntries = Object.entries(mapping.nodes ?? {}).filter(([, m]) => m.hostId)
    const linkEntries = Object.entries(mapping.links ?? {}).filter(
      (e) => e[1].monitoredNodeId && e[1].interface,
    )
    if (nodeEntries.length === 0 && linkEntries.length === 0) return metrics

    const devices = await this.fetchDevices()
    const known = new Set<string>()
    for (const d of devices) if (d.id) known.add(d.id)

    // Device performance is read once per device and used for both the node
    // sample and its uplink's throughput, rather than fetched twice.
    const perfByDevice = new Map<string, NceDevicePerformance>()
    const perfFor = async (hostId: string): Promise<NceDevicePerformance | undefined> => {
      const hit = perfByDevice.get(hostId)
      if (hit) return hit
      const fetched = await this.fetchPerformance(hostId)
      if (fetched) perfByDevice.set(hostId, fetched)
      return fetched
    }

    // ---- Nodes ----
    await mapWithConcurrency(nodeEntries, FANOUT_CONCURRENCY, async ([nodeId, nodeMapping]) => {
      const hostId = nodeMapping.hostId
      // Stay silent on ids that aren't ours — another source may own the node,
      // and emitting a fake status here would clobber the real one on merge.
      if (!hostId || !known.has(hostId)) return
      const perf = await perfFor(hostId)
      if (!perf) return
      metrics.nodes[nodeId] = perfToNodeMetrics(perf)
    })

    // ---- Links ----
    // Status comes from the link list; the controller retains a link record
    // after its endpoint disappears, so without `linkstatus` every historical
    // wire would render as live. Throughput comes from the device record —
    // an AP's whole load crosses its single uplink — because the per-interface
    // utilization fields come back null on live hardware.
    const factsByPort =
      linkEntries.length > 0
        ? await this.fetchLinkFactsByPort()
        : new Map<string, NcePortLinkFacts>()
    await mapWithConcurrency(linkEntries, FANOUT_CONCURRENCY, async ([linkId, linkMapping]) => {
      const monitoredNodeId = linkMapping.monitoredNodeId
      const iface = linkMapping.interface
      if (!monitoredNodeId || !iface) return
      const hostId = mapping.nodes[monitoredNodeId]?.hostId
      if (!hostId || !known.has(hostId)) return
      const facts = factsByPort.get(`${hostId}|${iface}`)
      const reported = facts?.status
      const ifPerf = await this.fetchInterfacePerformance(hostId, iface)
      const throughput = uplinkThroughput((await perfFor(hostId)) ?? {})
      if (!ifPerf && reported === undefined && !throughput) return
      const sample = ifPerf ? interfacePerfToLinkMetrics(ifPerf) : { status: 'unknown' as const }
      metrics.links[linkId] = {
        // Derived utilization first: a percentage the controller actually
        // reports (in `sample`) is a direct reading and outranks our division.
        ...(throughput ?? {}),
        ...(deriveUtilization(throughput, facts?.capacityBps) ?? {}),
        ...sample,
        ...(reported !== undefined ? { status: mapLinkStatus(reported) } : {}),
      }
    })

    return metrics
  }

  // ============================================================
  // AlertsCapable — current alarms
  // ============================================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    if (!this.api) return []
    const alarms: NceAlarm[] = []
    let iterator: string | undefined
    while (alarms.length < ALARM_LIMIT) {
      const page = await this.api.post<NceAlarmScrollResponse>(
        '/v1/perfservice/alarms/current-alarms/action/scroll',
        { alarmParamInput: { size: ALARM_BATCH, ...(iterator ? { iterator } : {}) } },
      )
      const items = page.data ?? []
      alarms.push(...items)
      if (items.length < ALARM_BATCH || !page.iterator) break
      iterator = page.iterator
    }

    const cutoff = Date.now() - (options?.timeRange ?? 3600) * 1000
    const out: Alert[] = []
    for (const a of alarms) {
      const alert = alarmToAlert(a)
      if (options?.activeOnly && alert.status !== 'active') continue
      if (options?.minSeverity && !severityAtLeast(alert.severity, options.minSeverity)) continue
      // Keep active alerts regardless of age; window-filter the cleared ones.
      if (alert.status !== 'active' && alert.startTime < cutoff) continue
      out.push(alert)
    }
    return out
  }

  // ============================================================
  // Internals
  // ============================================================

  private async fetchDevices(): Promise<NceDevice[]> {
    if (!this.api) return []
    const now = Date.now()
    if (this.devicesCache && this.devicesCache.expiresAt > now) return this.devicesCache.value
    if (this.devicesInFlight) return this.devicesInFlight

    const request = this.api.getPaged<NceDevice>(
      '/controller/campus/v3/devices',
      this.config?.siteId ? { siteId: this.config.siteId } : undefined,
    )
    this.devicesInFlight = request
    try {
      const value = await request
      // Mapping/auto-map asks once per mapped host. Reuse the same inventory
      // snapshot across that burst instead of re-listing per host.
      this.devicesCache = { value, expiresAt: Date.now() + 10_000 }
      return value
    } finally {
      if (this.devicesInFlight === request) this.devicesInFlight = null
    }
  }

  /**
   * The controller's network link list, deduped behind a short cache.
   *
   * Link Management (`/rest/openapi/network/link`) is used rather than the
   * topology API (`topomanager/device/node`): the latter returns nothing
   * unless queried per site via `parentResId`, and even then leaves the port
   * names null, which would leave links unmappable to interfaces. Failures
   * degrade to an empty list so callers fall back to LLDP.
   */
  private async fetchNetworkLinks(): Promise<NceNetworkLink[]> {
    if (!this.api) return []
    const now = Date.now()
    if (this.linksCache && this.linksCache.expiresAt > now) return this.linksCache.value
    if (this.linksInFlight) return this.linksInFlight

    const request = this.walkNetworkLinks()
    this.linksInFlight = request
    try {
      const value = await request
      // getHostItems is called once per mapped host in an auto-map burst;
      // reuse one walk across that burst.
      this.linksCache = { value, expiresAt: Date.now() + 10_000 }
      return value
    } finally {
      if (this.linksInFlight === request) this.linksInFlight = null
    }
  }

  /**
   * What Link Management knows about each device port, keyed `<deviceId>|<port>`:
   * its reported state and its negotiated capacity. Both endpoints of a wire
   * get an entry, so a lookup succeeds whichever side is monitored.
   */
  private async fetchLinkFactsByPort(): Promise<Map<string, NcePortLinkFacts>> {
    const byPort = new Map<string, NcePortLinkFacts>()
    for (const l of await this.fetchNetworkLinks()) {
      const facts: NcePortLinkFacts = {
        ...(l.linkstatus !== undefined ? { status: l.linkstatus } : {}),
        ...(linkCapacityBps(l) !== undefined ? { capacityBps: linkCapacityBps(l) } : {}),
      }
      if (facts.status === undefined && facts.capacityBps === undefined) continue
      if (l.anedn && l.aportname) byPort.set(`${l.anedn}|${l.aportname}`, facts)
      if (l.znedn && l.zportname) byPort.set(`${l.znedn}|${l.zportname}`, facts)
    }
    return byPort
  }

  private async walkNetworkLinks(): Promise<NceNetworkLink[]> {
    if (!this.api) return []
    const out: NceNetworkLink[] = []
    try {
      for (let page = 0; page < LINK_MAX_PAGES; page++) {
        const resp = await this.api.get<NceNetworkLinkResponse>('/rest/openapi/network/link', {
          start: page * LINK_PAGE_SIZE,
          size: LINK_PAGE_SIZE,
        })
        const items = resp.data ?? []
        out.push(...items)
        const total = resp.size ?? out.length
        if (items.length < LINK_PAGE_SIZE || out.length >= total) break
      }
    } catch {
      return []
    }
    return out
  }

  private async fetchNeighbors(deviceId: string): Promise<NceLldpNeighbor[]> {
    if (!this.api) return []
    try {
      const resp = await this.api.get<NceLldpResponse>(
        `/controller/campus/v1/networkresource/topomanager/device/${encodeURIComponent(deviceId)}/neighbors`,
      )
      return resp.data?.lldp ?? []
    } catch {
      // A device that can't answer LLDP (offline, unsupported) degrades to a
      // link-less node rather than failing the whole topology.
      return []
    }
  }

  private async fetchPerformance(deviceId: string): Promise<NceDevicePerformance | undefined> {
    if (!this.api) return undefined
    try {
      const resp = await this.api.get<NceDevicePerformanceResponse>(
        `/controller/campus/v1/performanceservice/basicperformance/device/${encodeURIComponent(deviceId)}`,
      )
      return resp.data?.[0]
    } catch {
      return undefined
    }
  }

  private async fetchInterfacePerformance(
    deviceId: string,
    interfaceName: string,
  ): Promise<NceInterfacePerformance | undefined> {
    if (!this.api) return undefined
    try {
      const resp = await this.api.get<NceInterfacePerformanceResponse>(
        `/controller/campus/v1/performanceservice/basicperformance/interfaceperformance/device/${encodeURIComponent(deviceId)}`,
        { interfaceName },
      )
      for (const entry of resp.data ?? []) {
        const packets = entry.interfacePackets
        const list = Array.isArray(packets) ? packets : packets ? [packets] : []
        const match = list.find((p) => !p.interfaceName || p.interfaceName === interfaceName)
        if (match) return match
      }
      return undefined
    } catch {
      return undefined
    }
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (upstream vocab → core vocab at the boundary)
// ---------------------------------------------------------------------------

/**
 * Controller device status → host status.
 * `0` normal and `1` alarm are both reachable devices; `3` offline is down;
 * `4` not registered means the controller has never seen it.
 */
export function mapDeviceStatus(status: string | undefined): 'up' | 'down' | 'unknown' {
  switch (status) {
    case '0':
    case '1':
      return 'up'
    case '3':
      return 'down'
    default:
      return 'unknown'
  }
}

export function deviceToHost(d: NceDevice): Host | null {
  if (!d.id) return null
  const identity = buildIdentity({
    mgmtIp: d.ip || d.manageIp,
    mac: d.mac,
    vendorIds: {
      'nce-device-id': d.id,
      ...(d.esn ? { 'nce-esn': d.esn } : {}),
    },
  })
  return {
    id: d.id,
    name: d.name || d.id,
    ...(d.name ? { displayName: d.name } : {}),
    status: mapDeviceStatus(d.status),
    ...(d.ip || d.manageIp ? { ip: d.ip || d.manageIp } : {}),
    ...(identity ? { identity } : {}),
  }
}

/**
 * Basic performance record → node metrics.
 * `status`: 0 normal / 1 alarm are up; 2 faulty / 3 offline are down;
 * 4 unregistered is unknown.
 */
export function perfToNodeMetrics(p: NceDevicePerformance): NodeMetrics {
  const status =
    p.status === 0 || p.status === 1 ? 'up' : p.status === 2 || p.status === 3 ? 'down' : 'unknown'
  return {
    status,
    // Controller-mediated: if the NBI answers, our monitoring path is fine.
    // The record's `status` carries the actual device verdict.
    monitoring: 'healthy',
    ...(typeof p.cpuRate === 'number' ? { cpu: p.cpuRate } : {}),
    ...(typeof p.memoryRate === 'number' ? { memory: p.memoryRate } : {}),
    // `timestamp` is when the controller last collected performance, not when
    // it last saw the device — but it is the freshest observation time we get,
    // and it stops advancing once collection stops.
    ...(typeof p.timestamp === 'number' && p.timestamp > 0 ? { lastSeen: p.timestamp * 1000 } : {}),
  }
}

/**
 * Uplink throughput for a device, from its performance record.
 *
 * An AP has one wired uplink, so everything it sends and receives crosses that
 * link: the device-level `upwardSpeed` / `downwardSpeed` are the link's rates.
 * `upwardSpeed` is device→network, i.e. the link's `out`.
 *
 * These refresh on the controller's collection cycle (the record's `timestamp`
 * held still across a 20s re-read), so they are a periodic sample, not a live
 * gauge. Returns undefined when the controller reports neither, so an idle or
 * uncollected device gets status only rather than a fabricated zero.
 */
export function uplinkThroughput(
  p: NceDevicePerformance,
): { inBps: number; outBps: number } | undefined {
  const outBps = typeof p.upwardSpeed === 'number' ? p.upwardSpeed : undefined
  const inBps = typeof p.downwardSpeed === 'number' ? p.downwardSpeed : undefined
  if (inBps === undefined && outBps === undefined) return undefined
  return { inBps: inBps ?? 0, outBps: outBps ?? 0 }
}

/**
 * Throughput + port capacity → utilization percentages.
 *
 * The weathermap colours a link from its utilization, not its bps: throughput
 * drives particle speed and density, but a link with no percentage stays the
 * "no data" grey however much traffic it carries. NCE leaves the per-interface
 * utilization fields null on live APs, so the only way to get a colour is to
 * divide the device's throughput counters by the negotiated port speed that
 * Link Management does report.
 */
export function deriveUtilization(
  throughput: { inBps: number; outBps: number } | undefined,
  capacityBps: number | undefined,
): { inUtilization: number; outUtilization: number; utilization: number } | undefined {
  if (!throughput || capacityBps === undefined || capacityBps <= 0) return undefined
  const pct = (bps: number): number => Math.min(100, Math.max(0, (bps / capacityBps) * 100))
  const inUtilization = pct(throughput.inBps)
  const outUtilization = pct(throughput.outBps)
  return { inUtilization, outUtilization, utilization: Math.max(inUtilization, outUtilization) }
}

/**
 * Interface performance record → link metrics.
 *
 * `inputBandwidth`/`outBandwidth` are utilization percentages, but a live AP
 * returns them as `null` — only the byte counters are populated, and those are
 * increments over an unstated collection window, so they don't convert to bps.
 * Throughput therefore comes from the device record instead (see
 * {@link uplinkThroughput}); this function contributes utilization when the
 * controller does fill it in.
 */
export function interfacePerfToLinkMetrics(p: NceInterfacePerformance): LinkMetrics {
  const inUtil = parsePercent(p.inputBandwidth)
  const outUtil = parsePercent(p.outBandwidth)
  return {
    // The controller only reports counters for interfaces it can read — the
    // record's existence is the "link alive" signal the NBI gives us.
    status: 'up',
    ...(inUtil !== undefined ? { inUtilization: inUtil } : {}),
    ...(outUtil !== undefined ? { outUtilization: outUtil } : {}),
    ...(inUtil !== undefined || outUtil !== undefined
      ? { utilization: Math.max(inUtil ?? 0, outUtil ?? 0) }
      : {}),
  }
}

function parsePercent(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return undefined
  return Math.min(100, Math.max(0, value))
}

/**
 * Link Management `linkstatus` → link status.
 *
 * `0` normal is up; `2` major, `3` critical, `4` offline and `6` faulty are
 * down; `1` unknown and `5` unmanaged carry no verdict. Records outlive their
 * endpoints (the controller stores no observation time), so a stale wire shows
 * up here as `4` — which is exactly how it should render.
 */
export function mapLinkStatus(status: number): 'up' | 'down' | 'unknown' {
  switch (status) {
    case 0:
      return 'up'
    case 2:
    case 3:
    case 4:
    case 6:
      return 'down'
    default:
      return 'unknown'
  }
}

/** NCE alarm severity (1–4) → core's neutral CVSS-style scale. */
export function mapAlarmSeverity(level: number | undefined): AlertSeverity {
  switch (level) {
    case 1:
      return 'critical'
    case 2:
      return 'high'
    case 3:
      return 'medium'
    case 4:
      return 'low'
    default:
      return 'info'
  }
}

export function alarmToAlert(a: NceAlarm): Alert {
  const occurred = Number(a.latestOccurUtc)
  return {
    id: a.csn || `${a.alarmId ?? 'nce'}-${a.latestOccurUtc ?? '0'}`,
    severity: mapAlarmSeverity(a.alarmLevel),
    title: a.alarmName || a.alarmId || 'NCE-Campus alarm',
    ...(a.probableCause || a.additionalInformation
      ? { description: [a.probableCause, a.additionalInformation].filter(Boolean).join(' — ') }
      : {}),
    startTime: Number.isFinite(occurred) && occurred > 0 ? occurred : Date.now(),
    status: a.cleared === 1 ? 'resolved' : 'active',
    source: 'huawei-nce-campus',
    labels: {
      ...(a.alarmCategory ? { category: a.alarmCategory } : {}),
      ...(a.alarmResName ? { resource: a.alarmResName } : {}),
    },
  }
}
