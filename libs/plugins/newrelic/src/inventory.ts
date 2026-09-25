import {
  buildIdentity,
  DeviceType,
  getDeviceIcon,
  type Host,
  type Node,
  type NodePort,
  type NodeSpec,
} from '@shumoku/core'
import { normalizeMacKey } from '@shumoku/core/plugin-kit'
import type { NewRelicClient } from './client.js'
import type { NewRelicConfig } from './config.js'
import { literal, num, type Row, record, source, str, windowAt } from './values.js'

export interface Device {
  host: Host
  guid: string
  infra: boolean
  raw: Row
  spec?: NodeSpec
  ports: Interface[]
}
export interface Interface {
  name: string
  index?: number
  raw: Row
  port: NodePort
}
export interface Inventory {
  devices: Device[]
  asOf: number
  warnings: string[]
}

export function classify(row: Row, infra: boolean): NodeSpec | undefined {
  if (infra) return { kind: 'hardware', type: DeviceType.Server }
  const oid = str(row['oid'])?.replace(/^\./, '')
  const description = str(row['description']) ?? ''
  if (oid === '1.3.6.1.4.1.14823.1.2.102' && /MODEL:\s*535/i.test(description)) {
    return { kind: 'hardware', type: DeviceType.AccessPoint, vendor: 'hpe', model: 'aruba-ap-535' }
  }
  if (oid?.startsWith('1.3.6.1.4.1.44641') && /^VyOS\b/.test(description)) {
    return { kind: 'hardware', type: DeviceType.Router, vendor: 'vyos' }
  }
  if (oid?.startsWith('1.3.6.1.4.1.207.') && /Allied Telesis/i.test(description)) {
    // A switch pictogram does not assert the device's L2/L3 capabilities.
    return { kind: 'hardware', vendor: 'allied', icon: getDeviceIcon(DeviceType.L2Switch) }
  }
  return undefined
}

export function interfaces(rows: Row[], _infra: boolean): Interface[] {
  const byName = new Map<string, Row>()
  for (const row of rows) {
    const name = str(row['name'])
    if (!name) continue
    const old = byName.get(name)
    if (!old || (num(row['seen']) ?? 0) > (num(old['seen']) ?? 0)) byName.set(name, row)
  }
  const macCount = new Map<string, number>()
  const indexCount = new Map<number, number>()
  for (const row of byName.values()) {
    const mac = str(row['mac']) ? normalizeMacKey(String(row['mac'])) : undefined
    if (mac) macCount.set(mac, (macCount.get(mac) ?? 0) + 1)
    const index = Number(row['index'])
    if (Number.isSafeInteger(index) && index > 0)
      indexCount.set(index, (indexCount.get(index) ?? 0) + 1)
  }
  return [...byName].map(([name, raw]) => {
    const candidate = Number(raw['index'])
    const index = Number.isSafeInteger(candidate) && candidate > 0 ? candidate : undefined
    const mac = str(raw['mac']) ? normalizeMacKey(String(raw['mac'])) : undefined
    const identity = buildIdentity({
      ifName: name,
      ifIndex: index !== undefined && indexCount.get(index) === 1 ? index : undefined,
      mac: mac && !/^(00[:-]?){5}00$/.test(mac) && macCount.get(mac) === 1 ? mac : undefined,
    })
    const seen = num(raw['seen'])
    return {
      name,
      index,
      raw,
      port: {
        id: name,
        label: name,
        interfaceName: name,
        identity,
        connectors: [],
        ...(num(raw['speed']) ? { speed: `${num(raw['speed'])}m` } : {}),
        notes: [
          str(raw['alias']),
          str(raw['type']),
          str(raw['ip']),
          seen ? `Last observed: ${new Date(seen).toISOString()}` : 'Observation time unavailable',
        ]
          .filter(Boolean)
          .join(' · '),
        ...(seen ? { provenance: { source: 'newrelic', observedAt: seen } } : {}),
        source: 'custom' as const,
      },
    }
  })
}

