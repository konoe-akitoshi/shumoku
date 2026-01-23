/**
 * NetBox Data Source Plugin
 *
 * Provides topology and hosts capabilities from NetBox DCIM/IPAM.
 */

import type { NetworkGraph, NetworkNode, NetworkLink } from '@shumoku/core'
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

// NetBox API response types
interface NetBoxDevice {
  id: number
  name: string
  display: string
  device_type: {
    id: number
    manufacturer: { name: string; slug: string }
    model: string
    slug: string
  }
  role: { id: number; name: string; slug: string } | null
  site: { id: number; name: string; slug: string }
  status: { value: string; label: string }
  primary_ip4?: { address: string } | null
  primary_ip6?: { address: string } | null
  tags: Array<{ id: number; name: string; slug: string }>
}

interface NetBoxInterface {
  id: number
  name: string
  device: { id: number; name: string }
  type: { value: string; label: string }
  enabled: boolean
  description: string
}

interface NetBoxCable {
  id: number
  a_terminations: Array<{
    object_type: string
    object_id: number
    object: { id: number; name: string; device: { id: number; name: string } }
  }>
  b_terminations: Array<{
    object_type: string
    object_id: number
    object: { id: number; name: string; device: { id: number; name: string } }
  }>
  status: { value: string; label: string }
  type?: string
  label?: string
}

interface NetBoxApiResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export class NetBoxPlugin implements DataSourcePlugin, TopologyCapable, HostsCapable {
  readonly type = 'netbox'
  readonly displayName = 'NetBox'
  readonly capabilities: readonly DataSourceCapability[] = ['topology', 'hosts']

  private config: NetBoxPluginConfig | null = null

  initialize(config: unknown): void {
    this.config = config as NetBoxPluginConfig
  }

  dispose(): void {
    this.config = null
  }

  // ============================================
  // Base Plugin Methods
  // ============================================

  async testConnection(): Promise<ConnectionResult> {
    try {
      const response = await this.apiRequest<{ 'netbox-version': string }>('/api/status/')
      const version = response['netbox-version'] || 'unknown'
      return {
        success: true,
        message: `Connected to NetBox ${version}`,
        version,
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
    const [devices, cables] = await Promise.all([this.fetchDevices(), this.fetchCables()])

    // Convert devices to nodes
    const nodes: NetworkNode[] = devices.map((device) => ({
      id: `device-${device.id}`,
      label: device.name,
      type: this.mapDeviceType(device.role?.slug),
      vendor: device.device_type.manufacturer.name,
      model: device.device_type.model,
      metadata: {
        netboxId: device.id,
        site: device.site.name,
        status: device.status.value,
        ip: device.primary_ip4?.address || device.primary_ip6?.address,
      },
    }))

    // Convert cables to links
    const links: NetworkLink[] = cables
      .filter((cable) => cable.a_terminations.length > 0 && cable.b_terminations.length > 0)
      .map((cable) => {
        const aTermination = cable.a_terminations[0]
        const bTermination = cable.b_terminations[0]

        return {
          id: `cable-${cable.id}`,
          from: {
            node: `device-${aTermination.object.device.id}`,
            port: aTermination.object.name,
          },
          to: {
            node: `device-${bTermination.object.device.id}`,
            port: bTermination.object.name,
          },
          label: cable.label,
          metadata: {
            netboxId: cable.id,
            status: cable.status.value,
            type: cable.type,
          },
        }
      })

    return {
      name: 'NetBox Topology',
      nodes,
      links,
    }
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    const devices = await this.fetchDevices()

    return devices.map((device) => ({
      id: `device-${device.id}`,
      name: device.name,
      displayName: device.display,
      status: this.mapDeviceStatus(device.status.value),
      ip: device.primary_ip4?.address?.split('/')[0] || device.primary_ip6?.address?.split('/')[0],
    }))
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    // Extract NetBox device ID from our ID format
    const deviceId = hostId.replace('device-', '')
    const interfaces = await this.fetchDeviceInterfaces(parseInt(deviceId))

    return interfaces.map((iface) => ({
      id: `interface-${iface.id}`,
      hostId,
      name: iface.name,
      key: iface.name,
      lastValue: iface.enabled ? 'enabled' : 'disabled',
      unit: iface.type.label,
    }))
  }

  // ============================================
  // Private API Methods
  // ============================================

  private async apiRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const url = new URL(endpoint, this.config.url)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Token ${this.config.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`NetBox API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  private async fetchDevices(): Promise<NetBoxDevice[]> {
    const params: Record<string, string> = { limit: '1000' }

    if (this.config?.siteFilter) {
      params.site = this.config.siteFilter
    }
    if (this.config?.tagFilter) {
      params.tag = this.config.tagFilter
    }

    const response = await this.apiRequest<NetBoxApiResponse<NetBoxDevice>>(
      '/api/dcim/devices/',
      params,
    )
    return response.results
  }

  private async fetchCables(): Promise<NetBoxCable[]> {
    const response = await this.apiRequest<NetBoxApiResponse<NetBoxCable>>('/api/dcim/cables/', {
      limit: '1000',
    })
    return response.results
  }

  private async fetchDeviceInterfaces(deviceId: number): Promise<NetBoxInterface[]> {
    const response = await this.apiRequest<NetBoxApiResponse<NetBoxInterface>>(
      '/api/dcim/interfaces/',
      {
        device_id: deviceId.toString(),
        limit: '1000',
      },
    )
    return response.results
  }

  private mapDeviceType(roleSlug?: string): string {
    if (!roleSlug) return 'device'

    const typeMap: Record<string, string> = {
      router: 'router',
      switch: 'l2-switch',
      'core-switch': 'l3-switch',
      'distribution-switch': 'l3-switch',
      'access-switch': 'l2-switch',
      firewall: 'firewall',
      'load-balancer': 'load-balancer',
      server: 'server',
      storage: 'storage',
      'access-point': 'access-point',
      wap: 'access-point',
    }

    return typeMap[roleSlug] || 'device'
  }

  private mapDeviceStatus(status: string): 'up' | 'down' | 'unknown' {
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
