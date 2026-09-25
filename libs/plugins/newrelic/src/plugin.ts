import type {
  AlertQueryOptions,
  AlertsCapable,
  DataSourcePlugin,
  DiscoveredMetric,
  Host,
  HostItem,
  HostsCapable,
  InterfaceNeighbor,
  MetricsCapable,
  MetricsData,
  MetricsMapping,
  NetworkGraph,
  TopologyCapable,
} from '@shumoku/core'
import { flattenObject, validateAgainstSchema } from '@shumoku/core/plugin-kit'
import { issueAlerts, readIssues } from './alerts.js'
import { NewRelicClient } from './client.js'
import { configSchema, type NewRelicConfig } from './config.js'
import { deviceNode, type Inventory, readInventory } from './inventory.js'
import { resolveNeighbors } from './neighbors.js'
import { readPortMetrics } from './port-metrics.js'
import { linkMetrics, nodeMetrics } from './telemetry.js'
import { fresh, literal, num, type Row, source, str, windowAt } from './values.js'

export { linkMetrics, nodeMetrics } from './telemetry.js'

export class NewRelicPlugin
  implements DataSourcePlugin, HostsCapable, MetricsCapable, TopologyCapable, AlertsCapable
{
  readonly type = 'newrelic'
  readonly displayName = 'New Relic'
  readonly capabilities = ['topology', 'hosts', 'metrics', 'alerts'] as const
  private client?: NewRelicClient
  private config?: NewRelicConfig
  private cached?: Inventory
  private pending?: Promise<Inventory>
  private generation = 0

  initialize(value: unknown): void {
    const validation = validateAgainstSchema(configSchema, value)
    if (!validation.ok) throw new Error('Invalid New Relic configuration')
    const config = value as NewRelicConfig
    if (
      !Number.isSafeInteger(config.accountId) ||
      config.accountId < 1 ||
      !config.apiKey.trim() ||
      !['US', 'EU', 'JP'].includes(config.region)
    )
      throw new Error('Invalid New Relic configuration')
    this.dispose()
    this.config = { ...config }
    this.client = new NewRelicClient(config)
  }
  dispose(): void {
    this.client?.dispose()
    this.client = undefined
    this.config = undefined
    this.generation++
    this.cached = undefined
    this.pending = undefined
  }
  private connection(): NewRelicClient {
    if (!this.client) throw new Error('New Relic plugin is not initialized')
    return this.client
  }
  async testConnection() {
    return this.connection().testConnection()
  }
  private inventory(force = false): Promise<Inventory> {
    if (this.pending) return this.pending
    if (!force && this.cached && Date.now() - this.cached.asOf < 60_000)
      return Promise.resolve(this.cached)
    if (!this.config) throw new Error('New Relic plugin is not initialized')
    const generation = this.generation
    const pending = readInventory(this.connection(), this.config, Date.now())
      .then((value) => {
        if (generation !== this.generation)
          throw new Error('New Relic configuration changed during query')
        this.cached = value
        return value
      })
      .finally(() => {
        if (this.pending === pending) this.pending = undefined
      })
    this.pending = pending
    return pending
  }
  async getAlerts(options: AlertQueryOptions = {}) {
    if (!this.config) throw new Error('New Relic plugin is not initialized')
    const inventory = await this.inventory()
    const ids = new Map(inventory.devices.map((d) => [d.guid, d.host.id]))
    const rows = await readIssues(this.connection(), this.config.accountId, options)
    return issueAlerts(
      rows.map((row) => ({
        ...row,
        entityGuids: Array.isArray(row['entityGuids'])
          ? row['entityGuids'].map((g) => (typeof g === 'string' ? (ids.get(g) ?? g) : g))
          : [],
      })),
      options,
      Date.now(),
    )
  }
  async getHosts(): Promise<Host[]> {
    return (await this.inventory()).devices.map((d) => d.host)
  }
  private async neighbors(inventory: Inventory) {
    if (this.config?.neighborMode === 'disabled')
      return { links: [], adjacencies: [], warnings: ['Neighbor discovery disabled'] }
    const window = windowAt(inventory.asOf, 86400)
    // Index is the complete LLDP remote row index, not an IF-MIB ifIndex.
    const rows = await this.connection().nrql(
      `SELECT latest(entity.guid) AS guid, latest(lldpRemSysName) AS remoteName, latest(lldpRemChassisId) AS remoteChassis, latest(lldpRemPortId) AS remotePort, latest(lldpRemPortIdSubtype) AS remotePortSubtype, latest(timestamp) AS seen ${source} AND ` +
        `\`mib-name\` = 'LLDP-MIB' AND lldpRemPortId IS NOT NULL FACET entity.guid, Index LIMIT MAX ${window}`,
    )
    if (!rows.length) {
      if (this.config?.neighborMode === 'required')
        throw new Error(
          'No LLDP neighbor observations; verify collector profiles and device access',
        )
      return {
        links: [],
        adjacencies: [],
        warnings: ['No LLDP neighbor observations; physical links cannot be determined'],
      }
    }
    const locals = await this.connection().nrql(
      `SELECT latest(entity.guid) AS guid, latest(lldpLocPortId) AS name, latest(lldpLocPortIdSubtype) AS subtype, latest(timestamp) AS seen ${source} AND lldpLocPortId IS NOT NULL FACET entity.guid, Index LIMIT MAX ${window}`,
    )
    for (const row of rows) {
      const facet = row['facet']
      const remoteIndex = Array.isArray(facet) ? str(facet[1]) : undefined
      const localNumber =
        remoteIndex && /^\d+\.\d+\.\d+$/.test(remoteIndex) ? remoteIndex.split('.')[1] : undefined
      const matches = locals.filter(
        (l) =>
          l['guid'] === row['guid'] &&
          Array.isArray(l['facet']) &&
          String(l['facet'][1]) === localNumber,
      )
      const local = matches.length === 1 ? matches[0] : undefined
      if (
        local &&
        fresh(local['seen'], inventory.asOf, 7200) &&
        (local['subtype'] === 'interfaceName' || local['subtype'] === 5)
      )
        row['localName'] = local['name']
    }
    const result = resolveNeighbors(inventory.devices, rows, inventory.asOf)
    if (this.config?.neighborMode === 'required' && result.warnings.length)
      throw new Error(result.warnings[0])
    return result
  }
  async fetchTopology(): Promise<NetworkGraph> {
    const inventory = await this.inventory(true)
    const neighbors = await this.neighbors(inventory)
    const warnings = [...inventory.warnings, ...neighbors.warnings]
    return {
      version: '1',
      name: 'New Relic',
      nodes: inventory.devices.map((d) => {
        const node = deviceNode(d)
        return { ...node, metadata: { ...node.metadata, sourceDiagnostics: warnings } }
      }),
      links: neighbors.links,
    }
  }
  async getInterfaceNeighbors(hostId: string): Promise<InterfaceNeighbor[]> {
    const inventory = await this.inventory()
    return (await this.neighbors(inventory)).adjacencies
      .filter((a) => a.hostId === hostId)
      .map((a) => a.neighbor)
  }
  async getHostItems(hostId: string): Promise<HostItem[]> {
    const device = (await this.inventory()).devices.find((d) => d.host.id === hostId)
    return (
      device?.ports.flatMap((p) =>
        (['in', 'out'] as const).map((direction) => ({
          id: `${p.name}:${direction}`,
          key: `${p.name}:${direction}`,
          hostId,
          name: `${p.name} ${direction}`,
          interfaceName: p.name,
          interfaceIdentity: p.port.identity,
          direction,
          unit: 'bps',
        })),
      ) ?? []
    )
  }
  async discoverMetrics(hostId: string): Promise<DiscoveredMetric[]> {
    const device = (await this.inventory()).devices.find((d) => d.host.id === hostId)
    if (!device) return []
    const now = Date.now()
    const output = flattenObject(device.raw, 'inventory', {
      hostId,
      scope: 'device',
      freshness: 'historical',
    })
    for (const p of device.ports)
      output.push(
        ...flattenObject(p.raw, 'inventory', {
          hostId,
          scope: 'interface',
          interfaceName: p.name,
          freshness: fresh(p.raw['seen'], now, this.config?.snmpFreshnessSeconds)
            ? 'recent'
            : 'historical',
          observedAt: num(p.raw['seen'])
            ? new Date(Number(p.raw['seen'])).toISOString()
            : 'unknown',
        }),
      )
    const filter = device.infra
      ? `FROM SystemSample WHERE entityGuid=${literal(device.guid)}`
      : `${source} AND entity.guid=${literal(device.guid)}`
    const window = windowAt(now, 86400)
    const keys = await this.connection().nrql(`SELECT keyset() ${filter} ${window}`)
    const names = [
      ...new Set(
        keys.flatMap((r) => {
          const key = str(r['key'])
          return key && /^[a-zA-Z0-9_.:-]+$/.test(key) ? [key] : []
        }),
      ),
    ]
    for (const offset of Array.from({ length: Math.ceil(names.length / 20) }, (_, i) => i * 20)) {
      const batch = names.slice(offset, offset + 20)
      const select = batch
        .flatMap((name, i) => [
          `latest(\`${name}\`) AS value${i}`,
          `filter(latest(timestamp),WHERE \`${name}\` IS NOT NULL) AS seen${i}`,
        ])
        .join(',')
      const scopes = device.infra
        ? [{ scope: 'device', condition: '', facet: '' }]
        : [
            { scope: 'device', condition: ' AND if_Index IS NULL', facet: '' },
            {
              scope: 'interface',
              condition: ' AND if_interface_name IS NOT NULL',
              facet: 'FACET if_interface_name LIMIT MAX',
            },
          ]
      for (const scope of scopes) {
        const rows = await this.connection().nrql(
          `SELECT count(*) AS samples,${select} ${filter}${scope.condition} ${scope.facet} ${window}`,
        )
        for (const row of rows)
          for (const [i, name] of batch.entries()) {
            const seen = num(row[`seen${i}`])
            output.push(
              ...flattenObject({ [name]: row[`value${i}`] }, 'newrelic', {
                hostId,
                scope: scope.scope,
                ...(str(row['facet']) ? { interfaceName: String(row['facet']) } : {}),
                observedAt: seen ? new Date(seen).toISOString() : 'unknown',
                freshness: fresh(
                  seen,
                  now,
                  device.infra
                    ? (this.config?.infraFreshnessSeconds ?? 1200)
                    : (this.config?.snmpFreshnessSeconds ?? 180),
                )
                  ? 'recent'
                  : 'historical',
              }),
            )
          }
      }
    }
    if (device.infra) {
      const rows = await this.connection().nrql(
        `SELECT latest(*) FROM NetworkSample WHERE entityGuid=${literal(device.guid)} FACET interfaceName LIMIT MAX ${window}`,
      )
      for (const row of rows)
        output.push(
          ...flattenObject(row, 'newrelic', {
            hostId,
            scope: 'interface',
            interfaceName: str(row['facet']) ?? 'unknown',
          }),
        )
    }
    const freshness = device.infra
      ? (this.config?.infraFreshnessSeconds ?? 1200)
      : (this.config?.snmpFreshnessSeconds ?? 180)
    const rates = await readPortMetrics(
      this.connection(),
      device.infra,
      [device.guid],
      now,
      freshness,
    )
    for (const row of rates) {
      const name = Array.isArray(row['facet']) ? str(row['facet'][1]) : undefined
      if (!name) continue
      for (const [key, value] of Object.entries(linkMetrics(row, now, undefined, freshness))) {
        const seen = num(
          row[key.startsWith('in') ? 'inSeen' : key.startsWith('out') ? 'outSeen' : 'stateSeen'],
        )
        output.push({
          name: `interface.${key}`,
          value,
          labels: {
            hostId,
            scope: 'interface',
            interfaceName: name,
            unit: key.endsWith('Bps') ? 'bps' : key.endsWith('Utilization') ? '%' : '',
            freshness: fresh(seen, now, freshness) ? 'recent' : 'unavailable',
            observedAt: seen ? new Date(seen).toISOString() : 'unknown',
          },
        })
      }
    }
    return output
  }
  async pollMetrics(mapping: MetricsMapping): Promise<MetricsData> {
    const now = Date.now()
    const result: MetricsData = { nodes: {}, links: {}, timestamp: now, warnings: [] }
    const hosts = [
      ...new Set(Object.values(mapping.nodes).flatMap((n) => (n.hostId ? [n.hostId] : []))),
    ]
    for (const infra of [false, true]) {
      const ids = hosts.filter((h) => h.startsWith('infra:') === infra)
      for (const offset of Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) => i * 50)) {
        const batch = ids.slice(offset, offset + 50)
        const seconds = infra
          ? (this.config?.infraFreshnessSeconds ?? 1200)
          : (this.config?.snmpFreshnessSeconds ?? 180)
        const window = windowAt(now, Math.max(seconds * 2, 300))
        const guidFilter = batch.map((id) => literal(infra ? id.slice(6) : id)).join(',')
        const filter = infra
          ? `FROM SystemSample WHERE entityGuid IN (${guidFilter})`
          : `${source} AND entity.guid IN (${guidFilter})`
        try {
          const select = infra
            ? 'latest(timestamp) AS seen, latest(cpuPercent) AS cpu, latest(memoryUsedPercent) AS memory'
            : "latest(PollingHealth) AS health, latest(PollingHealthReason) AS reason, filter(latest(timestamp), WHERE metricName='kentik.snmp.PollingHealth') AS healthSeen, filter(latest(timestamp), WHERE (metricName='kentik.snmp.Uptime' AND kentik.snmp.Uptime > 0) OR metricName='kentik.snmp.if_OperStatus') AS usableSeen"
          const rows = await this.connection().nrql(
            `SELECT count(*) AS samples,${select} ${filter} FACET ${infra ? 'entityGuid' : 'entity.guid'} LIMIT MAX ${window}`,
          )
          const links = Object.entries(mapping.links).filter(
            ([, l]) =>
              l.monitoredNodeId && batch.includes(mapping.nodes[l.monitoredNodeId]?.hostId ?? ''),
          )
          const ports: Row[] = links.length
            ? await readPortMetrics(
                this.connection(),
                infra,
                batch.map((id) => (infra ? id.slice(6) : id)),
                now,
                seconds,
              )
            : []
          for (const [id, m] of Object.entries(mapping.nodes)) {
            if (!m.hostId || !batch.includes(m.hostId)) continue
            const guid = infra ? m.hostId.slice(6) : m.hostId
            const row = rows.find((r) => r['facet'] === guid) ?? {}
            result.nodes[id] = infra
              ? {
                  status: 'unknown',
                  monitoring: fresh(row['seen'], now, seconds) ? 'healthy' : 'pending',
                  lastSeen: num(row['seen']),
                  ...(fresh(row['seen'], now, seconds)
                    ? { cpu: num(row['cpu']), memory: num(row['memory']) }
                    : { monitoringError: 'No recent Infrastructure sample' }),
                }
              : nodeMetrics(row, now, seconds)
          }
          for (const [id, l] of links) {
            const hostId = l.monitoredNodeId ? mapping.nodes[l.monitoredNodeId]?.hostId : undefined
            const guid = infra ? hostId?.slice(6) : hostId
            const name = l.interface?.replace(/:(in|out)$/, '')
            const matches = ports.filter(
              (r) =>
                Array.isArray(r['facet']) &&
                r['facet'][0] === guid &&
                (r['facet'][1] === name || String(r['index']) === name),
            )
            result.links[id] =
              matches.length === 1
                ? linkMetrics(matches[0] ?? {}, now, l.bandwidth, seconds)
                : { status: 'unknown' }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'New Relic polling failed'
          for (const [id, m] of Object.entries(mapping.nodes))
            if (m.hostId && batch.includes(m.hostId))
              result.nodes[id] = {
                status: 'unknown',
                monitoring: 'failing',
                monitoringError: message,
              }
          result.warnings?.push(message)
        }
      }
    }
    for (const id of Object.keys(mapping.links)) result.links[id] ??= { status: 'unknown' }
    return result
  }
}
