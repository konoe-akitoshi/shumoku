/**
 * Zabbix Data Source Plugin
 *
 * Provides metrics, hosts, and auto-mapping capabilities.
 */

import type { NetworkGraph } from '@shumoku/core'
import type { MetricsData, MetricsMapping, LinkMetricsMapping, ZabbixHost, ZabbixItem } from '../types.js'
import {
  addHttpWarning,
  type DataSourcePlugin,
  type DataSourceCapability,
  type MetricsCapable,
  type HostsCapable,
  type AutoMappingCapable,
  type AlertsCapable,
  type ConnectionResult,
  type Host,
  type HostItem,
  type DiscoveredMetric,
  type MappingHint,
  type ZabbixPluginConfig,
  type Alert,
  type AlertQueryOptions,
  type AlertSeverity,
} from './types.js'

/** Zabbix-specific link mapping with item IDs for direct item reference */
interface ZabbixLinkMapping extends LinkMetricsMapping {
  in?: string
  out?: string
}

export class ZabbixPlugin
  implements DataSourcePlugin, MetricsCapable, HostsCapable, AutoMappingCapable, AlertsCapable
{
  readonly type = 'zabbix'
  readonly displayName = 'Zabbix'
  readonly capabilities: readonly DataSourceCapability[] = [
    'metrics',
    'hosts',
    'auto-mapping',
    'alerts',
  ]

  private config: ZabbixPluginConfig | null = null
  private requestId = 0

  initialize(config: unknown): void {
    this.config = config as ZabbixPluginConfig
  }

  dispose(): void {
    this.config = null
  }

  // ============================================
  // Base Plugin Methods
  // ============================================

  async testConnection(): Promise<ConnectionResult> {
    if (!this.config) {
      return { success: false, message: 'Plugin not initialized' }
    }

    try {
      const version = await this.apiRequest<string>('apiinfo.version')
      return addHttpWarning(this.config.url, {
        success: true,
        message: `Connected to Zabbix ${version}`,
        version,
      })
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      }
    }
  }

  // ============================================
  // MetricsCapable Implementation
  // ============================================

  async pollMetrics(mapping: MetricsMapping): Promise<MetricsData> {
    const metrics: MetricsData = {
      nodes: {},
      links: {},
      timestamp: Date.now(),
    }

    // Poll node metrics
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      if (nodeMapping.hostId) {
        try {
          const isAvailable = await this.getHostAvailability(nodeMapping.hostId)
          metrics.nodes[nodeId] = {
            status: isAvailable ? 'up' : 'down',
            lastSeen: isAvailable ? Date.now() : undefined,
          }
        } catch {
          metrics.nodes[nodeId] = { status: 'unknown' }
        }
      } else {
        metrics.nodes[nodeId] = { status: 'unknown' }
      }
    }

    // Poll link metrics
    for (const [linkId, baseLinkMapping] of Object.entries(mapping.links || {})) {
      try {
        const linkMapping = baseLinkMapping as ZabbixLinkMapping
        let inItemId = linkMapping.in
        let outItemId = linkMapping.out

        // Resolve item IDs from monitoredNodeId + interface if not directly set
        if (!inItemId && !outItemId && linkMapping.monitoredNodeId && linkMapping.interface) {
          const hostId = mapping.nodes[linkMapping.monitoredNodeId]?.hostId
          if (hostId) {
            const ifItems = await this.getInterfaceItems(hostId, linkMapping.interface)
            inItemId = ifItems.in?.id
            outItemId = ifItems.out?.id
          }
        }

        if (inItemId || outItemId) {
          const itemIds = [inItemId, outItemId].filter(Boolean) as string[]
          const items = await this.getItemsByIds(itemIds)

          let inBps = 0
          let outBps = 0

          for (const item of items) {
            const value = Number.parseFloat(item.lastvalue) || 0
            if (item.itemid === inItemId) {
              inBps = value
            } else if (item.itemid === outItemId) {
              outBps = value
            }
          }

          const capacity = linkMapping.capacity || 1_000_000_000
          const inUtil = (inBps / capacity) * 100
          const outUtil = (outBps / capacity) * 100
          const maxUtil = Math.max(inUtil, outUtil)

          metrics.links[linkId] = {
            status: maxUtil > 0 ? 'up' : 'unknown',
            utilization: Math.ceil(maxUtil),
            inUtilization: Math.ceil(inUtil),
            outUtilization: Math.ceil(outUtil),
            inBps,
            outBps,
          }
        } else {
          metrics.links[linkId] = { status: 'unknown' }
        }
      } catch {
        metrics.links[linkId] = { status: 'unknown' }
      }
    }

    return metrics
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    const zabbixHosts = await this.apiRequest<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
    })

    return zabbixHosts.map((h) => ({
      id: h.hostid,
      name: h.host,
      displayName: h.name,
      status: h.status === '0' ? 'up' : 'down',
    }))
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    // Fetch only network interface traffic items (net.if.in / net.if.out)
    const items = await this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'units'],
      hostids: [hostId],
      search: { key_: ['net.if.in', 'net.if.out'] },
      searchByAny: true,
      filter: { status: '0', state: '0' },
    })

    return items.map((item) => {
      const ifName = ZabbixPlugin.extractInterfaceName(item.name)
      const isIn = item.key_.startsWith('net.if.in')
      const direction = isIn ? 'Inbound' : 'Outbound'

      return {
        id: item.itemid,
        hostId: item.hostid,
        name: `${ifName} - ${direction}`,
        key: item.key_,
        lastValue: item.lastvalue,
        unit: (item as ZabbixItem & { units?: string }).units,
      }
    })
  }

  async searchHosts(query: string): Promise<Host[]> {
    const zabbixHosts = await this.apiRequest<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
      search: { host: query, name: query },
      searchByAny: true,
    })

    return zabbixHosts.map((h) => ({
      id: h.hostid,
      name: h.host,
      displayName: h.name,
      status: h.status === '0' ? 'up' : 'down',
    }))
  }

  async discoverMetrics(hostId: string): Promise<DiscoveredMetric[]> {
    /** Zabbix value_type to human-readable type name */
    const VALUE_TYPE_MAP: Record<string, string> = {
      '0': 'gauge',   // Numeric (float)
      '1': 'text',    // Character
      '2': 'log',     // Log
      '3': 'counter', // Numeric (unsigned integer)
      '4': 'text',    // Text
    }

    interface ZabbixDiscoverItem {
      itemid: string
      name: string
      key_: string
      lastvalue: string
      units: string
      value_type: string
      state: string
      status: string
      description: string
      tags?: Array<{ tag: string; value: string }>
    }

    const items = await this.apiRequest<ZabbixDiscoverItem[]>('item.get', {
      output: ['itemid', 'name', 'key_', 'lastvalue', 'units', 'value_type', 'state', 'status', 'description'],
      selectTags: ['tag', 'value'],
      hostids: [hostId],
      filter: {
        status: '0',  // ITEM_STATUS_ACTIVE (enabled)
        state: '0',   // ITEM_STATE_NORMAL (active, not "not supported")
      },
      sortfield: 'name',
    })

    return items.map((item) => {
      const labels: Record<string, string> = {
        itemid: item.itemid,
        key: item.key_,
      }
      if (item.units) {
        labels.units = item.units
      }
      if (item.tags) {
        for (const tag of item.tags) {
          labels[`tag:${tag.tag}`] = tag.value
        }
      }

      return {
        name: item.name,
        labels,
        value: Number.parseFloat(item.lastvalue) || 0,
        help: item.description || undefined,
        type: VALUE_TYPE_MAP[item.value_type] || 'unknown',
      }
    })
  }

  // ============================================
  // AutoMappingCapable Implementation
  // ============================================

  async getMappingHints(graph: NetworkGraph): Promise<MappingHint[]> {
    const hints: MappingHint[] = []
    const allHosts = await this.getHosts()

    for (const node of graph.nodes) {
      const labelToTry = Array.isArray(node.label) ? node.label[0] : node.label
      const namesToTry = [node.id, labelToTry].filter(Boolean) as string[]

      let bestMatch: Host | null = null
      let bestConfidence = 0

      for (const name of namesToTry) {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '')

        for (const host of allHosts) {
          const normalizedHostName = host.name.toLowerCase().replace(/[^a-z0-9]/g, '')
          const normalizedDisplayName =
            host.displayName?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

          // Exact match
          if (normalizedHostName === normalizedName || normalizedDisplayName === normalizedName) {
            bestMatch = host
            bestConfidence = 1.0
            break
          }

          // Partial match
          if (
            normalizedHostName.includes(normalizedName) ||
            normalizedName.includes(normalizedHostName)
          ) {
            const confidence = 0.7
            if (confidence > bestConfidence) {
              bestMatch = host
              bestConfidence = confidence
            }
          }
        }

        if (bestConfidence === 1.0) break
      }

      hints.push({
        nodeId: node.id,
        suggestedHostId: bestMatch?.id,
        suggestedHostName: bestMatch?.name,
        confidence: bestConfidence,
      })
    }

    return hints
  }

  // ============================================
  // AlertsCapable Implementation
  // ============================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    // Zabbix severity mapping (Zabbix uses 0-5, we need to filter and map)
    const severityFilter = this.getSeverityFilter(options?.minSeverity)

    const timeFrom = Math.floor((Date.now() - (options?.timeRange || 3600) * 1000) / 1000)

    interface ZabbixProblem {
      eventid: string
      objectid: string
      name: string
      severity: string
      clock: string
      r_clock: string
      hosts?: Array<{ hostid: string; host: string; name: string }>
    }

    const params: Record<string, unknown> = {
      output: ['eventid', 'objectid', 'name', 'severity', 'clock', 'r_clock'],
      selectHosts: ['hostid', 'host', 'name'],
      recent: true,
      time_from: timeFrom,
      sortfield: ['clock'],
      sortorder: 'DESC',
    }

    // Filter by severity
    if (severityFilter.length > 0) {
      params.severities = severityFilter
    }

    // Filter by host IDs
    if (options?.hostIds && options.hostIds.length > 0) {
      params.hostids = options.hostIds
    }

    const problems = await this.apiRequest<ZabbixProblem[]>('problem.get', params)

    const alerts: Alert[] = problems.map((p) => ({
      id: p.eventid,
      severity: this.mapZabbixSeverity(p.severity),
      title: p.name,
      host: p.hosts?.[0]?.host,
      hostId: p.hosts?.[0]?.hostid,
      startTime: Number.parseInt(p.clock) * 1000,
      endTime: p.r_clock && p.r_clock !== '0' ? Number.parseInt(p.r_clock) * 1000 : undefined,
      status: p.r_clock && p.r_clock !== '0' ? 'resolved' : 'active',
      source: 'zabbix' as const,
      url: this.config
        ? `${this.config.url.replace(/\/$/, '')}/tr_events.php?triggerid=${p.objectid}&eventid=${p.eventid}`
        : undefined,
    }))

    // Filter active only if requested
    if (options?.activeOnly) {
      return alerts.filter((a) => a.status === 'active')
    }

    return alerts
  }

  private mapZabbixSeverity(severity: string): AlertSeverity {
    const severityMap: Record<string, AlertSeverity> = {
      '0': 'information', // Not classified
      '1': 'information', // Information
      '2': 'warning', // Warning
      '3': 'average', // Average
      '4': 'high', // High
      '5': 'disaster', // Disaster
    }
    return severityMap[severity] || 'information'
  }

  private getSeverityFilter(minSeverity?: AlertSeverity): number[] {
    if (!minSeverity) return []

    const severityOrder: AlertSeverity[] = ['information', 'warning', 'average', 'high', 'disaster']

    // Map our severity to Zabbix numeric values
    const severityToZabbix: Record<AlertSeverity, number[]> = {
      information: [0, 1],
      warning: [2],
      average: [3],
      high: [4],
      disaster: [5],
      ok: [],
    }

    const minIndex = severityOrder.indexOf(minSeverity)
    if (minIndex === -1) return []

    const result: number[] = []
    for (let i = minIndex; i < severityOrder.length; i++) {
      result.push(...severityToZabbix[severityOrder[i]])
    }
    return result
  }

  // ============================================
  // Internal Zabbix API Methods
  // ============================================

  /** Methods that must be called without Authorization header */
  private static readonly UNAUTHENTICATED_METHODS = new Set([
    'apiinfo.version',
    'user.login',
    'user.checkauthentication',
  ])

  private async apiRequest<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const id = ++this.requestId
    const url = this.config.url.replace(/\/$/, '') + '/api_jsonrpc.php'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json-rpc',
    }

    if (!ZabbixPlugin.UNAUTHENTICATED_METHODS.has(method)) {
      headers.Authorization = `Bearer ${this.config.token}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id,
      }),
    })

    if (!response.ok) {
      throw new Error(`Zabbix API request failed: ${response.status} ${response.statusText}`)
    }

    const result = (await response.json()) as {
      result?: T
      error?: { message: string; data: string }
    }

    if (result.error) {
      throw new Error(`Zabbix API error: ${result.error.message} - ${result.error.data}`)
    }

    return result.result as T
  }

  private async getHostAvailability(hostId: string): Promise<boolean> {
    const items = await this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'key_', 'lastvalue'],
      hostids: [hostId],
      search: { key_: ['agent.ping', 'icmpping'] },
      searchByAny: true,
    })

    for (const item of items) {
      if (item.lastvalue === '1') {
        return true
      }
    }

    return false
  }

  private async getItemsByIds(itemIds: string[]): Promise<ZabbixItem[]> {
    return this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock'],
      itemids: itemIds,
    })
  }

  /**
   * Extract interface name from Zabbix item name.
   * Handles patterns like:
   *   "Interface GigabitEthernet0/0(Uplink): Bits received" → "GigabitEthernet0/0"
   *   "Interface eth0: Incoming network traffic" → "eth0"
   */
  private static extractInterfaceName(itemName: string): string {
    // "Interface {name}({alias}): ..." or "Interface {name}: ..."
    const match = itemName.match(/^Interface\s+(.+?)(?:\(.*?\))?:\s/)
    return match ? match[1].trim() : itemName
  }

  /**
   * Get interface traffic items for a host.
   * Searches by both key pattern and item name to support
   * agent-based (net.if.in[eth0]) and SNMP-based (net.if.in[ifHCInOctets.N]) items.
   */
  async getInterfaceItems(
    hostId: string,
    interfaceName?: string,
  ): Promise<{ in: HostItem | null; out: HostItem | null }> {
    // Fetch all net.if.in / net.if.out items for this host
    const items = await this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
      hostids: [hostId],
      search: { key_: ['net.if.in', 'net.if.out'] },
      searchByAny: true,
      filter: { status: '0', state: '0' },
    })

    let inItem: HostItem | null = null
    let outItem: HostItem | null = null

    for (const item of items) {
      // Match by interface name extracted from item name (works for both agent and SNMP)
      if (interfaceName) {
        const extractedName = ZabbixPlugin.extractInterfaceName(item.name)
        if (extractedName !== interfaceName) {
          continue
        }
      }

      const hostItem: HostItem = {
        id: item.itemid,
        hostId: item.hostid,
        name: item.name,
        key: item.key_,
        lastValue: item.lastvalue,
      }

      if (item.key_.startsWith('net.if.in')) {
        inItem = hostItem
      } else if (item.key_.startsWith('net.if.out')) {
        outItem = hostItem
      }
    }

    return { in: inItem, out: outItem }
  }
}
