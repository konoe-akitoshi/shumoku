/**
 * Zabbix sysmap (network map) → shumoku NetworkGraph converter.
 *
 * Standard `map.get` shapes only — this does NOT depend on any custom Zabbix
 * module's label/icon conventions (e.g. ShowNet's `/zabbix/netmap` generator).
 * It reads what a vanilla sysmap exposes: host / host-group elements and the
 * links between elements.
 *
 * What it maps (v1):
 *   - selement elementtype '0' (host)       → Node (resolved via host.get)
 *   - link (selementid1 ↔ selementid2)      → Link, with a synthesized port per
 *                                             endpoint (the "1 port = 1 link
 *                                             endpoint" model invariant)
 *   - subgraphs via `groupBy`:
 *       'hostgroup' (default) — each node nests under its most-specific host
 *                               group (the membership group with the fewest
 *                               on-map members), so an admin/catch-all group
 *                               that contains everything loses to the real
 *                               segment group. `groupExclude` drops named
 *                               admin groups outright.
 *       'none'                — only standard host-group *area* elements
 *                               (elementtype '3') become subgraphs; members
 *                               nest by membership. (Vanilla Zabbix maps draw
 *                               groups this way; custom-generated maps don't.)
 *
 * Deliberately deferred (see #341 plan):
 *   - positions: Zabbix x/y are NOT carried onto Node.position yet (pending a
 *     spike on whether the layout engine preserves incoming coordinates).
 *   - submap (type 1) / trigger (type 2) / image (type 4) elements are skipped.
 *   - per-link port names / bandwidth / vlan: not present in standard map data.
 */

import type { Link, NetworkGraph, Node, NodePort, NodeSpec, Subgraph } from '@shumoku/core'
import { buildIdentity, DeviceType } from '@shumoku/core'
import type { ZabbixHost, ZabbixHostGroup, ZabbixMapLink, ZabbixSysmap } from './types.js'

// selement.elementtype values (Zabbix map object model)
const ELEM_HOST = '0'
const ELEM_HOSTGROUP = '3'

// link.drawtype → shumoku LinkType
const DRAWTYPE_TO_LINKTYPE: Record<string, Link['type']> = {
  '0': 'solid',
  '2': 'thick',
  '3': 'dashed',
  '4': 'dashed',
}

export type GroupBy = 'none' | 'hostgroup'

export interface ConvertSysmapOptions {
  /** Source id stamped into `provenance.source` (the plugin instance id). */
  sourceId: string
  /** When the source observed this map (Unix ms). Stamped on every entity. */
  observedAt: number
  /** How to derive subgraphs. Default `'hostgroup'`. */
  groupBy?: GroupBy
  /** Host-group names to never use as a subgraph (admin / catch-all groups). */
  groupExclude?: string[]
}

/** A host node staged before grouping (keeps its resolved host for membership). */
interface StagedNode {
  node: Node
  host: ZabbixHost
}

/**
 * Convert one resolved sysmap into a NetworkGraph.
 *
 * @param map            the sysmap (with `selements` + `links`)
 * @param hostsById      hosts resolved via `host.get`, keyed by hostid
 * @param groupNamesById host-group names keyed by groupid (for `groupBy:'none'`
 *                       subgraph labels from host-group area elements)
 */
