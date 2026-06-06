/**
 * Zabbix → shumoku NetworkGraph converter.
 *
 * Generates topology from standard Zabbix data (no maps / netmap module, no
 * direct SNMP reach — Zabbix is the collector). Grounded in the Zabbix 7.0 API
 * spec cross-referenced with the live ShowNet data and the human-built sysmaps;
 * see `apps/server/docs/design/zabbix-lldp-topology.md`.
 *
 *   - nodes    ← hosts (`host.get`); keyed on `name` (host.host is the mgmt IP)
 *   - links    ← LLDP neighbor items (`lldp.rem.*` / `lldp.loc.if.*`), plus a
 *                `PARENT` host-tag fallback where LLDP saw no neighbor
 *   - groups   ← host groups, honoring the Zabbix `/` nesting convention
 *   - device   ← parsed from inventory.{type,vendor,model,hardware} + SNMP sysDescr
 */

import type {
  Identity,
  Link,
  NetworkGraph,
  Node,
  NodePort,
  NodeSpec,
  Subgraph,
} from '@shumoku/core'
import { buildIdentity, DeviceType } from '@shumoku/core'
import type { ZabbixHost, ZabbixLldpNeighbor } from './types.js'

export type GroupBy = 'none' | 'hostgroup'

export interface ConvertOptions {
  /** Source id stamped into `provenance.source` (the plugin instance id). */
  sourceId: string
  /** When the source observed this (Unix ms). Stamped on every entity. */
  observedAt: number
  /** How to derive subgraphs. Default `'hostgroup'`. */
  groupBy?: GroupBy
  /** Host-group names to never use as a subgraph (admin / catch-all groups). */
  groupExclude?: string[]
  /** Synthesize nodes for LLDP/tag neighbors that aren't Zabbix hosts. Default true. */
  includeExternalNeighbors?: boolean
  /** Host-tag name naming an upstream device (fallback link). Default `'PARENT'`. */
  parentTag?: string
}

/** A host node staged before grouping (keeps its resolved host for membership). */
interface StagedNode {
  node: Node
  host: ZabbixHost
}

/** Placeholder values the LLDP template uses when no neighbor was seen. */
const NO_NEIGHBOR = /^\s*(\*\s*no info\s*\*|-|unknown|)\s*$/i
// MAC address forms: colon/hyphen-separated octets, or Cisco dotted-quad.
const MAC_LIKE = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$|^(?:[0-9a-f]{4}\.){2}[0-9a-f]{4}$/i

/**
 * Convert hosts + their LLDP adjacencies (and SNMP sysDescr) into a NetworkGraph.
 *
 * @param hosts             hosts resolved via `host.get` (with tags + inventory)
 * @param neighborsByHostId LLDP adjacencies per hostid (assembled by the plugin)
 * @param sysDescrByHostId  per-host SNMP sysDescr (for device-type derivation)
 */
