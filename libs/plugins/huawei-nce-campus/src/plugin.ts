/**
 * Huawei iMaster NCE-Campus data-source plugin.
 *
 * NCE-Campus is Huawei's campus SDN controller (cloud or on-prem). It exposes
 * a northbound RESTful API (NBI, port 18002) that this plugin polls — the
 * controller can't push to us in v1.
 *
 * Plugin scope (v1):
 *   - topology: managed devices + LLDP-derived device↔device links, grouped by site
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
import { buildTopology } from './topology.js'
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
} from './types.js'

/** Concurrent per-device NBI calls (LLDP / performance fan-out). */
const FANOUT_CONCURRENCY = 5

/** Upper bound on current alarms pulled per poll. */
const ALARM_LIMIT = 500

/** Alarm scroll batch size. */
const ALARM_BATCH = 100

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
  }

  dispose(): void {
    this.config = null
    this.api = null
    this.devicesCache = null
    this.devicesInFlight = null
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
    const neighborsByDeviceId = new Map<string, NceLldpNeighbor[]>()
    await mapWithConcurrency(devices, FANOUT_CONCURRENCY, async (d) => {
      if (!d.id) return
      const neighbors = await this.fetchNeighbors(d.id)
      if (neighbors.length > 0) neighborsByDeviceId.set(d.id, neighbors)
    })
    return buildTopology(devices, neighborsByDeviceId)
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
   * Per-host interface items for the link-mapping UI, derived from the LLDP
   * neighbor table (the ports that actually carry inter-device links). The
   * interface name matches the port `fetchTopology` puts on the link, so
   * auto-map binds each link to its device-side port.
   */
  async getHostItems(hostId: string): Promise<HostItem[]> {
    if (!this.api) return []
    const neighbors = await this.fetchNeighbors(hostId)
    const seen = new Set<string>()
    const out: HostItem[] = []
    for (const n of neighbors) {
      const ifName = n.localIfName
      if (!ifName || seen.has(ifName)) continue
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

    // ---- Nodes ----
    await mapWithConcurrency(nodeEntries, FANOUT_CONCURRENCY, async ([nodeId, nodeMapping]) => {
      const hostId = nodeMapping.hostId
      // Stay silent on ids that aren't ours — another source may own the node,
      // and emitting a fake status here would clobber the real one on merge.
      if (!hostId || !known.has(hostId)) return
      const perf = await this.fetchPerformance(hostId)
      if (!perf) return
      metrics.nodes[nodeId] = perfToNodeMetrics(perf)
    })

    // ---- Links ----
    await mapWithConcurrency(linkEntries, FANOUT_CONCURRENCY, async ([linkId, linkMapping]) => {
      const monitoredNodeId = linkMapping.monitoredNodeId
      const iface = linkMapping.interface
      if (!monitoredNodeId || !iface) return
      const hostId = mapping.nodes[monitoredNodeId]?.hostId
      if (!hostId || !known.has(hostId)) return
      const ifPerf = await this.fetchInterfacePerformance(hostId, iface)
      if (!ifPerf) return
      metrics.links[linkId] = interfacePerfToLinkMetrics(ifPerf)
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
    ...(typeof p.timestamp === 'number' && p.timestamp > 0 ? { lastSeen: p.timestamp } : {}),
  }
}

/**
 * Interface performance record → link metrics. `inputBandwidth`/`outBandwidth`
 * are the NBI's bandwidth-usage percentages (strings); traffic counters are
 * incremental bytes per collection period, so they don't convert to a stable
 * bps without the period length — utilization is the honest signal here.
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
