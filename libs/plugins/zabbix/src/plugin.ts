/**
 * Zabbix Data Source Plugin
 *
 * Provides metrics, hosts, and alerts capabilities.
 */

import type {
  Alert,
  AlertQueryOptions,
  AlertSeverity,
  AlertsCapable,
  ConfigOption,
  ConfigOptionsCapable,
  ConnectionResult,
  DataSourceCapability,
  DataSourcePlugin,
  DiscoveredMetric,
  Host,
  HostItem,
  HostsCapable,
  Identity,
  LinkMetricsMapping,
  MetricsCapable,
  MetricsData,
  MetricsMapping,
  MetricsStatus,
  MonitoringHealth,
  NetworkGraph,
  NodeMetrics,
  TopologyCapable,
} from '@shumoku/core'
import { addHttpWarning, mapWithConcurrency } from '@shumoku/core'
import { createHttpClient, type HttpClient } from '@shumoku/plugin-sdk'
import { convertZabbixToGraph } from './topology.js'
import type {
  ZabbixHost,
  ZabbixItem,
  ZabbixLldpNeighbor,
  ZabbixPluginConfig,
  ZabbixTopologyOptions,
} from './types.js'

/** Max in-flight Zabbix API calls during a metrics poll (was fully sequential). */
const POLL_CONCURRENCY = 8

/** Host ids per `item.get` when fetching LLDP items (bounds payload + round-trips). */
const LLDP_HOST_BATCH = 50

/**
 * Per-request timeout. The shared HttpClient defaults to 10s, but Zabbix
 * frontends behind a reverse proxy (or polling a large host) can take longer,
 * and the pre-HttpClient code had no timeout at all — 10s was a regression.
 * Matches the NetBox client's 30s.
 */
const REQUEST_TIMEOUT_MS = 30_000

/** Zabbix-specific link mapping with item IDs for direct item reference */
interface ZabbixLinkMapping extends LinkMetricsMapping {
  in?: string
  out?: string
}

/** Subset of item fields used by the health classifier. */
interface HealthItem {
  itemid: string
  key_: string
  lastclock: string
  lastvalue: string
}

/** Subset of host fields used by the health classifier. */
interface HostMeta {
  hostid: string
  maintenance_status?: string
  interfaces?: Array<{ available: string; error?: string }>
}