export function convertZabbixToGraph(
  hosts: ZabbixHost[],
  neighborsByHostId: Map<string, ZabbixLldpNeighbor[]>,
  sysDescrByHostId: Map<string, string>,
  options: ConvertOptions,
): NetworkGraph {
  const { sourceId, observedAt } = options
  const groupBy: GroupBy = options.groupBy ?? 'hostgroup'
  const includeExternal = options.includeExternalNeighbors ?? true
  const parentTag = options.parentTag ?? 'PARENT'

  // --- 1. Host nodes (parent assigned during grouping). -------------------
  const staged: StagedNode[] = []
  const nodeByHostId = new Map<string, Node>()
  const nodeBySysName = new Map<string, Node>() // host.name → node, for neighbor resolution
  for (const host of hosts) {
    const node: Node = {
      id: `${sourceId}:host:${host.hostid}`,
      label: host.name || host.host || host.hostid,
      spec: deriveSpec(host, sysDescrByHostId.get(host.hostid)),
      identity: buildIdentity({
        mgmtIp: pickMgmtIp(host),
        // sysName = host.name (the real hostname). NOT host.host, which is the
        // management IP here — using it breaks neighbor resolution + clustering.
        sysName: host.name || undefined,
        vendorIds: { 'zabbix-hostid': host.hostid },
      }),
      provenance: { source: sourceId, observedAt },
      metadata: {
        // FQDN for the compound layout (ghost detection + domain fallback band).
        hostname: host.name || host.host,
        zabbixHostId: host.hostid,
        zabbixHost: host.host,
        zabbixStatus: host.status === '0' ? 'monitored' : 'unmonitored',
      },
    }
    staged.push({ node, host })
    nodeByHostId.set(host.hostid, node)
    if (host.name) nodeBySysName.set(host.name, node)
  }

  // --- 2. Grouping → nested subgraphs (Zabbix '/' hierarchy) + node.parent. -
  const subgraphs =
    groupBy === 'hostgroup'
      ? groupByHostGroup(staged, sourceId, observedAt, options.groupExclude ?? [])
      : []

  // --- 3. Links: LLDP neighbors, then PARENT-tag fallback. -----------------
  const externalNodes = new Map<string, Node>() // sysname → synthesized node
  const portsByNode = new Map<string, Map<string, NodePort>>()
  const links: Link[] = []
  const seenLinks = new Set<string>() // canonical endpoint-port pairs
  const linkedNodePairs = new Set<string>() // canonical node pairs (for tag de-dup)

  const ensurePort = (
    node: Node,
    label: string,
    speedBps?: number,
    identity?: Identity,
  ): NodePort => {
    let ports = portsByNode.get(node.id)
    if (!ports) {
      ports = new Map()
      portsByNode.set(node.id, ports)
    }
    const id = `${node.id}:port:${label}`
    const existing = ports.get(id)
    if (existing) {
      // Backfill identity if a later assertion (LLDP > tag fallback) supplies one.
      if (identity && !existing.identity) existing.identity = identity
      return existing
    }
    const port: NodePort = { id, label, connectors: [], provenance: { source: sourceId } }
    if (identity) port.identity = identity
    const speed = speedLabel(speedBps)
    if (speed) port.speed = speed
    ports.set(id, port)
    return port
  }

  // LLDP remote port-id is a port name, or a MAC when port-id is MAC-typed —
  // stamp the matching identity key so link bindings resolve across re-scans.
  const lldpPortIdentity = (portId: string | undefined): Identity | undefined => {
    const v = portId?.trim()
    if (!v) return undefined
    return MAC_LIKE.test(v) ? buildIdentity({ mac: v }) : buildIdentity({ ifName: v })
  }

  const resolveRemote = (sysName: string, chassisId?: string): Node | undefined => {
    const host = nodeBySysName.get(sysName)
    if (host) return host
    if (!includeExternal) return undefined
    let ext = externalNodes.get(sysName)
    if (!ext) {
      ext = {
        id: `${sourceId}:ext:${sysName}`,
        label: sysName,
        spec: { kind: 'hardware' },
        identity: buildIdentity({ sysName, chassisId }),
        provenance: { source: sourceId, observedAt },
        metadata: { external: true, hostname: sysName },
      }
      externalNodes.set(sysName, ext)
    }
    return ext
  }

  const nodePairKey = (a: string, b: string): string => [a, b].sort().join('::')

  // 3a. LLDP links (the authoritative neighbor data).
  for (const host of hosts) {
    const localNode = nodeByHostId.get(host.hostid)
    if (!localNode) continue
    for (const nbr of neighborsByHostId.get(host.hostid) ?? []) {
      if (!nbr.localIf || NO_NEIGHBOR.test(nbr.remSysname)) continue
      const remoteNode = resolveRemote(nbr.remSysname, nbr.remChassisId)
      if (!remoteNode || remoteNode.id === localNode.id) continue

      const localPort = ensurePort(
        localNode,
        nbr.localIf,
        nbr.speedBps,
        buildIdentity({ ifName: nbr.localIf }),
      )
      const remoteLabel = nbr.remPortId?.trim() || `to-${host.hostid}-${nbr.localIf}`
      const remotePort = ensurePort(
        remoteNode,
        remoteLabel,
        undefined,
        lldpPortIdentity(nbr.remPortId),
      )

      const key = nodePairKey(
        `${localNode.id}|${localPort.id}`,
        `${remoteNode.id}|${remotePort.id}`,
      )
      if (seenLinks.has(key)) continue
      seenLinks.add(key)
      linkedNodePairs.add(nodePairKey(localNode.id, remoteNode.id))

      const link: Link = {
        id: `${sourceId}:link:${links.length}`,
        from: { node: localNode.id, port: localPort.id },
        to: { node: remoteNode.id, port: remotePort.id },
        provenance: { source: sourceId, observedAt },
        metadata: { discoveredVia: 'zabbix-lldp' },
      }
      if (nbr.speedBps) link.metadata = { ...link.metadata, speedBps: nbr.speedBps }
      links.push(link)
    }
  }

  // 3b. PARENT-tag fallback links — only where LLDP saw nothing between the pair.
  if (parentTag) {
    for (const { node, host } of staged) {
      const up = host.tags?.find((t) => t.tag === parentTag)?.value?.trim()
      if (!up) continue
      const upstream = resolveRemote(up)
      if (!upstream || upstream.id === node.id) continue
      if (linkedNodePairs.has(nodePairKey(node.id, upstream.id))) continue
      linkedNodePairs.add(nodePairKey(node.id, upstream.id))

      const fromPort = ensurePort(node, `parent:${up}`)
      const toPort = ensurePort(upstream, `child:${host.name || host.hostid}`)
      links.push({
        id: `${sourceId}:link:${links.length}`,
        from: { node: node.id, port: fromPort.id },
        to: { node: upstream.id, port: toPort.id },
        provenance: { source: sourceId, observedAt },
        metadata: { discoveredVia: 'zabbix-parent-tag' },
      })
    }
  }

  // attach ports to their nodes
  const allNodes = [...staged.map((s) => s.node), ...externalNodes.values()]
  for (const node of allNodes) {
    const ports = portsByNode.get(node.id)
    if (ports?.size) node.ports = [...ports.values()]
  }

  return {
    version: '1',
    name: 'Zabbix',
    nodes: allNodes,
    links,
    ...(subgraphs.length > 0 ? { subgraphs } : {}),
  }
}