export function normalizeDevices(rows: Row[], ports: Map<string, Row[]>, asOf: number): Inventory {
  const warnings: string[] = []
  // Collapse only independently corroborated historical aliases, never names alone.
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const id = str(row['id'])
    if (!id) continue
    const proven = [row['ip'], row['sysName'], row['oid']].every(
      (v) => typeof v === 'string' && v.length,
    )
    const key = proven
      ? JSON.stringify([row['infra'] === true, row['ip'], row['sysName'], row['oid']])
      : id
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  const selected = [...groups.values()].map((group) => {
    const sorted = [...group].sort((a, b) => (num(b['seen']) ?? 0) - (num(a['seen']) ?? 0))
    const head = sorted[0] ?? {}
    if (sorted.length > 1)
      warnings.push(
        `Historical entity aliases: ${str(head['name']) ?? 'device'} (${sorted.length})`,
      )
    return head
  })
  const counts = (key: string) => {
    const result = new Map<string, number>()
    for (const row of selected) {
      const value = str(row[key])
      if (value) result.set(value, (result.get(value) ?? 0) + 1)
    }
    return result
  }
  const ips = counts('ip')
  const names = counts('sysName')
  const devices: Device[] = []
  for (const raw of selected) {
    const id = str(raw['id'])
    const guid = str(raw['guid'])
    if (!id || !guid) continue
    const infra = raw['infra'] === true
    const ip = str(raw['ip'])
    const sysName = str(raw['sysName'])
    const ambiguous = (ip && ips.get(ip) !== 1) || (sysName && names.get(sysName) !== 1)
    if (ambiguous)
      warnings.push(`Ambiguous identity: ${str(raw['name']) ?? id}; shared keys excluded`)
    const host: Host = {
      id,
      name: str(raw['name']) ?? id,
      ip,
      status: 'unknown',
      identity: buildIdentity({
        mgmtIp: ip && ips.get(ip) === 1 ? ip : undefined,
        sysName: sysName && names.get(sysName) === 1 ? sysName : undefined,
        vendorIds: { 'newrelic-guid': id },
      }),
    }
    devices.push({
      host,
      guid,
      infra,
      raw,
      spec: classify(raw, infra),
      ports: interfaces(ports.get(id) ?? [], infra),
    })
  }
  devices.sort(
    (a, b) =>
      a.host.name.localeCompare(b.host.name, 'en', { numeric: true }) ||
      a.host.id.localeCompare(b.host.id),
  )
  return { devices, warnings, asOf }
}

export function deviceNode(device: Device): Node {
  return {
    id: device.host.id,
    label: device.host.name,
    identity: device.host.identity,
    spec: device.spec ?? { kind: 'hardware', type: DeviceType.Generic },
    ports: device.ports.map((p) => p.port),
    metadata: {
      upstream: device.raw,
      inventoryNote: 'Inventory is historical; collection state is reported separately.',
      ...(device.spec ? {} : { classification: 'Unknown device type: insufficient evidence' }),
    },
    provenance: {
      source: 'newrelic',
      ...(num(device.raw['seen']) ? { observedAt: num(device.raw['seen']) } : {}),
    },
  }
}

