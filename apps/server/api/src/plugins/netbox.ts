/**
 * NetBox Data Source Plugin
 *
 * Uses @shumoku/netbox package for topology conversion
 */

import type { NetworkGraph } from '@shumoku/core'
import { NetBoxClient, convertToNetworkGraph } from '@shumoku/netbox'
import {
  addHttpWarning,
  type DataSourcePlugin,
  type DataSourceCapability,
  type TopologyCapable,
  type HostsCapable,
  type ConnectionResult,
  type Host,
  type HostItem,
  type NetBoxPluginConfig,
} from './types.js'

export class NetBoxPlugin implements DataSourcePlugin, TopologyCapable, HostsCapable {
  readonly type = 'netbox'
  readonly displayName = 'NetBox'
  readonly capabilities: readonly DataSourceCapability[] = ['topology', 'hosts']

  private config: NetBoxPluginConfig | null = null
  private client: NetBoxClient | null = null

  initialize(config: unknown): void {
    console.log('[NetBox] initialize called')

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
    const groupBy = (options?.groupBy as string) || 'tag'

    const params: Record<string, string | string[] | number> = {}

    // Include filters
    const site = options?.siteFilter as string | string[] | undefined
    const tag = options?.tagFilter as string | string[] | undefined
    const role = options?.roleFilter as string | string[] | undefined
    if (site && (!Array.isArray(site) || site.length > 0)) params.site = site
    if (tag && (!Array.isArray(tag) || tag.length > 0)) params.tag = tag
    if (role && (!Array.isArray(role) || role.length > 0)) params.role = role

    // Exclude filters (NetBox uses __n suffix for negation)
    const excludeRole = options?.excludeRoleFilter as string | string[] | undefined
    const excludeTag = options?.excludeTagFilter as string | string[] | undefined
    if (excludeRole && (!Array.isArray(excludeRole) || excludeRole.length > 0))
      params.role__n = excludeRole
    if (excludeTag && (!Array.isArray(excludeTag) || excludeTag.length > 0))
      params.tag__n = excludeTag

    console.log('[NetBox] Fetching topology with params:', params)

    // Fetch data using @shumoku/netbox client
    const [deviceResp, interfaceResp, cableResp] = await Promise.all([
      this.client.fetchDevices(params),
      this.client.fetchInterfaces(params),
      this.client.fetchCables(),
    ])

    console.log('[NetBox] Fetched:', {
      devices: deviceResp.results.length,
      interfaces: interfaceResp.results.length,
      cables: cableResp.results.length,
    })

    // Convert to NetworkGraph using @shumoku/netbox converter
    const graph = convertToNetworkGraph(deviceResp, interfaceResp, cableResp, {
      groupBy: groupBy as 'tag' | 'site' | 'location' | 'prefix' | 'none',
      showPorts: true,
      colorByCableType: true,
      useRoleForType: true,
    })

    console.log('[NetBox] Converted graph:', {
      nodes: graph?.nodes?.length,
      links: graph?.links?.length,
      subgraphs: graph?.subgraphs?.length,
    })

    return graph
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    if (!this.client || !this.config) {
      return []
    }

    const deviceResp = await this.client.fetchDevices()

    return deviceResp.results.map((device) => ({
      id: String(device.id),
      name: device.name ?? `device-${device.id}`,
      displayName: device.name ?? `device-${device.id}`,
      status: this.mapDeviceStatus(device.status?.value),
      ip: device.primary_ip4?.address?.split('/')[0] || device.primary_ip6?.address?.split('/')[0],
    }))
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    if (!this.client) {
      return []
    }

    // Note: device_id is a valid NetBox API parameter but not in QueryParams type
    const interfaceResp = await this.client.fetchInterfaces({
      device_id: parseInt(hostId),
    } as unknown as Parameters<typeof this.client.fetchInterfaces>[0])

    return interfaceResp.results.map((iface) => ({
      id: String(iface.id),
      hostId,
      name: iface.name,
      key: iface.name,
      lastValue: iface.enabled ? 'enabled' : 'disabled',
      unit: iface.type?.label || 'interface',
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