/**
 * Group nodes by their host group, honoring Zabbix's `/` nesting convention
 * ("A/B/C" → nested subgraphs A ⊃ A/B ⊃ A/B/C). Each node lands in its
 * most-specific group: deepest `/` path, then fewest members (so an admin /
 * catch-all group that contains everything loses), then name. `groupExclude`
 * drops named admin groups outright. Mutates `node.parent`; returns subgraphs.
 */
function groupByHostGroup(
  staged: StagedNode[],
  sourceId: string,
  observedAt: number,
  groupExclude: string[],
): Subgraph[] {
  const exclude = new Set(groupExclude)
  const memberCount = new Map<string, number>()
  for (const { host } of staged) {
    for (const g of host.hostgroups ?? []) {
      if (exclude.has(g.name)) continue
      memberCount.set(g.name, (memberCount.get(g.name) ?? 0) + 1)
    }
  }
  const sgId = (path: string): string => `${sourceId}:sg:${path}`
  const depth = (name: string): number => name.split('/').length

  const usedLeaves = new Set<string>()
  for (const { node, host } of staged) {
    const cands = (host.hostgroups ?? []).filter((g) => memberCount.has(g.name))
    if (cands.length === 0) continue
    cands.sort(
      (a, b) =>
        depth(b.name) - depth(a.name) ||
        (memberCount.get(a.name) ?? 0) - (memberCount.get(b.name) ?? 0) ||
        a.name.localeCompare(b.name),
    )
    const leaf = cands[0]
    if (!leaf) continue
    node.parent = sgId(leaf.name)
    usedLeaves.add(leaf.name)
  }

  // Emit a subgraph for each used leaf AND every '/' ancestor (Zabbix does not
  // create parent groups automatically, so synthesize the intermediate levels).
  const subById = new Map<string, Subgraph>()
  for (const leaf of usedLeaves) {
    const segs = leaf.split('/')
    for (const [i, seg] of segs.entries()) {
      const path = segs.slice(0, i + 1).join('/')
      const id = sgId(path)
      if (subById.has(id)) continue
      const sg: Subgraph = { id, label: seg, provenance: { source: sourceId, observedAt } }
      if (i > 0) sg.parent = sgId(segs.slice(0, i).join('/'))
      subById.set(id, sg)
    }
  }
  return [...subById.values()]
}

/** Management IP: default (`main==='1'`) interface with an IP, else first with an IP. */
function pickMgmtIp(host: ZabbixHost): string | undefined {
  const withIp = (host.interfaces ?? []).filter((i) => i.ip && i.ip.trim() !== '')
  if (withIp.length === 0) return undefined
  return (withIp.find((i) => i.main === '1') ?? withIp[0])?.ip
}