export function convertSysmapToGraph(
  map: ZabbixSysmap,
  hostsById: Map<string, ZabbixHost>,
  groupNamesById: Map<string, string>,
  options: ConvertSysmapOptions,
): NetworkGraph {
  const { sourceId, observedAt } = options
  const groupBy: GroupBy = options.groupBy ?? 'hostgroup'
  const selements = map.selements ?? []
  const links = map.links ?? []

  // --- Stage host nodes (parent assigned during grouping below). ----------
  const staged: StagedNode[] = []
  const selementToNode = new Map<string, string>()
  for (const se of selements) {
    if (se.elementtype !== ELEM_HOST) continue
    const hostId = se.elements?.[0]?.hostid
    if (!hostId) continue
    const host = hostsById.get(hostId)
    if (!host) continue // host.get didn't return it (e.g. permission) — skip

    const nodeId = `${sourceId}:se:${se.selementid}`
    selementToNode.set(se.selementid, nodeId)
    staged.push({
      host,
      node: {
        id: nodeId,
        label: host.name || host.host || hostId,
        spec: deriveSpec(host),
        identity: buildIdentity({
          mgmtIp: pickMgmtIp(host),
          sysName: host.host || undefined,
          vendorIds: { 'zabbix-hostid': hostId },
        }),
        provenance: { source: sourceId, observedAt },
        metadata: {
          zabbixHostId: hostId,
          zabbixHost: host.host,
          zabbixStatus: host.status === '0' ? 'monitored' : 'unmonitored',
        },
      },
    })
  }

  // --- Grouping → subgraphs + node.parent. --------------------------------
  const subgraphs =
    groupBy === 'hostgroup'
      ? groupByMembership(staged, sourceId, observedAt, options.groupExclude ?? [])
      : groupByAreaElements(staged, selements, groupNamesById, sourceId, observedAt)

  const nodes = staged.map((s) => s.node)

  // --- Links between resolved host nodes; synthesize a port per endpoint. --
  const portsByNode = new Map<string, NodePort[]>()
  const graphLinks: Link[] = []
  for (const ln of links) {
    const fromNode = selementToNode.get(ln.selementid1)
    const toNode = selementToNode.get(ln.selementid2)
    if (!fromNode || !toNode) continue // endpoint not a resolved host — skip
    if (fromNode === toNode) continue // self-link / decorative — skip

    const link: Link = {
      id: `${sourceId}:link:${ln.linkid}`,
      from: { node: fromNode, port: synthPort(fromNode, ln, '1', portsByNode, sourceId) },
      to: { node: toNode, port: synthPort(toNode, ln, '2', portsByNode, sourceId) },
      provenance: { source: sourceId, observedAt },
    }
    const type = ln.drawtype ? DRAWTYPE_TO_LINKTYPE[ln.drawtype] : undefined
    if (type) link.type = type
    if (ln.color && /^[0-9a-fA-F]{6}$/.test(ln.color)) link.style = { stroke: `#${ln.color}` }
    if (ln.label?.trim()) link.label = ln.label
    graphLinks.push(link)
  }

  // attach synthesized ports to their nodes
  for (const { node } of staged) {
    const ports = portsByNode.get(node.id)
    if (ports?.length) node.ports = ports
  }

  return {
    version: '1',
    name: map.name,
    nodes,
    links: graphLinks,
    ...(subgraphs.length > 0 ? { subgraphs } : {}),
  }
}

/**
 * Group each node under its most-specific host group: among the host's
 * memberships (minus `groupExclude`), the group with the fewest members
 * *on this map* wins. This makes an admin / catch-all group that contains
 * every host lose to the real segment group, with no vendor-specific naming
 * assumptions. Mutates `staged[i].node.parent`; returns the used subgraphs.
 */
function groupByMembership(
  staged: StagedNode[],
  sourceId: string,
  observedAt: number,
  groupExclude: string[],
): Subgraph[] {
  const exclude = new Set(groupExclude)
  // on-map member count per groupid
  const memberCount = new Map<string, number>()
  for (const { host } of staged) {
    for (const g of host.hostgroups ?? []) {
      if (exclude.has(g.name)) continue
      memberCount.set(g.groupid, (memberCount.get(g.groupid) ?? 0) + 1)
    }
  }

  const usedGroups = new Map<string, ZabbixHostGroup>()
  for (const { node, host } of staged) {
    const candidates = (host.hostgroups ?? []).filter((g) => memberCount.has(g.groupid))
    if (candidates.length === 0) continue
    candidates.sort(
      (a, b) =>
        (memberCount.get(a.groupid) ?? 0) - (memberCount.get(b.groupid) ?? 0) ||
        a.name.localeCompare(b.name) ||
        a.groupid.localeCompare(b.groupid),
    )
    const primary = candidates[0]
    if (!primary) continue
    node.parent = subgraphId(sourceId, primary.groupid)
    usedGroups.set(primary.groupid, primary)
  }

  return [...usedGroups.values()].map((g) => ({
    id: subgraphId(sourceId, g.groupid),
    label: g.name,
    provenance: { source: sourceId, observedAt },
  }))
}

/**
 * Group by standard host-group *area* elements (elementtype '3'): each becomes
 * a subgraph and member host nodes nest into it. This is how vanilla Zabbix
 * maps express grouping; custom-generated maps usually omit it (so this path
 * yields a flat graph for them — by design). Mutates `node.parent`.
 */
