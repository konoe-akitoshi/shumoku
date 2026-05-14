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
  AruAlertItem,
  AruAlertsResponse,
  ArubaInstantOnConfig,
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
        const id = d.serialNumber || d.macAddress
        if (!id) continue
        out.push({
          id,
          name: d.name || id,
          displayName: d.name,
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

    // Build a lookup: deviceId (serial or MAC) → inventory record
    const byId = await this.deviceLookup()

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
    const sites = await this.fetchSites()
    const out: Alert[] = []
    for (const site of sites) {
      try {
        const resp = await this.api.get<AruAlertsResponse>(`/sites/${site.id}/alerts`)
        for (const a of resp.elements ?? []) {
          out.push(toAlert(a, site))
        }
      } catch {
        // One bad site shouldn't poison the others — alerts widget shows
        // what we could get.
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

  private async deviceLookup(): Promise<Map<string, AruInventoryDevice>> {
    if (!this.api) return new Map()
    const sites = await this.fetchSites()
    const map = new Map<string, AruInventoryDevice>()
    for (const site of sites) {
      const inv = await this.api.get<AruInventoryResponse>(`/sites/${site.id}/inventory`)
      for (const d of inv.elements ?? []) {
        if (d.serialNumber) map.set(d.serialNumber, d)
        if (d.macAddress) map.set(d.macAddress, d)
      }
    }
    return map
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
  const lastSeen = d.lastUpdated ? Date.parse(d.lastUpdated) : undefined
  return {
    status,
    ...(Number.isFinite(lastSeen) && { lastSeen }),
    // Cloud-managed: as long as we can read the inventory, monitoring is
    // working. The device's `status` carries the actual up/down verdict.
    monitoring: 'healthy',
  }
}

function toAlert(a: AruAlertItem, site: AruSite): Alert {
  const isActive = !a.endTime
  return {
    id: a.id ?? `${site.id}:${a.startTime ?? Date.now()}`,
    severity: mapSeverity(a.severity),
    title: a.description ?? 'Aruba Instant On alert',
    host: a.deviceName,
    hostId: a.deviceSerial,
    startTime: a.startTime ? Date.parse(a.startTime) : Date.now(),
    endTime: a.endTime ? Date.parse(a.endTime) : undefined,
    status: isActive ? 'active' : 'resolved',
    source: 'aruba-instant-on' as const,
  }
}

function mapSeverity(raw: string | undefined): AlertSeverity {
  switch ((raw ?? '').toUpperCase()) {
    case 'CRITICAL':
    case 'DISASTER':
      return 'disaster'
    case 'HIGH':
    case 'ERROR':
      return 'high'
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
