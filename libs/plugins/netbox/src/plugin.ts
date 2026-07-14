/**
 * NetBox Data Source Plugin
 *
 * Uses NetBox API client for topology conversion
 */

import type { NetworkGraph } from '@shumoku/core'
import {
  addHttpWarning,
  buildIdentity,
  type ConfigOption,
  type ConfigOptionsCapable,
  type ConnectionResult,
  type DataSourceCapability,
  type DataSourcePlugin,
  type Host,
  type HostItem,
  type HostsCapable,
  type TopologyCapable,
} from '@shumoku/core'
import { NetBoxClient } from './client.js'
import { convertToNetworkGraph } from './converter.js'
import type { NetBoxPluginConfig } from './types.js'

export class NetBoxPlugin
  implements DataSourcePlugin, TopologyCapable, HostsCapable, ConfigOptionsCapable
{
  readonly type = 'netbox'
  readonly displayName = 'NetBox'
  readonly capabilities: readonly DataSourceCapability[] = ['topology', 'hosts']

  private config: NetBoxPluginConfig | null = null
  private client: NetBoxClient | null = null

  initialize(config: unknown): void {
    const cfg = config as NetBoxPluginConfig
    if (!cfg || typeof cfg !== 'object') {
      throw new Error('NetBox plugin config is required')
    }
    if (!cfg.url) {
      throw new Error('NetBox plugin requires url in config')
    }

    this.config = cfg
    this.client = new NetBoxClient({
      url: this.config.url,
      token: this.config.token,
      insecure: this.config.insecure,
    })

    console.log('[NetBox] Plugin initialized for:', this.config.url)
  }

  dispose(): void {
    this.config = null
    this.client = null
  }

  // ============================================
  // Base Plugin Methods
  // ============================================

  async testConnection(): Promise<ConnectionResult> {
    if (!this.client || !this.config) {
      return { success: false, message: 'Plugin not initialized' }
    }

    try {
      // Try to fetch devices to test connection
      const resp = await this.client.fetchDevices()

      return addHttpWarning(this.config.url, {
        success: true,
        message: `Connected to NetBox (${resp.count} devices)`,
      })
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  // ============================================
  // TopologyCapable Implementation
  // ============================================

  async fetchTopology(options?: Record<string, unknown>): Promise<NetworkGraph> {
    if (!this.client || !this.config) {
      throw new Error('Plugin not initialized')
    }

    // Extract per-topology options (filters support string or string[])
    const groupBy = (options?.['groupBy'] as string) || 'tag'

    const params: Record<string, string | string[] | number> = {}

    // Include filters
    const site = options?.['siteFilter'] as string | string[] | undefined
    const tag = options?.['tagFilter'] as string | string[] | undefined
    const role = options?.['roleFilter'] as string | string[] | undefined
    if (site && (!Array.isArray(site) || site.length > 0)) params['site'] = site
    if (tag && (!Array.isArray(tag) || tag.length > 0)) params['tag'] = tag
    if (role && (!Array.isArray(role) || role.length > 0)) params['role'] = role

    // Exclude filters (NetBox uses __n suffix for negation)
    const excludeRole = options?.['excludeRoleFilter'] as string | string[] | undefined
    const excludeTag = options?.['excludeTagFilter'] as string | string[] | undefined
    if (excludeRole && (!Array.isArray(excludeRole) || excludeRole.length > 0))
      params['role__n'] = excludeRole
    if (excludeTag && (!Array.isArray(excludeTag) || excludeTag.length > 0))
      params['tag__n'] = excludeTag

    console.log('[NetBox] Fetching topology with params:', params)

    // Fetch data using NetBox client
    const [deviceResp, interfaceResp, cableResp] = await Promise.all([
      this.client.fetchDevices(params),
      this.client.fetchInterfaces(params),
      this.client.fetchCables(),
    ])

    // Circuits are optional: an instance may not use the circuits app, or the
    // token may lack access. Recover them when present, but never fail the whole
    // topology sync over it — degrade to the device/cable graph.
    const circuitData = await this.fetchCircuitData()

    console.log('[NetBox] Fetched:', {
      devices: deviceResp.results.length,
      interfaces: interfaceResp.results.length,
      cables: cableResp.results.length,
      circuits: circuitData?.circuits.results.length ?? 0,
    })

    // Convert to NetworkGraph using converter
    const graph = convertToNetworkGraph(
      deviceResp,
      interfaceResp,
      cableResp,
      {
        groupBy: groupBy as 'tag' | 'site' | 'location' | 'prefix' | 'none',
        showPorts: true,
        colorByCableType: true,
        useRoleForType: true,
      },
      circuitData,
    )

    console.log('[NetBox] Converted graph:', {
      nodes: graph?.nodes?.length,
      links: graph?.links?.length,
      subgraphs: graph?.subgraphs?.length,
    })

    return graph
  }

  /**
   * Fetch circuits + their terminations, tolerating instances without the
   * circuits app or a token without circuits access. Returns null on any
   * failure so topology generation proceeds from devices/cables alone.
   */
  private async fetchCircuitData(): Promise<
    | {
        circuits: Awaited<ReturnType<NetBoxClient['fetchCircuits']>>
        terminations: Awaited<ReturnType<NetBoxClient['fetchCircuitTerminations']>>
      }
    | undefined
  > {
    if (!this.client) return undefined
    try {
      const [circuits, terminations] = await Promise.all([
        this.client.fetchCircuits(),
        this.client.fetchCircuitTerminations(),
      ])
      if (circuits.results.length === 0) return undefined
      return { circuits, terminations }
    } catch (error) {
      console.warn('[NetBox] Skipping circuits (not available):', (error as Error)?.message)
      return undefined
    }
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    if (!this.client || !this.config) {
      return []
    }

    const deviceResp = await this.client.fetchDevices()

    return deviceResp.results.map((device) => {
      const name = device.name ?? `device-${device.id}`
      const ip =
        device.primary_ip4?.address?.split('/')[0] || device.primary_ip6?.address?.split('/')[0]
      // Mirror the topology-node identity built in converter.ts so a host and
      // its own topology node share keys and auto-mapping can bind by identity.
      const identity = buildIdentity({ mgmtIp: ip, sysName: device.name ?? undefined })
      return {
        id: String(device.id),
        name,
        displayName: name,
        status: this.mapDeviceStatus(device.status?.value),
        ...(ip ? { ip } : {}),
        ...(identity ? { identity } : {}),
      }
    })
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    if (!this.client) {
      return []
    }

    // Note: device_id is a valid NetBox API parameter but not in QueryParams type
    const interfaceResp = await this.client.fetchInterfaces({
      device_id: parseInt(hostId, 10),
    } as unknown as Parameters<typeof this.client.fetchInterfaces>[0])

    return interfaceResp.results.map((iface) => ({
      id: String(iface.id),
      hostId,
      name: iface.name,
      key: iface.name,
      lastValue: iface.enabled ? 'enabled' : 'disabled',
      unit: iface.type?.label || 'interface',
      // Interface name populated so the entity registry can anchor a metrics
      // binding to this port via ifName — satisfies the HostsCapable contract
      // that interface items carry interfaceName (#569).
      interfaceName: iface.name,
    }))
  }

  // ============================================
  // Filter Options (for UI dropdowns)
  // ============================================

  async getFilterOptions(): Promise<{
    sites: { slug: string; name: string }[]
    tags: { slug: string; name: string }[]
    roles: { slug: string; name: string }[]
  }> {
    if (!this.client) {
      return { sites: [], tags: [], roles: [] }
    }

    const [siteResp, tagResp, roleResp] = await Promise.all([
      this.client.fetchSites(),
      this.client.fetchTags(),
      this.client.fetchDeviceRoles(),
    ])

    return {
      sites: siteResp.results.map((s) => ({ slug: s.slug, name: s.name })),
      tags: tagResp.results.map((t) => ({ slug: t.slug, name: t.name })),
      roles: roleResp.results.map((r) => ({ slug: r.slug, name: r.name })),
    }
  }

  /**
   * Generic candidate provider for `optionsSource` schema fields. Generalizes
   * getFilterOptions to the ConfigOptionsCapable contract so the host renders
   * the topology-source filters (sites / tags / roles) from the schema instead
   * of a NetBox-specific form. Requires a live connection (handled by the
   * caller instantiating the plugin with stored config).
   */
  async getConfigOptions(key: string): Promise<ConfigOption[]> {
    const opts = await this.getFilterOptions()
    const list =
      key === 'sites' ? opts.sites : key === 'tags' ? opts.tags : key === 'roles' ? opts.roles : []
    return list.map((o) => ({ value: o.slug, label: o.name }))
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private mapDeviceStatus(status?: string): 'up' | 'down' | 'unknown' {
    switch (status) {
      case 'active':
        return 'up'
      case 'offline':
      case 'failed':
        return 'down'
      default:
        return 'unknown'
    }
  }
}
