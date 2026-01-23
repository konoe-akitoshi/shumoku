/**
 * Zabbix Data Source Plugin
 *
 * Provides metrics, hosts, and auto-mapping capabilities.
 */

import type { NetworkGraph } from '@shumoku/core'
import type { MetricsData, ZabbixMapping, ZabbixHost, ZabbixItem } from '../types.js'
import type {
  DataSourcePlugin,
  DataSourceCapability,
  MetricsCapable,
  HostsCapable,
  AutoMappingCapable,
  ConnectionResult,
  Host,
  HostItem,
  MappingHint,
  ZabbixPluginConfig,
} from './types.js'

export class ZabbixPlugin
  implements DataSourcePlugin, MetricsCapable, HostsCapable, AutoMappingCapable
{
  readonly type = 'zabbix'
  readonly displayName = 'Zabbix'
  readonly capabilities: readonly DataSourceCapability[] = ['metrics', 'hosts', 'auto-mapping']

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
    try {
      const version = await this.apiRequest<string>('apiinfo.version')
      return {
        success: true,
        message: `Connected to Zabbix ${version}`,
        version,
      }
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

  async pollMetrics(mapping: ZabbixMapping): Promise<MetricsData> {
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
    for (const [linkId, linkMapping] of Object.entries(mapping.links || {})) {
      if (linkMapping.in || linkMapping.out) {
        try {
          const itemIds = [linkMapping.in, linkMapping.out].filter(Boolean) as string[]
          const items = await this.getItemsByIds(itemIds)

          let inBps = 0
          let outBps = 0

          for (const item of items) {
            const value = Number.parseFloat(item.lastvalue) || 0
            if (item.itemid === linkMapping.in) {
              inBps = value
            } else if (item.itemid === linkMapping.out) {
              outBps = value
            }
          }

          const capacity = linkMapping.capacity || 1_000_000_000
          const inUtil = (inBps / capacity) * 100
          const outUtil = (outBps / capacity) * 100
          const maxUtil = Math.max(inUtil, outUtil)

          metrics.links[linkId] = {
            status: maxUtil > 0 ? 'up' : 'unknown',
            utilization: Math.round(maxUtil * 10) / 10,
            inUtilization: Math.round(inUtil * 10) / 10,
            outUtilization: Math.round(outUtil * 10) / 10,
            inBps,
            outBps,
          }
        } catch {
          metrics.links[linkId] = { status: 'unknown' }
        }
      } else {
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
    const items = await this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'units'],
      hostids: [hostId],
    })

    return items.map((item) => ({
      id: item.itemid,
      hostId: item.hostid,
      name: item.name,
      key: item.key_,
      lastValue: item.lastvalue,
      unit: (item as ZabbixItem & { units?: string }).units,
    }))
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
  // Internal Zabbix API Methods
  // ============================================

  private async apiRequest<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const id = ++this.requestId
    const url = this.config.url.replace(/\/$/, '') + '/api_jsonrpc.php'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-rpc',
        Authorization: `Bearer ${this.config.token}`,
      },
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
   * Get interface traffic items for a host
   */
  async getInterfaceItems(
    hostId: string,
    interfaceName?: string,
  ): Promise<{ in: HostItem | null; out: HostItem | null }> {
    const keys = interfaceName
      ? [`net.if.in[${interfaceName}]`, `net.if.out[${interfaceName}]`]
      : ['net.if.in', 'net.if.out']

    const items = await this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
      hostids: [hostId],
      search: { key_: keys },
      searchByAny: true,
    })

    let inItem: HostItem | null = null
    let outItem: HostItem | null = null

    for (const item of items) {
      const hostItem: HostItem = {
        id: item.itemid,
        hostId: item.hostid,
        name: item.name,
        key: item.key_,
        lastValue: item.lastvalue,
      }

      if (item.key_.startsWith('net.if.in')) {
        if (!inItem || (interfaceName && item.key_.includes(interfaceName))) {
          inItem = hostItem
        }
      } else if (item.key_.startsWith('net.if.out')) {
        if (!outItem || (interfaceName && item.key_.includes(interfaceName))) {
          outItem = hostItem
        }
      }
    }

    return { in: inItem, out: outItem }
  }
}