export class ZabbixPlugin
  implements
    DataSourcePlugin,
    MetricsCapable,
    HostsCapable,
    AlertsCapable,
    TopologyCapable,
    ConfigOptionsCapable
{
  readonly type = 'zabbix'
  readonly displayName = 'Zabbix'
  readonly capabilities: readonly DataSourceCapability[] = [
    'metrics',
    'hosts',
    'alerts',
    'topology',
  ]

  private config: ZabbixPluginConfig | null = null
  private requestId = 0
  /** Shared SDK client: timeout, Node-compatible insecure TLS, no credential logging. */
  private http: HttpClient | null = null

  initialize(config: unknown): void {
    this.config = config as ZabbixPluginConfig
    // Zabbix auth is per-method (apiinfo.version etc. must be unauthenticated),
    // so the client carries no global auth — the Bearer header is set per request.
    this.http = createHttpClient({
      baseUrl: this.config.url,
      insecure: this.config.insecure ?? false,
      timeoutMs: REQUEST_TIMEOUT_MS,
      defaultHeaders: { 'Content-Type': 'application/json-rpc' },
    })
  }

  dispose(): void {
    this.config = null
    this.http = null
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

    // Poll node metrics. Unmapped nodes get no entry — "no data" = unmapped.
    //
    // We also stay silent on host ids Zabbix doesn't know — in a
    // multi-source setup another plugin (Aruba, Prometheus, …) may be
    // the actual owner, and emitting a fake `pending` here would
    // clobber its real result during merge in the server.
    const nodeResults = await mapWithConcurrency(
      Object.entries(mapping.nodes || {}),
      POLL_CONCURRENCY,
      async ([nodeId, nodeMapping]) => {
        if (!nodeMapping.hostId) return null
        try {
          const node = await this.evaluateHostHealth(nodeMapping.hostId)
          return node ? ([nodeId, node] as const) : null
          // Transport / auth failure — let the absence speak. Future work:
          // emit `{ monitoring: 'failing' }` once we can tell a transport
          // error apart from "host not in this Zabbix".
        } catch {
          return null
        }
      },
    )
    for (const result of nodeResults) {
      if (result) metrics.nodes[result[0]] = result[1]
    }

    // Poll link metrics. Same silence rule as nodes — emit nothing
    // when the link doesn't resolve to a Zabbix-owned interface, so
    // another metrics source can fill it.
    const linkResults = await mapWithConcurrency(
      Object.entries(mapping.links || {}),
      POLL_CONCURRENCY,
      async ([linkId, baseLinkMapping]) => {
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

          if (!inItemId && !outItemId) return null // not a Zabbix-monitored link

          const itemIds = [inItemId, outItemId].filter(Boolean) as string[]
          const items = await this.getItemsByIds(itemIds)

          // Drop stale items — when a host goes unreachable Zabbix keeps the
          // last polled value indefinitely. Without this check we'd paint
          // utilization bars for a dead link from values minutes/hours old.
          const nowSec = Math.floor(Date.now() / 1000)
          let inBps = 0
          let outBps = 0
          let anyFresh = false
          for (const item of items) {
            const lastclock = (item as ZabbixItem & { lastclock?: string }).lastclock ?? '0'
            if (!ZabbixPlugin.isFreshClock(lastclock, nowSec)) continue
            anyFresh = true
            const value = Number.parseFloat(item.lastvalue) || 0
            if (item.itemid === inItemId) inBps = value
            else if (item.itemid === outItemId) outBps = value
          }

          // Stale data on a link Zabbix *does* own (items resolved) — emit an
          // explicit `unknown` so the renderer drops the weathermap flow rather
          // than animating hours-old values. Not the silence rule: a link is
          // owned by exactly one source, so this can't clobber another source.
          if (!anyFresh) return [linkId, { status: 'unknown' }] as const

          const capacity = linkMapping.bandwidth || 1_000_000_000
          const inUtil = (inBps / capacity) * 100
          const outUtil = (outBps / capacity) * 100
          const maxUtil = Math.max(inUtil, outUtil)

          return [
            linkId,
            {
              status: maxUtil > 0 ? 'up' : 'unknown',
              utilization: Math.ceil(maxUtil),
              inUtilization: Math.ceil(inUtil),
              outUtilization: Math.ceil(outUtil),
              inBps,
              outBps,
            },
          ] as const
        } catch {
          // Transport / auth failure — let the absence speak.
          return null
        }
      },
    )
    for (const result of linkResults) {
      if (result) metrics.links[result[0]] = result[1]
    }

    return metrics
  }

  // ============================================
  // NativeApiCapable (dev-only debug surface)
  // ============================================

  /**
   * Raw passthrough to Zabbix's JSON-RPC. Plugin author exposes this so
   * developers can call arbitrary methods (`item.get`, `host.get`,
   * `trigger.get`, …) with arbitrary params from the dev-mode
   * `/api/datasources/:id/_native` endpoint without needing a code
   * deploy each time the question changes shape during an investigation.
   */
  async nativeApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    return this.apiRequest<unknown>(method, params)
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    const zabbixHosts = await this.apiRequest<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status'],
      selectInterfaces: ['ip', 'dns', 'main', 'type', 'useip'],
    })

    return zabbixHosts.map((h) => {
      const mgmtIp = ZabbixPlugin.pickMgmtIp(h.interfaces)
      // Translate Zabbix's vocabulary into core's neutral identity at the
      // plugin boundary: the management interface IP is the strong key,
      // the technical host name doubles as a weak sysName fallback.
      const identity: Identity = {}
      if (mgmtIp) identity.mgmtIp = mgmtIp
      if (h.host) identity.sysName = h.host

      return {
        id: h.hostid,
        name: h.host,
        displayName: h.name,
        status: h.status === '0' ? 'up' : 'down',
        ...(mgmtIp ? { ip: mgmtIp } : {}),
        ...(Object.keys(identity).length > 0 ? { identity } : {}),
      }
    })
  }

  /**
   * Pick the management IP from a host's Zabbix interfaces: the default
   * (`main === '1'`) interface's IP wins, otherwise the first interface that
   * carries an IP. Interfaces configured to connect by DNS (no IP) are skipped.
   */
  private static pickMgmtIp(interfaces?: ZabbixHost['interfaces']): string | undefined {
    if (!interfaces || interfaces.length === 0) return undefined
    const withIp = interfaces.filter((i) => i.ip && i.ip.trim() !== '')
    if (withIp.length === 0) return undefined
    const main = withIp.find((i) => i.main === '1')
    return (main ?? withIp[0])?.ip
  }

  /**
   * Item-key prefixes that carry per-interface traffic counters, paired with
   * the direction they represent. Covers Zabbix Agent (`net.if.in/out`) and the
   * standard SNMP templates network gear actually uses — `ifHCInOctets` /
   * `ifHCOutOctets` (64-bit) and `ifInOctets` / `ifOutOctets` (32-bit). Without
   * the SNMP keys, interface lookup returns nothing for SNMP-monitored
   * switches/routers and link mapping can never resolve.
   */
  private static readonly TRAFFIC_KEY_DIRECTIONS: ReadonlyArray<readonly [string, 'in' | 'out']> = [
    ['net.if.in', 'in'],
    ['net.if.out', 'out'],
    ['ifHCInOctets', 'in'],
    ['ifHCOutOctets', 'out'],
    ['ifInOctets', 'in'],
    ['ifOutOctets', 'out'],
  ]

  /** Substrings passed to `item.get` search to pull every traffic item. */
  private static readonly TRAFFIC_KEY_SEARCH = ZabbixPlugin.TRAFFIC_KEY_DIRECTIONS.map(([k]) => k)

  /** Traffic direction a counter key represents, or null if it isn't one. */
  private static trafficDirection(key: string): 'in' | 'out' | null {
    for (const [prefix, dir] of ZabbixPlugin.TRAFFIC_KEY_DIRECTIONS) {
      if (key.startsWith(prefix)) return dir
    }
    return null
  }

  /**
   * Resolve the interface a traffic item belongs to. Both Agent and SNMP
   * templates put the interface name in the key bracket
   * (`net.if.in[eth0]`, `ifHCInOctets[GigabitEthernet1/0/1]`), sometimes with a
   * trailing " (alias)" — strip that. Fall back to parsing the item name.
   */
  private static interfaceNameOf(key: string, name: string): string {
    const bracket = key.match(/\[(.+)\]/)?.[1]
    if (bracket) return bracket.replace(/\s*\([^)]*\)\s*$/, '').trim()
    return ZabbixPlugin.extractInterfaceName(name)
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    // Fetch only network interface traffic items (net.if.in / net.if.out)
    const items = await this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'units'],
      hostids: [hostId],
      search: { key_: ZabbixPlugin.TRAFFIC_KEY_SEARCH },
      searchByAny: true,
      filter: { status: '0', state: '0' },
    })

    return items.flatMap((item) => {
      const direction = ZabbixPlugin.trafficDirection(item.key_)
      if (!direction) return [] // search is a substring match — drop incidental hits
      return [
        {
          id: item.itemid,
          hostId: item.hostid,
          name: item.name,
          key: item.key_,
          lastValue: item.lastvalue,
          unit: (item as ZabbixItem & { units?: string }).units,
          interfaceName: ZabbixPlugin.interfaceNameOf(item.key_, item.name),
          direction,
        } satisfies HostItem,
      ]
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
      output: [
        'itemid',
        'name',
        'key_',
        'lastvalue',
        'units',
        'value_type',
        'state',
        'status',
        'description',
      ],
      selectTags: ['tag', 'value'],
      hostids: [hostId],
      filter: {
        status: '0', // ITEM_STATUS_ACTIVE (enabled)
        state: '0', // ITEM_STATE_NORMAL (active, not "not supported")
      },
      sortfield: 'name',
    })

    return items.map((item) => {
      const labels: Record<string, string> = {
        itemid: item.itemid,
        key: item.key_,
      }
      if (item.units) {
        labels['units'] = item.units
      }
      if (item.tags) {
        for (const tag of item.tags) {
          labels[`tag:${tag.tag}`] = tag.value
        }
      }

      // Surface Zabbix's value_type as a label so callers that care
      // (e.g. for filtering non-numeric items out of charts) still see it
      // without core having to bless a "metric type" vocabulary.
      const ZABBIX_VALUE_TYPE: Record<string, string> = {
        '0': 'numeric_float',
        '1': 'character',
        '2': 'log',
        '3': 'numeric_unsigned',
        '4': 'text',
      }
      labels['__value_type'] = ZABBIX_VALUE_TYPE[item.value_type] || 'unknown'

      return {
        name: item.name,
        labels,
        value: Number.parseFloat(item.lastvalue) || 0,
        help: item.description || undefined,
      }
    })
  }

  // ============================================
  // AlertsCapable Implementation
  // ============================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    // Zabbix severity mapping (Zabbix uses 0-5, we need to filter and map)
    const severityFilter = this.getSeverityFilter(options?.minSeverity)

    const timeFrom = Math.floor((Date.now() - (options?.timeRange || 3600) * 1000) / 1000)

    interface ZabbixEvent {
      eventid: string
      objectid: string
      name: string
      severity: string
      clock: string
      /** '1' = problem (active), '0' = recovery (resolved) */
      value: string
      hosts?: Array<{ hostid: string; host: string; name: string }>
    }

    // Use event.get rather than problem.get: event.get has been stable across
    // Zabbix 3.x–7.x and continues to accept selectHosts, while problem.get
    // dropped selectHosts in 7.0 and tightened sortfield to 'eventid' only.
    const params: Record<string, unknown> = {
      output: ['eventid', 'objectid', 'name', 'severity', 'clock', 'value'],
      selectHosts: ['hostid', 'host', 'name'],
      source: 0, // EVENT_SOURCE_TRIGGERS
      object: 0, // EVENT_OBJECT_TRIGGER
      time_from: timeFrom,
      sortfield: ['clock'],
      sortorder: 'DESC',
    }

    // Filter by severity
    if (severityFilter.length > 0) {
      params['severities'] = severityFilter
    }

    // Filter by host IDs
    if (options?.hostIds && options.hostIds.length > 0) {
      params['hostids'] = options.hostIds
    }

    // Active-only: ask Zabbix for problem events only (value=1)
    if (options?.activeOnly) {
      params['value'] = 1
    }

    const events = await this.apiRequest<ZabbixEvent[]>('event.get', params)

    return events.map((e) => ({
      id: e.eventid,
      severity: this.mapZabbixSeverity(e.severity),
      title: e.name,
      host: e.hosts?.[0]?.host,
      hostId: e.hosts?.[0]?.hostid,
      startTime: Number.parseInt(e.clock, 10) * 1000,
      status: e.value === '1' ? 'active' : 'resolved',
      source: 'zabbix' as const,
      url: this.config
        ? `${this.config.url.replace(/\/$/, '')}/tr_events.php?triggerid=${e.objectid}&eventid=${e.eventid}`
        : undefined,
    }))
  }

  private mapZabbixSeverity(severity: string): AlertSeverity {
    // Zabbix priorities 0-5 → neutral severity buckets.
    const severityMap: Record<string, AlertSeverity> = {
      '0': 'info', // Not classified
      '1': 'info', // Information
      '2': 'low', // Warning
      '3': 'medium', // Average
      '4': 'high', // High
      '5': 'critical', // Disaster
    }
    return severityMap[severity] || 'info'
  }

  private getSeverityFilter(minSeverity?: AlertSeverity): number[] {
    if (!minSeverity) return []

    const severityOrder: AlertSeverity[] = ['info', 'low', 'medium', 'high', 'critical']

    // Map our severity to Zabbix numeric values
    const severityToZabbix: Record<AlertSeverity, number[]> = {
      info: [0, 1],
      low: [2],
      medium: [3],
      high: [4],
      critical: [5],
      ok: [],
    }

    const minIndex = severityOrder.indexOf(minSeverity)
    if (minIndex === -1) return []

    const result: number[] = []
    for (const o of severityOrder.slice(minIndex)) {
      result.push(...severityToZabbix[o])
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

  // ============================================
  // TopologyCapable Implementation
  // ============================================

  /**
   * Generate a NetworkGraph from Zabbix: nodes from hosts, links from per-host
   * LLDP neighbor items. Standard data only — no maps / netmap module, and no
   * direct SNMP reach (Zabbix is the collector). Scoped by `options.hostGroups`.
   * See `apps/server/docs/design/zabbix-lldp-topology.md`.
   */
  async fetchTopology(options?: Record<string, unknown>): Promise<NetworkGraph> {
    const opts = options as ZabbixTopologyOptions | undefined
    const groupIds = opts?.hostGroups?.filter(Boolean)

    const hosts = await this.apiRequest<ZabbixHost[]>('host.get', {
      ...(groupIds && groupIds.length > 0 ? { groupids: groupIds } : {}),
      output: ['hostid', 'host', 'name', 'status'],
      selectInterfaces: ['ip', 'dns', 'main', 'type', 'useip'],
      selectInventory: ['type', 'vendor', 'model', 'hardware', 'os', 'serialno_a', 'location'],
      selectHostGroups: ['groupid', 'name'],
      selectTags: 'extend',
    })

    const { neighborsByHostId, sysDescrByHostId } = await this.fetchLldpData(
      hosts.map((h) => h.hostid),
    )

    const sourceId = this.config?.instanceId ?? 'zabbix'
    return convertZabbixToGraph(hosts, neighborsByHostId, sysDescrByHostId, {
      sourceId,
      observedAt: Date.now(),
      groupBy: opts?.groupBy,
      groupExclude: opts?.groupExclude,
      includeExternalNeighbors: opts?.includeExternalNeighbors,
      parentTag: opts?.parentTag,
    })
  }

  /**
   * Assemble, per host: (a) LLDP adjacencies from the standard LLDP-MIB items
   * (`lldp.rem.*` + `lldp.loc.if.ifSpeed`), joined per interface by the `[ifName]`
   * suffix in the item NAME (item keys are inconsistently shaped across families);
   * and (b) the host's own SNMP sysDescr (`lldp.sys.desc` / `system.descr`) for
   * device-type derivation. Items are fetched in host-id batches. Hosts without
   * `lldp.rem.*` items yield no neighbors (→ nodes-only).
   */
  private async fetchLldpData(hostIds: string[]): Promise<{
    neighborsByHostId: Map<string, ZabbixLldpNeighbor[]>
    sysDescrByHostId: Map<string, string>
  }> {
    const neighborsByHostId = new Map<string, ZabbixLldpNeighbor[]>()
    const sysDescrByHostId = new Map<string, string>()
    if (hostIds.length === 0) return { neighborsByHostId, sysDescrByHostId }

    const families = [
      'lldp.rem.sysname',
      'lldp.rem.port.id',
      'lldp.rem.chassisid',
      'lldp.loc.if.ifSpeed',
      'lldp.loc.if.ifHighSpeed',
      'lldp.sys.desc',
      'lldp.loc.sys.desc',
      'system.descr',
      'sysDescr',
    ]
    // the host's OWN sysDescr (NOT the per-neighbor lldp.rem.sys.desc)
    const sysDescrKeys = new Set(['lldp.sys.desc', 'lldp.loc.sys.desc'])
    const batches = Array.from({ length: Math.ceil(hostIds.length / LLDP_HOST_BATCH) }, (_, i) =>
      hostIds.slice(i * LLDP_HOST_BATCH, (i + 1) * LLDP_HOST_BATCH),
    )
    const ifSuffix = /\[([^\]]+)\]\s*$/

    const itemArrays = await mapWithConcurrency(batches, POLL_CONCURRENCY, (batch) =>
      this.apiRequest<Array<{ hostid: string; name: string; key_: string; lastvalue: string }>>(
        'item.get',
        {
          hostids: batch,
          search: { key_: families },
          searchByAny: true,
          output: ['hostid', 'name', 'key_', 'lastvalue'],
        },
      ),
    )

    // group LLDP per-IF data: hostid → ifName → { family: value }; capture sysDescr.
    const byHostIf = new Map<string, Map<string, Record<string, string>>>()
    for (const items of itemArrays) {
      for (const it of items) {
        const family = it.key_.split('[')[0] ?? ''
        if (
          sysDescrKeys.has(family) ||
          family.startsWith('system.descr') ||
          family === 'sysDescr'
        ) {
          const v = (it.lastvalue ?? '').trim()
          // a real sysDescr has spaces; ignore degenerate hostname echoes
          if (v && /\s/.test(v)) {
            const cur = sysDescrByHostId.get(it.hostid)
            if (!cur || v.length > cur.length) sysDescrByHostId.set(it.hostid, v)
          }
          continue
        }
        const ifName = it.name.match(ifSuffix)?.[1]
        if (!ifName) continue
        let ifMap = byHostIf.get(it.hostid)
        if (!ifMap) {
          ifMap = new Map()
          byHostIf.set(it.hostid, ifMap)
        }
        const fields = ifMap.get(ifName) ?? {}
        fields[family] = it.lastvalue
        ifMap.set(ifName, fields)
      }
    }

    for (const [hostId, ifMap] of byHostIf) {
      const neighbors: ZabbixLldpNeighbor[] = []
      for (const [ifName, f] of ifMap) {
        const remSysname = f['lldp.rem.sysname']
        if (!remSysname) continue
        const speedBps =
          Number(f['lldp.loc.if.ifSpeed']) ||
          Number(f['lldp.loc.if.ifHighSpeed']) * 1_000_000 ||
          undefined
        neighbors.push({
          localIf: ifName,
          remSysname,
          remPortId: f['lldp.rem.port.id'],
          remChassisId: f['lldp.rem.chassisid'],
          speedBps,
        })
      }
      if (neighbors.length > 0) neighborsByHostId.set(hostId, neighbors)
    }
    return { neighborsByHostId, sysDescrByHostId }
  }

  // ============================================
  // ConfigOptionsCapable Implementation
  // ============================================

  /** Dynamic candidates for `optionsSource` schema fields (the host-group filter). */
  async getConfigOptions(key: string): Promise<ConfigOption[]> {
    if (key !== 'hostgroup') return []
    const groups = await this.apiRequest<Array<{ groupid: string; name: string }>>(
      'hostgroup.get',
      {
        output: ['groupid', 'name'],
        sortfield: 'name',
      },
    )
    return groups.map((g) => ({ value: g.groupid, label: g.name }))
  }

  private async apiRequest<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.config || !this.http) {
      throw new Error('Plugin not initialized')
    }

    const id = ++this.requestId

    const headers: Record<string, string> = {}
    if (!ZabbixPlugin.UNAUTHENTICATED_METHODS.has(method)) {
      headers['Authorization'] = `Bearer ${this.config.token}`
    }

    // JSON-RPC always returns HTTP 200 with an `error` envelope on failure, so
    // HttpClient won't throw — we inspect the body below. HttpClient still
    // handles transport, timeout, and Node-compatible insecure TLS.
    const result = await this.http.json<{
      result?: T
      error?: { message: string; data: string }
    }>('/api_jsonrpc.php', {
      method: 'POST',
      headers,
      body: { jsonrpc: '2.0', method, params, id },
    })

    if (result.error) {
      throw new Error(`Zabbix API error: ${result.error.message} - ${result.error.data}`)
    }

    return result.result as T
  }

  /** Maximum staleness (seconds) for an item value to count as "fresh". */
  private static readonly LIVE_DATA_WINDOW_SEC = 300

  /** True iff a Zabbix `lastclock` timestamp falls within the freshness window. */
  private static isFreshClock(lastclock: string, nowSec: number): boolean {
    const t = Number(lastclock)
    return t > 0 && nowSec - t < ZabbixPlugin.LIVE_DATA_WINDOW_SEC
  }

  /** Item keys produced by Zabbix's ICMP poller. */
  private static isIcmpKey(key: string): boolean {
    return key === 'icmpping' || key.startsWith('icmpping[')
  }

  /**
   * Item keys whose `lastclock` reflects Zabbix server activity rather than
   * the device responding. Excluded from "device is alive" inference.
   */
  private static isZabbixInternalKey(key: string): boolean {
    return key.startsWith('zabbix[')
  }

  /**
   * Decide whether a Zabbix host is reachable.
   *
   * We treat the host as up when **any enabled item has fresh data** within
   * the last few minutes. This is monitoring-style agnostic: Agent, SNMP,
   * IPMI, and external scripts all stamp `lastclock` when they store a
   * value, so we don't need separate logic per protocol.
   *
   * Earlier approaches were too narrow:
   * - `agent.ping`/`icmpping` lookup: missed SNMP-only network gear which
   *   has neither item, marking healthy switches as down.
   * - Per-interface `available` flag: not reliably updated on SNMP-only
   *   interfaces in some Zabbix configurations — interfaces stay at
   *   "unknown" even while items poll successfully.
   */
  /**
   * Compute a node's device-state + monitoring-path health by combining two
   * independent signals from Zabbix.
   *
   *  - **Device state** is whether the equipment itself is responding. The
   *    cleanest direct evidence is an ICMP-ping item value — non-zero =
   *    reachable, zero = unreachable. Otherwise we infer `up` from any fresh
   *    item data, and fall back to `unknown` when we have no evidence.
   *  - **Monitoring path** is whether Zabbix can collect data at all. The
   *    host's maintenance flag wins (operator-driven mute); otherwise we
   *    read per-interface `available` (the same value Zabbix paints in its
   *    own UI as the green/red/grey dot).
   *
   * Issued as two parallel API calls so a 50-host topology doesn't pay a
   * sequential round-trip cost per node.
   */
  private async evaluateHostHealth(hostId: string): Promise<NodeMetrics | undefined> {
    const [items, host] = await Promise.all([
      this.fetchHealthItems(hostId),
      this.fetchHostMeta(hostId),
    ])
    // Zabbix returns no host record + no items → this hostId isn't in
    // *this* Zabbix tenant. Stay silent so a different metrics source
    // in the poll loop can own the node.
    if (!host && items.length === 0) return undefined
    const nowSec = Math.floor(Date.now() / 1000)
    const device = ZabbixPlugin.classifyDevice(items, nowSec)
    const monitoring = ZabbixPlugin.classifyMonitoring(host, items, nowSec)
    return {
      status: device.status,
      ...(device.lastSeen !== undefined && { lastSeen: device.lastSeen }),
      monitoring: monitoring.health,
      ...(monitoring.error !== undefined && { monitoringError: monitoring.error }),
    }
  }

  // ---- Signal collection ------------------------------------------------

  private async fetchHealthItems(hostId: string): Promise<HealthItem[]> {
    return this.apiRequest<HealthItem[]>('item.get', {
      output: ['itemid', 'key_', 'lastclock', 'lastvalue'],
      hostids: [hostId],
      filter: { status: '0', state: '0' },
    })
  }

  private async fetchHostMeta(hostId: string): Promise<HostMeta | undefined> {
    const hosts = await this.apiRequest<HostMeta[]>('host.get', {
      output: ['hostid', 'maintenance_status'],
      hostids: [hostId],
      selectInterfaces: ['available', 'error'],
    })
    return hosts[0]
  }

  // ---- Pure classifiers -------------------------------------------------

  /**
   * Map raw items into a device-state verdict.
   *
   * Rules in priority order:
   *
   * 1. **Fresh ICMP wins.** `icmpping=1` → up, `icmpping=0` → down.
   *    Zabbix's own ICMP poller is the cleanest direct "the device is on
   *    the network" signal — when it has a recent verdict, trust it over
   *    anything else, including SNMP polls that may be returning cached or
   *    Zabbix-internal data after the device disappeared.
   * 2. **No ICMP, but real device data is fresh → up.** SNMP / agent items
   *    polled *from* the device count, but we exclude `zabbix[...]` keys
   *    (Zabbix server's internal metrics about the host, e.g. the
   *    `zabbix[host,snmp,available]` flag) — those stay fresh even after
   *    the device goes offline because they reflect the *poller's* state,
   *    not the device's.
   * 3. **No fresh signals at all → `unknown`.**
   *
   * Note: ICMP false-positive cases (ping filtered by ACL while SNMP works
   * fine) are not handled here — the operator should disable / remove the
   * misleading icmpping item if the device's ICMP is intentionally blocked.
   */
  private static classifyDevice(
    items: HealthItem[],
    nowSec: number,
  ): { status: MetricsStatus; lastSeen?: number } {
    const fresh = (i: HealthItem) => ZabbixPlugin.isFreshClock(i.lastclock, nowSec)
    // 1. Fresh ICMP — authoritative.
    const icmp = items.find((i) => ZabbixPlugin.isIcmpKey(i.key_) && fresh(i))
    if (icmp) {
      return icmp.lastvalue === '0' ? { status: 'down' } : { status: 'up', lastSeen: Date.now() }
    }
    // 2. No ICMP signal — fall back to any real device data, skipping Zabbix
    //    server-internal items that don't actually prove the device is up.
    if (
      items.some(
        (i) =>
          !ZabbixPlugin.isIcmpKey(i.key_) && !ZabbixPlugin.isZabbixInternalKey(i.key_) && fresh(i),
      )
    ) {
      return { status: 'up', lastSeen: Date.now() }
    }
    // 3. No evidence either way.
    return { status: 'unknown' }
  }

  /**
   * Map raw host info → monitoring-path health. Mirrors what Zabbix shows
   * the operator in its host list (green/red/grey + "in maintenance").
   */
  private static classifyMonitoring(
    host: HostMeta | undefined,
    items: HealthItem[],
    nowSec: number,
  ): { health: MonitoringHealth; error?: string } {
    if (host?.maintenance_status === '1') return { health: 'paused' }
    const failingIface = host?.interfaces?.find((i) => i.available === '2')
    if (failingIface) {
      return { health: 'failing', error: failingIface.error || undefined }
    }
    const hasFreshData = items.some((i) => ZabbixPlugin.isFreshClock(i.lastclock, nowSec))
    return { health: hasFreshData ? 'healthy' : 'pending' }
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
    return match?.[1] ? match[1].trim() : itemName
  }

  /**
   * Get interface traffic items for a host.
   * Searches Agent (`net.if.in[eth0]`) and SNMP
   * (`ifHCInOctets[GigabitEthernet1/0/1]`) counter keys and matches the
   * requested interface by the name resolved from each item's key bracket.
   */
  async getInterfaceItems(
    hostId: string,
    interfaceName?: string,
  ): Promise<{ in: HostItem | null; out: HostItem | null }> {
    const items = await this.apiRequest<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue'],
      hostids: [hostId],
      search: { key_: ZabbixPlugin.TRAFFIC_KEY_SEARCH },
      searchByAny: true,
      filter: { status: '0', state: '0' },
    })

    let inItem: HostItem | null = null
    let outItem: HostItem | null = null

    for (const item of items) {
      const direction = ZabbixPlugin.trafficDirection(item.key_)
      if (!direction) continue

      // Match by interface name resolved from the key (works for Agent + SNMP)
      if (interfaceName && ZabbixPlugin.interfaceNameOf(item.key_, item.name) !== interfaceName) {
        continue
      }

      const hostItem: HostItem = {
        id: item.itemid,
        hostId: item.hostid,
        name: item.name,
        key: item.key_,
        lastValue: item.lastvalue,
      }

      if (direction === 'in') inItem = hostItem
      else outItem = hostItem
    }

    return { in: inItem, out: outItem }
  }
}
