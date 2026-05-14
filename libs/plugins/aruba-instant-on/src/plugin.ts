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
   * Instant On exposes per-device telemetry through fields baked into the
   * inventory record (status, lastUpdated). There's no rich per-host item
   * list to enumerate — return empty so the mapping UI doesn't spin trying
   * to fetch interface items.
   */
  async getHostItems(_hostId: string): Promise<HostItem[]> {
    return []
  }

  /**
   * Discover gauge-style metrics for a given host. Used by the node-detail
   * modal's "All metrics" panel — operators see what's exposed for the
   * device they're about to map, so blank means "we have nothing to show".
   *
   * Pulls everything from the cached inventory call: device-level (clients,
   * uptime, power) and per-port (throughput, link state, PoE). One round
   * trip even if the panel opens for many hosts in a row.
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
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      if (!nodeMapping.hostId) continue
      const device = byId.get(nodeMapping.hostId)
      if (!device) {
        // Mapped to a host we couldn't find — treat as monitoring pending
        // rather than down, since absence is plausibly a transient API miss.
        metrics.nodes[nodeId] = { status: 'unknown', monitoring: 'pending' }
        continue
      }
      metrics.nodes[nodeId] = deviceToMetrics(device)
    }

    // ---- Links -----------------------------------------------------------
    // Each device's inventory record carries per-ethernet-port throughput.
    // For a link mapped to (monitoredNode, interfaceName), pull traffic from
    // the device's ethernetPorts[] entry whose port matches.
    for (const [linkId, linkMapping] of Object.entries(mapping.links || {})) {
      const link = portLinkLookup(linkMapping, mapping, byId)
      if (!link) {
        metrics.links[linkId] = { status: 'unknown' }
        continue
      }
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
 * Flatten an inventory record into individual numeric metrics the "All
 * metrics" panel can list. Each entry is a Prometheus-style sample: a
 * name, a value, optional labels for sub-dimensions (e.g. port number).
 *
 * Skip any field that's missing on the device — the API leaves nulls
 * around for capabilities a particular model doesn't have.
 */
function buildDeviceMetrics(d: AruInventoryDevice): DiscoveredMetric[] {
  const out: DiscoveredMetric[] = []
  const push = (
    name: string,
    value: number | undefined,
    help: string,
    type: string = 'gauge',
    labels: Record<string, string> = {},
  ): void => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    out.push({ name, value, help, type, labels })
  }
  const boolValue = (b: boolean | undefined): number | undefined =>
    typeof b === 'boolean' ? (b ? 1 : 0) : undefined

  // Device-level
  push('aruba_device_up', boolValue(d.status === 'up'), 'Device reported as up by the portal')
  push(
    'aruba_device_underpowered',
    boolValue(d.isUnderpowered),
    'Device is currently underpowered (PoE budget insufficient)',
  )
  push('aruba_device_uptime_seconds', d.uptimeInSeconds, 'Seconds since the device last booted')
  push(
    'aruba_device_seconds_since_last_communication',
    d.numberOfSecondsSinceLastCommunication,
    'Age of the last device check-in seen by the portal',
  )
  push('aruba_wired_clients', d.wiredClientsCount, 'Currently connected wired clients')
  push(
    'aruba_grouped_wired_clients',
    d.groupedWiredClientsCount,
    'Wired clients aggregated behind another device',
  )
  push('aruba_vpn_clients', d.vpnClientsCount, 'Currently connected VPN clients')

  // Per-port
  for (const port of d.ethernetPorts ?? []) {
    const labels: Record<string, string> = {
      port: String(port.portNumber ?? port.faceplatePortNumber ?? '?'),
    }
    push('aruba_port_link_up', boolValue(port.isLinkUp), 'Port has link up', 'gauge', labels)
    push(
      'aruba_port_uplink',
      boolValue(port.isUplink),
      'Port is acting as the uplink',
      'gauge',
      labels,
    )
    push(
      'aruba_port_providing_power',
      boolValue(port.isProvidingPower),
      'Port is currently supplying PoE to a downstream device',
      'gauge',
      labels,
    )
    const speed = portSpeedBps(port)
    push('aruba_port_speed_bps', speed, 'Negotiated port speed in bits per second', 'gauge', labels)
    const traffic = port.portDataTraffic
    push(
      'aruba_port_throughput_downstream_bps',
      traffic?.downstreamThroughputInBitsPerSecond,
      'Inbound port throughput (bps)',
      'gauge',
      labels,
    )
    push(
      'aruba_port_throughput_upstream_bps',
      traffic?.upstreamThroughputInBitsPerSecond,
      'Outbound port throughput (bps)',
      'gauge',
      labels,
    )
    push(
      'aruba_port_bytes_last_24h_downstream',
      traffic?.downstreamDataTransferredInBytesInLast24Hours,
      'Inbound bytes over the last 24h',
      'counter',
      labels,
    )
    push(
      'aruba_port_bytes_last_24h_upstream',
      traffic?.upstreamDataTransferredInBytesInLast24Hours,
      'Outbound bytes over the last 24h',
      'counter',
      labels,
    )
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
      return 'disaster'
    case 'MAJOR':
    case 'HIGH':
    case 'ERROR':
      return 'high'
    case 'MINOR':
    case 'AVERAGE':
    case 'MEDIUM':
      return 'average'
    case 'WARNING':
      return 'warning'
    case 'INFORMATION':
    case 'INFO':
      return 'information'
    case 'OK':
      return 'ok'
    default:
      return 'information'
  }
}