/** Humanize a bits/sec speed to a port label (e.g. 100000000000 → "100g"). */
function speedLabel(bps?: number): string | undefined {
  if (!bps || bps <= 0) return undefined
  if (bps % 1_000_000_000 === 0) return `${bps / 1_000_000_000}g`
  if (bps % 1_000_000 === 0) return `${bps / 1_000_000}m`
  return undefined
}

// --- device facts: inventory (structured) → inventory.hardware / sysDescr ----
// Zabbix has no native device-role enum; structured inventory.{type,vendor,model}
// is spec-faithful but usually empty, so we fall back to parsing the free-text
// inventory.hardware / SNMP sysDescr (both vendor/model/OS strings).

const VENDOR_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/juniper/i, 'juniper'],
  [/cisco/i, 'cisco'],
  [/arista/i, 'arista'],
  [/palo\s*alto/i, 'paloalto'],
  [/forti/i, 'fortinet'],
  [/huawei/i, 'huawei'],
  [/nokia|alcatel/i, 'nokia'],
  [/mellanox|nvidia/i, 'nvidia'],
  [/dell/i, 'dell'],
  [/hewlett|hpe|aruba/i, 'hpe'],
  [/\bnec\b/i, 'nec'],
  [/linux|ubuntu|debian|centos|red\s*hat/i, 'linux'],
]

const COMPANY_PREFIX =
  /^(juniper networks,?\s*inc\.?|cisco systems,?\s*inc\.?|cisco\b|arista networks,?\s*inc\.?|palo alto networks\b|fortinet,?\s*inc\.?|huawei technologies co\.?,?\s*ltd\.?|dell\s*inc\.?|hewlett[\w- ]*|nvidia|mellanox technologies)[ ,]*/i

function deriveSpec(host: ZabbixHost, sysDescr?: string): NodeSpec {
  const spec: NodeSpec = { kind: 'hardware' }
  const inv = host.inventory

  // 1. structured inventory (spec-faithful; rarely populated)
  if (inv?.vendor?.trim()) spec.vendor = inv.vendor.trim().toLowerCase()
  if (inv?.model?.trim()) spec.model = inv.model.trim()
  let type = inv?.type?.trim() ? detectType(inv.type) : undefined

  // 2. free-text facts: the most informative of inventory.hardware / sysDescr,
  //    skipping a degenerate value that just echoes the host name/ip.
  const text = bestFactsText(host, inv?.hardware, sysDescr)
  if (text) {
    if (!spec.vendor) {
      for (const [re, vendor] of VENDOR_PATTERNS) {
        if (re.test(text)) {
          spec.vendor = vendor
          break
        }
      }
    }
    if (!spec.model) {
      const model = text
        .replace(COMPANY_PREFIX, '')
        .match(/[A-Za-z]*\d[\w./-]*/)?.[0]
        ?.replace(/[,.]+$/, '')
      if (model) spec.model = model
    }
    if (!type) type = detectType(text)
  }
  if (type) spec.type = type
  return spec
}

/** Pick the most informative facts string; drop one that just echoes name/ip. */
function bestFactsText(host: ZabbixHost, hardware?: string, sysDescr?: string): string | undefined {
  const echo = new Set([host.name, host.host].filter(Boolean))
  const cands = [sysDescr, hardware]
    .map((s) => s?.trim())
    // a real descr has whitespace; drop empties and bare name/ip echoes
    .filter((s): s is string => typeof s === 'string' && !echo.has(s) && /\s/.test(s))
  // longest = most detail
  cands.sort((a, b) => b.length - a.length)
  return cands[0]
}

function detectType(text: string): DeviceType | undefined {
  const s = text.toLowerCase()
  if (/firewall|fortigate|fortindr|\bsrx\d|\bpa-\d|palo\s*alto/.test(s)) return DeviceType.Firewall
  if (/access point|wireless|\bwlc\b/.test(s)) return DeviceType.AccessPoint
  if (/load\s*balancer/.test(s)) return DeviceType.LoadBalancer
  if (/nexus|nx-os|\bqfx\d|arista|\beos\b|\bs9\d{3}/.test(s)) return DeviceType.L3Switch
  if (/switch|switching|\bex\d{3,}|catalyst|\bc9\d{3}/.test(s)) return DeviceType.L2Switch
  if (/router|ios xr|\bptx\d|\bmx\d|\bne\d{3,}|\basr\d|crpd|\bxrd\b/.test(s))
    return DeviceType.Router
  if (/linux|\bserver\b|ubuntu|centos|windows/.test(s)) return DeviceType.Server
  return undefined
}
