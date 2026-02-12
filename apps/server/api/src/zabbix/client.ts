/**
 * Zabbix API Client
 * Handles communication with Zabbix server
 */

import type { ZabbixConfig, ZabbixHost, ZabbixItem } from '../types.js'

export class ZabbixClient {
  private config: ZabbixConfig
  private requestId = 0

  constructor(config: ZabbixConfig) {
    this.config = config
  }

  /**
   * Make a Zabbix API request
   */
  async apiRequest<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.requestId
    const url = `${this.config.url.replace(/\/$/, '')}/api_jsonrpc.php`

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
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

  /**
   * Get Zabbix API version
   */
  async getApiVersion(): Promise<string> {
    return this.apiRequest<string>('apiinfo.version')
  }

  /**
   * Get all hosts
   */
  async getHosts(): Promise<ZabbixHost[]> {
    return this.apiRequest<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
    })
  }

  /**
   * Get host by name
   */
  async getHostByName(hostName: string): Promise<ZabbixHost | null> {
    const hosts = await this.apiRequest<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
      filter: { host: [hostName] },
    })
    return hosts[0] || null
  }

  /**
   * Get host by ID
   */
  async getHostById(hostId: string): Promise<ZabbixHost | null> {
    const hosts = await this.apiRequest<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
      hostids: [hostId],
    })
    return hosts[0] || null
  }

  /**
   * Get items for a host
   */
  async getHostItems(
    hostId: string,
    keys?: string[],
    extraOutput?: string[],
  ): Promise<ZabbixItem[]> {
    const output = ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock']
    if (extraOutput) output.push(...extraOutput)
    const params: Record<string, unknown> = {
      output,
      hostids: [hostId],
    }

    if (keys && keys.length > 0) {
      params.search = { key_: keys }
      params.searchByAny = true
    }

    return this.apiRequest<ZabbixItem[]>('item.get', params)
  }

  /**
   * Search hosts by name
   */
  async searchHosts(query: string): Promise<ZabbixHost[]> {
    return this.apiRequest<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
      search: { host: query, name: query },
      searchByAny: true,
    })
  }

  /**
   * Get specific items by IDs
   */
  async getItemsByIds(itemIds: string[]): Promise<ZabbixItem[]> {
    return this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock'],
      itemids: itemIds,
    })
  }

  /**
   * Get network interface traffic items for a host
   */
  async getInterfaceTraffic(
    hostId: string,
    interfaceName?: string,
  ): Promise<{ in: ZabbixItem | null; out: ZabbixItem | null }> {
    const keys = interfaceName
      ? [`net.if.in[${interfaceName}]`, `net.if.out[${interfaceName}]`]
      : ['net.if.in', 'net.if.out']

    const items = await this.getHostItems(hostId, keys)

    let inItem: ZabbixItem | null = null
    let outItem: ZabbixItem | null = null

    for (const item of items) {
      if (item.key_.startsWith('net.if.in')) {
        if (!inItem || (interfaceName && item.key_.includes(interfaceName))) {
          inItem = item
        }
      } else if (item.key_.startsWith('net.if.out')) {
        if (!outItem || (interfaceName && item.key_.includes(interfaceName))) {
          outItem = item
        }
      }
    }

    return { in: inItem, out: outItem }
  }

  /**
   * Check if host is available (agent.ping or icmpping)
   */
  async getHostAvailability(hostId: string): Promise<boolean> {
    const items = await this.getHostItems(hostId, ['agent.ping', 'icmpping'])

    for (const item of items) {
      if (item.lastvalue === '1') {
        return true
      }
    }

    return false
  }

  /**
   * Test connection to Zabbix server
   */
  async testConnection(): Promise<boolean> {
    try {
      const version = await this.getApiVersion()
      console.log(`[Zabbix] Connected to Zabbix ${version}`)
      return true
    } catch (err) {
      console.error('[Zabbix] Connection failed:', err)
      return false
    }
  }
}