function groupByAreaElements(
  staged: StagedNode[],
  selements: ZabbixSysmap['selements'],
  groupNamesById: Map<string, string>,
  sourceId: string,
  observedAt: number,
): Subgraph[] {
  const groupIds = new Set<string>()
  for (const se of selements ?? []) {
    if (se.elementtype !== ELEM_HOSTGROUP) continue
    const groupId = se.elements?.[0]?.groupid
    if (groupId) groupIds.add(groupId)
  }
  if (groupIds.size === 0) return []

  const usedGroups = new Map<string, string>() // groupid -> label
  for (const { node, host } of staged) {
    for (const g of host.hostgroups ?? []) {
      if (!groupIds.has(g.groupid)) continue
      node.parent = subgraphId(sourceId, g.groupid)
      usedGroups.set(g.groupid, groupNamesById.get(g.groupid) ?? g.name)
      break
    }
  }

  return [...usedGroups.entries()].map(([groupid, label]) => ({
    id: subgraphId(sourceId, groupid),
    label,
    provenance: { source: sourceId, observedAt },
  }))
}

function subgraphId(sourceId: string, groupId: string): string {
  return `${sourceId}:sg:${groupId}`
}

/**
 * Synthesize a port on `nodeId` for one end of link `ln`. A Zabbix map link is
 * node-level (no interface), so we mint one port per link endpoint to satisfy
 * the "1 port = 1 link endpoint" invariant and return its id.
 */
function synthPort(
  nodeId: string,
  ln: ZabbixMapLink,
  end: '1' | '2',
  portsByNode: Map<string, NodePort[]>,
  sourceId: string,
): string {
  const portId = `${nodeId}:port:link:${ln.linkid}:${end}`
  const list = portsByNode.get(nodeId) ?? []
  list.push({ id: portId, label: '', connectors: [], provenance: { source: sourceId } })
  portsByNode.set(nodeId, list)
  return portId
}

/** Management IP: default (`main==='1'`) interface with an IP, else first with an IP. */
function pickMgmtIp(host: ZabbixHost): string | undefined {
  const withIp = (host.interfaces ?? []).filter((i) => i.ip && i.ip.trim() !== '')
  if (withIp.length === 0) return undefined
  return (withIp.find((i) => i.main === '1') ?? withIp[0])?.ip
}

// --- best-effort device facts from inventory.hardware (Phase-3-lite) -------
// Standard Zabbix exposes no structured vendor/model/type, so we parse the
// free-text `inventory.hardware` (an SNMP sysDescr-style string). Best-effort:
// unknown fields are left undefined and the renderer falls back to a generic
// device icon.

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
  [/linux/i, 'linux'],
]

const COMPANY_PREFIX =
  /^(juniper networks,?\s*inc\.?|cisco systems,?\s*inc\.?|arista networks,?\s*inc\.?|palo alto networks,?\s*inc\.?|fortinet,?\s*inc\.?|huawei technologies co\.?,?\s*ltd\.?|dell\s*inc\.?|hewlett[\w- ]*|nvidia|mellanox technologies)\s*/i

function deriveSpec(host: ZabbixHost): NodeSpec {
  const spec: NodeSpec = { kind: 'hardware' }
  const hw = host.inventory?.hardware?.trim()
  if (!hw) return spec

  for (const [re, vendor] of VENDOR_PATTERNS) {
    if (re.test(hw)) {
      spec.vendor = vendor
      break
    }
  }
  const model = hw
    .replace(COMPANY_PREFIX, '')
    .match(/[A-Za-z]*\d[\w./-]*/)?.[0]
    ?.replace(/[,.]+$/, '')
  if (model) spec.model = model
  const type = detectDeviceType(hw)
  if (type) spec.type = type
  return spec
}

function detectDeviceType(hw: string): DeviceType | undefined {
  const s = hw.toLowerCase()
  if (/firewall|fortigate|\bpa-\d|\bsrx/.test(s)) return DeviceType.Firewall
  if (/access point|\bap\b|wireless/.test(s)) return DeviceType.AccessPoint
  if (/load\s*balancer/.test(s)) return DeviceType.LoadBalancer
  if (/switch|switching/.test(s)) return DeviceType.L2Switch
  if (/router|\bios xr\b/.test(s)) return DeviceType.Router
  if (/linux|\bserver\b/.test(s)) return DeviceType.Server
  return undefined
}