export async function readInventory(
  client: NewRelicClient,
  config: NewRelicConfig,
  asOf: number,
): Promise<Inventory> {
  const window = windowAt(asOf, (config.inventoryLookbackDays ?? 7) * 86400)
  const rows = await client.nrql(
    `SELECT count(*) AS samples, latest(entity.name) AS name, latest(src_addr) AS ip, latest(SysName) AS sysName, latest(SysObjectID) AS oid, latest(SysDescr) AS description, latest(SysLocation) AS location, latest(provider) AS provider, earliest(timestamp) AS firstSeen, latest(timestamp) AS seen, filter(latest(timestamp), WHERE SysDescr IS NOT NULL) AS descriptionSeen ${source} FACET entity.guid LIMIT MAX ${window}`,
  )
  const byGuid = new Map<string, Row>(
    rows.flatMap((row) => {
      const guid = str(row['facet'])
      return guid ? [[guid, { ...row, id: guid, guid }] as const] : []
    }),
  )
  // Registered entities prevent a quiet device disappearing after a 24h gap.
  const registered = new Set<string>()
  let cursor: string | undefined
  const cursors = new Set<string>()
  do {
    const actor = await client.graph(
      'query($query: String!, $cursor: String) { actor { entitySearch(query: $query) { results(cursor: $cursor) { entities { guid name domain type tags { key values } } nextCursor } } } }',
      { query: `accountId = ${config.accountId} AND domain = 'EXT'`, cursor: cursor ?? null },
      true,
    )
    const result = record(record(actor['entitySearch'])['results'])
    if (!Array.isArray(result['entities']))
      throw new Error('New Relic entity inventory is incomplete')
    for (const value of result['entities']) {
      const entity = record(value)
      const guid = str(entity['guid'])
      const type = str(entity['type'])
      if (
        !guid ||
        !['ROUTER', 'SWITCH', 'WAP', 'WIRELESS_CONTROLLER', 'FIREWALL'].includes(type ?? '')
      )
        continue
      registered.add(guid)
      const tags = Array.isArray(entity['tags']) ? entity['tags'].map(record) : []
      const ip = tags.find((t) => t['key'] === 'device_ip')?.['values']
      const collector = tags.find((t) => t['key'] === 'container_service')?.['values']
      const existing = byGuid.get(guid)
      byGuid.set(guid, {
        ...existing,
        collector: Array.isArray(collector) ? str(collector[0]) : undefined,
        id: guid,
        guid,
        name: str(entity['name']) ?? guid,
        ...(Array.isArray(ip) ? { ip: str(ip[0]) } : {}),
      })
    }
    cursor = str(result['nextCursor'])
    if (cursor && cursors.has(cursor)) throw new Error('New Relic repeated inventory cursor')
    if (cursor) cursors.add(cursor)
  } while (cursor)
  // Historic GUIDs are evidence, not additional currently registered devices.
  const candidates = [...byGuid.values()].filter(
    (r) => registered.has(String(r['guid'])) || (num(r['seen']) ?? 0) >= asOf - 86400_000,
  )
  const inventoryRows: Row[] = selectCurrentEntities(candidates)

  const ports = new Map<string, Row[]>()
  // Bound facets to known hosts and fail explicitly if even a batch is too large.
  const ids = inventoryRows.map((r) => String(r['guid']))
  for (const offset of Array.from(
    { length: Math.ceil(ids.length / 50) },
    (_, index) => index * 50,
  )) {
    const batch = ids.slice(offset, offset + 50)
    const ifs = await client.nrql(
      `SELECT count(*) AS samples, latest(if_Index) AS index, latest(if_interface_name) AS name, latest(if_Alias) AS alias, latest(if_Type) AS type, latest(if_Speed) AS speed, latest(if_Address) AS ip, latest(if_PhysAddress) AS mac, latest(if_AdminStatus) AS admin, latest(if_OperStatus) AS oper, latest(timestamp) AS seen ${source} AND entity.guid IN (${batch.map(literal).join(',')}) AND if_interface_name IS NOT NULL FACET entity.guid, if_interface_name LIMIT MAX ${window}`,
    )
    for (const row of ifs) {
      const guid = Array.isArray(row['facet']) ? str(row['facet'][0]) : undefined
      if (!guid) continue
      const list = ports.get(guid) ?? []
      list.push(row)
      ports.set(guid, list)
    }
  }
  if (config.includeInfrastructure !== false) {
    const hosts = await client.nrql(
      `SELECT latest(hostname) AS name, latest(operatingSystem) AS os, latest(timestamp) AS seen FROM SystemSample FACET entityGuid LIMIT MAX ${window}`,
    )
    const nics = await client.nrql(
      `SELECT latest(hardwareAddress) AS mac, latest(ipV4Address) AS ip, latest(state) AS oper, latest(timestamp) AS seen FROM NetworkSample FACET entityGuid, interfaceName LIMIT MAX ${window}`,
    )
    for (const row of hosts) {
      const guid = str(row['facet'])
      if (!guid) continue
      const id = `infra:${guid}`
      inventoryRows.push({ ...row, id, guid, infra: true })
    }
    for (const row of nics) {
      const facet = row['facet']
      if (!Array.isArray(facet)) continue
      const guid = str(facet[0])
      const name = str(facet[1])
      if (!guid || !name) continue
      const id = `infra:${guid}`
      const list = ports.get(id) ?? []
      list.push({ ...row, name })
      ports.set(id, list)
    }
  }
  return normalizeDevices(inventoryRows, ports, asOf)
}

/** A profile migration can leave two registered entities. Only suppress an old
 * alias with matching IP, name and collector AND disjoint observation epochs.
 * Simultaneously reporting or uncorroborated records stay separate. */
export function selectCurrentEntities(rows: Row[]): Row[] {
  return rows.filter(
    (old) =>
      !rows.some(
        (current) =>
          current !== old &&
          !!old['collector'] &&
          old['collector'] === current['collector'] &&
          !!old['ip'] &&
          old['ip'] === current['ip'] &&
          old['name'] === current['name'] &&
          current['sysName'] === old['name'] &&
          !!current['oid'] &&
          (num(old['seen']) ?? Infinity) < (num(current['firstSeen']) ?? -Infinity),
      ),
  )
}
