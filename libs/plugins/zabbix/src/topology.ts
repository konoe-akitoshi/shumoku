/**
 * Zabbix → shumoku NetworkGraph converter.
 *
 * Generates topology from **standard Zabbix data**, with no dependency on Zabbix
 * maps or the custom netmap/L2DM map-generation module, and no direct SNMP reach
 * (Zabbix is the collector):
 *   - nodes ← hosts (`host.get`)
 *   - links ← per-host LLDP neighbor adjacencies (assembled by the plugin from the
 *     standard LLDP-MIB `lldp.rem.*` / `lldp.loc.if.*` items)
 *
 * See `apps/server/docs/design/zabbix-lldp-topology.md` for the full design.
 */

import type { Link, NetworkGraph, Node, NodePort, NodeSpec, Subgraph } from '@shumoku/core'
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
  /** Synthesize nodes for LLDP neighbors that aren't Zabbix hosts. Default true. */
  includeExternalNeighbors?: boolean
}

/** A host node staged before grouping (keeps its resolved host for membership). */
interface StagedNode {
  node: Node
  host: ZabbixHost
}

/** Placeholder values the L2DM template uses when LLDP returned no neighbor. */
const NO_NEIGHBOR = /^\s*(\*\s*no info\s*\*|-|unknown|)\s*$/i

/**
 * Convert hosts + their LLDP adjacencies into a NetworkGraph.
 *
 * @param hosts             hosts resolved via `host.get`
 * @param neighborsByHostId LLDP adjacencies per hostid (assembled by the plugin)
 */
export function convertLldpToGraph(
  hosts: ZabbixHost[],
  neighborsByHostId: Map<string, ZabbixLldpNeighbor[]>,
  options: ConvertOptions,
): NetworkGraph {
  const { sourceId, observedAt } = options
  const groupBy: GroupBy = options.groupBy ?? 'hostgroup'
  const includeExternal = options.includeExternalNeighbors ?? true

  // --- 1. Host nodes (parent assigned during grouping). -------------------
  const staged: StagedNode[] = []
  const nodeByHostId = new Map<string, Node>()
  const nodeBySysName = new Map<string, Node>() // host.name → node, for neighbor resolution
  for (const host of hosts) {
    const node: Node = {
      id: `${sourceId}:host:${host.hostid}`,
      label: host.name || host.host || host.hostid,
      spec: deriveSpec(host),
      identity: buildIdentity({
        mgmtIp: pickMgmtIp(host),
        // sysName = host.name (the real hostname). NOT host.host, which is often
        // the management IP here — using it would break neighbor resolution and
        // cross-source clustering.
        sysName: host.name || undefined,
        vendorIds: { 'zabbix-hostid': host.hostid },
      }),
      provenance: { source: sourceId, observedAt },
      metadata: {
        zabbixHostId: host.hostid,
        zabbixHost: host.host,
        zabbixStatus: host.status === '0' ? 'monitored' : 'unmonitored',
      },
    }
    staged.push({ node, host })
    nodeByHostId.set(host.hostid, node)
    if (host.name) nodeBySysName.set(host.name, node)
  }

  // --- 2. Grouping → subgraphs + node.parent (host nodes only). -----------
  const subgraphs =
    groupBy === 'hostgroup'
      ? groupByMembership(staged, sourceId, observedAt, options.groupExclude ?? [])
      : []

  // --- 3. Links from LLDP adjacencies; real ports; de-dup. ----------------
  const externalNodes = new Map<string, Node>() // sysname → synthesized node
  const portsByNode = new Map<string, Map<string, NodePort>>()
  const links: Link[] = []
  const seenLinks = new Set<string>()

  const ensurePort = (node: Node, label: string, speedBps?: number): NodePort => {
    let ports = portsByNode.get(node.id)
    if (!ports) {
      ports = new Map()
      portsByNode.set(node.id, ports)
    }
    const id = `${node.id}:port:${label}`
    const existing = ports.get(id)
    if (existing) return existing
    const port: NodePort = {
      id,
      label,
      connectors: [],
      provenance: { source: sourceId },
    }
    const speed = speedLabel(speedBps)
    if (speed) port.speed = speed
    ports.set(id, port)
    return port
  }

  for (const host of hosts) {
    const localNode = nodeByHostId.get(host.hostid)
    if (!localNode) continue
    for (const nbr of neighborsByHostId.get(host.hostid) ?? []) {
      if (!nbr.localIf || NO_NEIGHBOR.test(nbr.remSysname)) continue

      // resolve the remote end to a host node, else synthesize an external one
      let remoteNode = nodeBySysName.get(nbr.remSysname)
      if (!remoteNode) {
        if (!includeExternal) continue
        remoteNode = externalNodes.get(nbr.remSysname)
        if (!remoteNode) {
          remoteNode = {
            id: `${sourceId}:ext:${nbr.remSysname}`,
            label: nbr.remSysname,
            spec: { kind: 'hardware' },
            identity: buildIdentity({ sysName: nbr.remSysname, chassisId: nbr.remChassisId }),
            provenance: { source: sourceId, observedAt },
            metadata: { external: true },
          }
          externalNodes.set(nbr.remSysname, remoteNode)
        }
      }

      const localPort = ensurePort(localNode, nbr.localIf, nbr.speedBps)
      // Remote port label: the peer's port-id when it looks like a port name.
      // (When it's a MAC, this is still a stable per-link label; see de-dup note.)
      const remoteLabel = nbr.remPortId?.trim() || `to-${host.hostid}-${nbr.localIf}`
      const remotePort = ensurePort(remoteNode, remoteLabel)

      // De-dup the bidirectional LLDP report. Canonical key = the sorted pair of
      // endpoint port-ids; the mirror collapses when remPortId == the peer's
      // ifName (real port names). MAC-typed port-ids may not collapse — accepted.
      const key = [`${localNode.id}|${localPort.id}`, `${remoteNode.id}|${remotePort.id}`]
        .sort()
        .join('::')
      if (seenLinks.has(key)) continue
      seenLinks.add(key)

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
 * Group each node under its most-specific host group: among the host's
 * memberships (minus `groupExclude`), the group with the fewest members in this
 * import wins, so an admin / catch-all group that contains everything loses to
 * the real segment group. Mutates `staged[i].node.parent`; returns the subgraphs.
 */
function groupByMembership(
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
      memberCount.set(g.groupid, (memberCount.get(g.groupid) ?? 0) + 1)
    }
  }

  const usedGroups = new Map<string, string>() // groupid → name
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
    node.parent = `${sourceId}:sg:${primary.groupid}`
    usedGroups.set(primary.groupid, primary.name)
  }

  return [...usedGroups.entries()].map(([groupid, label]) => ({
    id: `${sourceId}:sg:${groupid}`,
    label,
    provenance: { source: sourceId, observedAt },
  }))
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

// --- best-effort device facts from inventory.hardware (Phase-3-lite) -------
// Standard Zabbix exposes no structured vendor/model/type, so we parse the
// free-text `inventory.hardware` (an SNMP sysDescr-style string). Best-effort:
// unknown fields are left undefined and the renderer falls back to a generic icon.

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
