/**
 * NetBox Data Source Plugin
 *
 * Uses @shumoku/netbox package for topology conversion
 */

import type { NetworkGraph } from '@shumoku/core'
import { NetBoxClient, convertToNetworkGraph } from '@shumoku/netbox'
import type {
  DataSourcePlugin,
  DataSourceCapability,
  TopologyCapable,
  HostsCapable,
  ConnectionResult,
  Host,
  HostItem,
  NetBoxPluginConfig,
} from './types.js'

export class NetBoxPlugin implements DataSourcePlugin, TopologyCapable, HostsCapable {
  readonly type = 'netbox'
  readonly displayName = 'NetBox'
  readonly capabilities: readonly DataSourceCapability[] = ['topology', 'hosts']

  private config: NetBoxPluginConfig | null = null
  private client: NetBoxClient | null = null

  initialize(config: unknown): void {
    console.log('[NetBox] initialize called with config:', JSON.stringify(config, null, 2))

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
    if (!this.client) {
      return { success: false, message: 'Plugin not initialized' }
    }

    try {
      // Try to fetch devices to test connection
      const resp = await this.client.fetchDevices()
      return {
        success: true,
        message: `Connected to NetBox (${resp.count} devices)`,
      }
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

  async fetchTopology(): Promise<NetworkGraph> {
    if (!this.client || !this.config) {
      throw new Error('Plugin not initialized')
    }

    // Build query params from config filters
    const params: Record<string, string | number> = {}
    if (this.config.siteFilter) {
      params.site = this.config.siteFilter
    }
    if (this.config.tagFilter) {
      params.tag = this.config.tagFilter
    }

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
      groupBy: 'tag',
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

    const params: Record<string, string | number> = {}
    if (this.config.siteFilter) {
      params.site = this.config.siteFilter
    }
    if (this.config.tagFilter) {
      params.tag = this.config.tagFilter
    }

    const deviceResp = await this.client.fetchDevices(params)

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
