/**
 * NetBox Data Source Plugin
 *
 * Uses NetBox API client for topology conversion
 */

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
  type SourceNetwork,
  type TopologyCapable,
} from '@shumoku/core'
import { NetBoxClient } from './client.js'
import { convertToSourceNetwork } from './converter.js'
import { hostOf } from './net.js'
import type { ConverterOptions, FetchFilters, GroupDepth, NetBoxPluginConfig } from './types.js'

/** A list option: one value or several; anything else is no value. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : []
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v !== '')
}

/** Which devices to fetch, from the topology's options. */
export function fetchFilters(options: Record<string, unknown> | undefined): FetchFilters {
  return {
    site: strings(options?.['siteFilter']),
    tag: strings(options?.['tagFilter']),
    role: strings(options?.['roleFilter']),
    excludeRole: strings(options?.['excludeRoleFilter']),
    excludeTag: strings(options?.['excludeTagFilter']),
    tenant: strings(options?.['tenantFilter']),
  }
}

/**
 * How to map them. `roleTypes` is a list of `role-slug=type` lines, since the options form edits
 * lists of text; an object of the same shape is taken as it is.
 */
export function converterOptions(options: Record<string, unknown> | undefined): ConverterOptions {
  const roleTypes: Record<string, string> = {}
  const raw = options?.['roleTypes']
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [role, type] of Object.entries(raw)) {
      if (typeof type === 'string' && type) roleTypes[role] = type
    }
  }
  for (const line of strings(raw)) {
    const [role, type] = line.split('=').map((part) => part.trim())
    if (role && type) roleTypes[role] = type
  }
  const depth = options?.['groupDepth']
  const groupDepth: GroupDepth | undefined =
    depth === 'site' || depth === 'location' || depth === 'rack' ? depth : undefined
  const statuses = strings(options?.['statusFilter'])
  const circuitStatuses = strings(options?.['circuitStatusFilter'])
  return {
    ...(groupDepth && { groupDepth }),
    cloudClusterTypes: strings(options?.['cloudClusterTypes']),
    roleTypes,
    ...(statuses.length > 0 && { statuses }),
    ...(circuitStatuses.length > 0 && { circuitStatuses }),
  }
}

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
      const devices = await this.client.fetchDevices()

      return addHttpWarning(this.config.url, {
        success: true,
        message: `Connected to NetBox (${devices.length} devices)`,
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

  async fetchTopology(options?: Record<string, unknown>): Promise<SourceNetwork> {
    if (!this.client || !this.config) {
      throw new Error('Plugin not initialized')
    }

    const data = await this.client.fetchTopologyData(fetchFilters(options))
    console.log('[NetBox] Fetched:', {
      devices: data.devices.length,
      interfaces: data.interfaces.length,
      virtualMachines: data.virtualMachines.length,
      circuits: data.circuits.length,
    })

    const source = convertToSourceNetwork(data, converterOptions(options))
    console.log('[NetBox] Converted network:', {
      nodes: source.network.nodes.length,
      links: source.network.links.length,
      groups: source.network.groups?.length,
    })
    return source
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    if (!this.client || !this.config) {
      return []
    }

    const devices = await this.client.fetchDevices()

    return devices.map((device) => {
      const name = device.name ?? `device-${device.id}`
      const ip = device.primary_ip4?.address ?? device.primary_ip6?.address
      // The same keys the topology node carries, so a host and its node share an entity and
      // metrics bind by identity. A NetBox name is operator-written, not a self-reported
      // sysName, so it is not an identity key.
      const identity = buildIdentity({
        mgmtIp: ip ? hostOf(ip) : undefined,
        vendorIds: { 'netbox-device-id': String(device.id) },
      })
      return {
        id: String(device.id),
        name,
        displayName: name,
        status: this.mapDeviceStatus(device.status?.value),
        ...(ip ? { ip: hostOf(ip) } : {}),
        ...(identity ? { identity } : {}),
      }
    })
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    if (!this.client) {
      return []
    }

    const interfaces = await this.client.fetchInterfaces({ device_id: hostId })

    return interfaces.map((iface) => ({
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
    clusterTypes: { slug: string; name: string }[]
  }> {
    if (!this.client) {
      return { sites: [], tags: [], roles: [], clusterTypes: [] }
    }

    const [sites, tags, roles, clusterTypes] = await Promise.all([
      this.client.fetchSites(),
      this.client.fetchTags(),
      this.client.fetchDeviceRoles(),
      // Virtualization may be switched off; the other candidates are still useful.
      this.client.fetchClusterTypes().catch(() => []),
    ])

    return {
      sites: sites.map((s) => ({ slug: s.slug, name: s.name })),
      tags: tags.map((t) => ({ slug: t.slug, name: t.name })),
      roles: roles.map((r) => ({ slug: r.slug, name: r.name })),
      clusterTypes: clusterTypes.map((c) => ({ slug: c.slug, name: c.name })),
    }
  }

  /**
   * Generic candidate provider for `optionsSource` schema fields. Generalizes
   * getFilterOptions to the ConfigOptionsCapable contract so the host renders
   * the topology-source filters (sites / tags / roles / cluster types) from the schema
   * instead of a NetBox-specific form. Requires a live connection (handled by the
   * caller instantiating the plugin with stored config).
   */
  async getConfigOptions(key: string): Promise<ConfigOption[]> {
    const opts = await this.getFilterOptions()
    const lists: Record<string, { slug: string; name: string }[]> = {
      sites: opts.sites,
      tags: opts.tags,
      roles: opts.roles,
      clusterTypes: opts.clusterTypes,
    }
    return (lists[key] ?? []).map((o) => ({ value: o.slug, label: o.name }))
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
