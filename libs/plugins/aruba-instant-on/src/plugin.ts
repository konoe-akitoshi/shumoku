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

  // ============================================================
  // MetricsCapable — per-device status from the inventory snapshot
  // ============================================================

  async pollMetrics(mapping: MetricsMapping): Promise<MetricsData> {
    const metrics: MetricsData = { nodes: {}, links: {}, timestamp: Date.now() }

    // Skip the upstream fetch entirely if nothing is mapped — saves a
    // round trip per poll for tenants that haven't wired this plugin in.
    const hasMappedHost = Object.values(mapping.nodes ?? {}).some((n) => n.hostId)
    if (!hasMappedHost || !this.api) return metrics

    const { byId } = await this.deviceLookup()

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
    // Links aren't represented in the Instant On API (switch port maps are
    // limited), so we don't populate `metrics.links` here. Operators can
    // still get link traffic through another plugin (e.g. Zabbix) if they
    // want — shumoku merges per-source.

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
