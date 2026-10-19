/**
 * Zabbix → shumoku SourceNetwork converter.
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
  HardwareSpec,
  Identity,
  inputModel,
  NodeObservation,
  PortDesign,
  PortObservation,
  Provenance,
  SourceNetwork,
} from '@shumoku/core'
import { buildIdentity, DeviceType, rateFromBps } from '@shumoku/core'
import type { ZabbixHost, ZabbixLldpNeighbor } from './types.js'

export type GroupBy = 'none' | 'hostgroup'

export interface ConvertOptions {
  /** Source id stamped into `provenance.source` (the plugin instance id). */
  sourceId: string
  /** When the source observed this (Unix ms). Stamped on every entity. */
  observedAt: number
  /** How to derive groups. Default `'hostgroup'`. */
  groupBy?: GroupBy
  /** Host-group names to never use as a group (admin / catch-all groups). */
  groupExclude?: string[]
  /** Synthesize nodes for LLDP/tag neighbors that aren't Zabbix hosts. Default true. */
  includeExternalNeighbors?: boolean
  /** Host-tag name naming an upstream device (fallback link). Default `'PARENT'`. */
  parentTag?: string
}

/** A node's observation entry, built up as ports are discovered. */
type NodeObs = NodeObservation & {
  ports?: Record<string, PortObservation>
  metadata?: Record<string, unknown>
}

/** A host node staged before grouping (keeps its resolved host for membership). */
interface StagedNode {
  node: inputModel.Node
  host: ZabbixHost
}

/** Placeholder values the LLDP template uses when no neighbor was seen. */
const NO_NEIGHBOR = /^\s*(\*\s*no info\s*\*|-|unknown|)\s*$/i

/** `vendor/model`, `vendor`, or `?/model`; undefined when neither is known. */
function productOf(spec: HardwareSpec): string | undefined {
  if (spec.vendor) return spec.model ? `${spec.vendor}/${spec.model}` : spec.vendor
  return spec.model ? `?/${spec.model}` : undefined
}

function nodeOf(id: string, label: string, spec: HardwareSpec): inputModel.Node {
  const product = productOf(spec)
  return {
    id,
    label,
    ...(spec.type && { type: spec.type }),
    ...(product && { product }),
  }
}

/**
 * Convert hosts + their LLDP adjacencies (and SNMP sysDescr) into a SourceNetwork.
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
): SourceNetwork {
  const { sourceId, observedAt } = options
  const groupBy: GroupBy = options.groupBy ?? 'hostgroup'
  const includeExternal = options.includeExternalNeighbors ?? true
  const parentTag = options.parentTag ?? 'PARENT'

  // --- 1. Host nodes (group assigned during grouping). --------------------
  const staged: StagedNode[] = []
  const stagedByHostId = new Map<string, StagedNode>()
  const obsNodes: Record<string, NodeObs> = {}
  // Composite sysname lookup: each host's realSysname / host.host / host.name
  // are all registered so that LLDP TLVs (which carry the real sysname, not
  // the Zabbix display name) resolve to the existing host node instead of
  // generating a duplicate stub.
  const nodeIdBySysName = new Map<string, string>()
  for (const host of hosts) {
    // `inventory.name` carries the real system name (e.g. "acc-main-1f-01"),
    // while `host.name` is the Zabbix display name (e.g. "acc-main-1f-01 - Access Switch").
    // LLDP TLVs always report the real sysname, so we use it for identity.
    const realSysname = host.inventory?.['name']?.trim() || undefined
    const id = `${sourceId}:host:${host.hostid}`
    const label = host.name || host.host || host.hostid
    const spec = deriveSpec(host, sysDescrByHostId.get(host.hostid))
    obsNodes[id] = {
      identity: buildIdentity({
        mgmtIp: pickMgmtIp(host),
        // sysName = realSysname when available (from inventory.name), else
        // host.name. NOT host.host, which is the management IP here — using
        // it breaks neighbor resolution + clustering.
        sysName: realSysname ?? host.name ?? undefined,
        vendorIds: { 'zabbix-hostid': host.hostid },
      }),
      provenance: { source: sourceId, observedAt },
      metadata: {
        // FQDN for the compound layout (ghost detection + domain fallback band).
        hostname: host.name || host.host,
        zabbixHostId: host.hostid,
        zabbixHost: host.host,
        zabbixStatus: host.status === '0' ? 'monitored' : 'unmonitored',
        // Host-group names on the NODE (not just the region) so a topology
        // ScopeFilter `{attr:'metadata', key:'hostGroups'}` can match it directly.
        hostGroups: (host.hostgroups ?? []).map((g) => g.name),
      },
    }
    const entry: StagedNode = { node: nodeOf(id, label, spec), host }
    staged.push(entry)
    stagedByHostId.set(host.hostid, entry)
    // Register all name variants so LLDP neighbor resolution hits the host
    // node regardless of which name the remote TLV carries.
    if (realSysname) nodeIdBySysName.set(realSysname, id)
    if (host.host) nodeIdBySysName.set(host.host, id)
    if (host.name) nodeIdBySysName.set(host.name, id)
  }

  // --- 2. Grouping → nested groups (Zabbix '/' hierarchy) + node.group. ----
  const grouping =
    groupBy === 'hostgroup'
      ? groupByHostGroup(staged, sourceId, options.groupExclude ?? [])
      : { groups: [], ids: [], groupByHostId: new Map<string, string>() }
  const groupObs: Record<string, { provenance: Provenance }> = {}
  for (const id of grouping.ids) groupObs[id] = { provenance: { source: sourceId, observedAt } }

  // --- 3. Links: LLDP neighbors, then PARENT-tag fallback. -----------------
  const externalNodes = new Map<string, inputModel.Node>() // sysname → synthesized node
  const links: inputModel.Link[] = []
  const designNodes: Record<string, { ports: Record<string, PortDesign> }> = {}
  const obsLinks: Record<string, { provenance: Provenance }> = {}
  const seenLinks = new Set<string>() // canonical endpoint-port pairs
  const linkedNodePairs = new Set<string>() // canonical node pairs (for tag de-dup)

  // A port is keyed by its interface name, which is also what the link end writes.
  const ensurePort = (
    nodeId: string,
    label: string,
    identity?: Identity,
    speedBps?: number,
  ): string => {
    const obs = obsNodes[nodeId]
    if (!obs) return label
    const ports = obs.ports ?? {}
    obs.ports = ports
    const existing = ports[label]
    if (existing) {
      // Union identity keys across assertions (a port can be observed from more
      // than one host); existing keys win on conflict so the result is stable.
      if (identity) existing.identity = { ...identity, ...existing.identity }
      return label
    }
    ports[label] = { provenance: { source: sourceId }, ...(identity && { identity }) }
    const speed = speedLabel(speedBps)
    const design = designNodes[nodeId] ?? { ports: {} }
    designNodes[nodeId] = design
    design.ports[label] = { label, connectors: [], ...(speed && { speed }) }
    return label
  }

  const resolveRemote = (sysName: string, chassisId?: string): string | undefined => {
    const hostNodeId = nodeIdBySysName.get(sysName)
    if (hostNodeId) return hostNodeId
    if (!includeExternal) return undefined
    let ext = externalNodes.get(sysName)
    if (!ext) {
      ext = { id: `${sourceId}:ext:${sysName}`, label: sysName }
      externalNodes.set(sysName, ext)
      obsNodes[ext.id] = {
        identity: buildIdentity({ sysName, chassisId }),
        provenance: { source: sourceId, observedAt },
        metadata: { external: true, hostname: sysName },
      }
    }
    return ext.id
  }

  const nodePairKey = (a: string, b: string): string => [a, b].sort().join('::')

  const addLink = (
    from: { node: string; port: string },
    to: { node: string; port: string },
    speedBps?: number,
  ): void => {
    const id = `${sourceId}:link:${links.length}`
    links.push({
      id,
      endpoints: [from, to],
      ...(speedBps && speedBps > 0 && { speed: rateFromBps(speedBps) }),
    })
    obsLinks[id] = { provenance: { source: sourceId, observedAt } }
  }

  // 3a. LLDP links (the authoritative neighbor data).
  for (const host of hosts) {
    const local = stagedByHostId.get(host.hostid)
    if (!local) continue
    const localId = local.node.id
    for (const nbr of neighborsByHostId.get(host.hostid) ?? []) {
      if (!nbr.localIf || NO_NEIGHBOR.test(nbr.remSysname)) continue
      const remoteId = resolveRemote(nbr.remSysname, nbr.remChassisId)
      if (!remoteId || remoteId === localId) continue

      // Only the local interface name is an authoritative port key (from the
      // host's own `lldp.loc.if` data). The remote port-id alone can't be
      // classified (ifName vs MAC needs the LLDP port-id subtype, which the
      // template doesn't expose), so we don't stamp the remote port — that
      // peer's own scan stamps its ports from its local side anyway.
      const localPort = ensurePort(
        localId,
        nbr.localIf,
        buildIdentity({ ifName: nbr.localIf }),
        nbr.speedBps,
      )
      const remotePort = ensurePort(
        remoteId,
        nbr.remPortId?.trim() || `to-${host.hostid}-${nbr.localIf}`,
      )

      const key = nodePairKey(`${localId}|${localPort}`, `${remoteId}|${remotePort}`)
      if (seenLinks.has(key)) continue
      seenLinks.add(key)
      linkedNodePairs.add(nodePairKey(localId, remoteId))

      addLink(
        { node: localId, port: localPort },
        { node: remoteId, port: remotePort },
        nbr.speedBps,
      )
    }
  }

  // 3b. PARENT-tag fallback links — only where LLDP saw nothing between the pair.
  if (parentTag) {
    for (const { node, host } of staged) {
      const up = host.tags?.find((t) => t.tag === parentTag)?.value?.trim()
      if (!up) continue
      const upstreamId = resolveRemote(up)
      if (!upstreamId || upstreamId === node.id) continue
      if (linkedNodePairs.has(nodePairKey(node.id, upstreamId))) continue
      linkedNodePairs.add(nodePairKey(node.id, upstreamId))

      const fromPort = ensurePort(node.id, `parent:${up}`)
      const toPort = ensurePort(upstreamId, `child:${host.name || host.hostid}`)
      addLink({ node: node.id, port: fromPort }, { node: upstreamId, port: toPort })
    }
  }

  const nodes = [
    ...staged.map((s) => {
      const group = grouping.groupByHostId.get(s.host.hostid)
      return group ? { ...s.node, group } : s.node
    }),
    ...externalNodes.values(),
  ]

  return {
    network: {
      name: 'Zabbix',
      nodes,
      links,
      ...(grouping.groups.length > 0 && { groups: grouping.groups }),
    },
    design: { nodes: designNodes },
    observation: {
      nodes: obsNodes,
      links: obsLinks,
      ...(grouping.ids.length > 0 && { groups: groupObs }),
    },
  }
}

/**
 * Group nodes by their host group, honoring Zabbix's `/` nesting convention
 * ("A/B/C" → nested groups A ⊃ A/B ⊃ A/B/C). Each node lands in its
 * most-specific group: deepest `/` path, then fewest members (so an admin /
 * catch-all group that contains everything loses), then name. `groupExclude`
 * drops named admin groups outright. Returns the nested groups, every group id,
 * and the group each host (by hostid) lands in.
 */
function groupByHostGroup(
  staged: StagedNode[],
  sourceId: string,
  groupExclude: string[],
): { groups: inputModel.Group[]; ids: string[]; groupByHostId: Map<string, string> } {
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

  const groupByHostId = new Map<string, string>()
  const usedLeaves = new Set<string>()
  for (const { host } of staged) {
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
    groupByHostId.set(host.hostid, sgId(leaf.name))
    usedLeaves.add(leaf.name)
  }

  // Emit a group for each used leaf AND every '/' ancestor (Zabbix does not
  // create parent groups automatically, so synthesize the intermediate levels).
  interface Draft {
    id: string
    label: string
    children: Draft[]
  }
  const draftById = new Map<string, Draft>()
  const roots: Draft[] = []
  for (const leaf of usedLeaves) {
    const segs = leaf.split('/')
    for (const [i, seg] of segs.entries()) {
      const id = sgId(segs.slice(0, i + 1).join('/'))
      if (draftById.has(id)) continue
      const draft: Draft = { id, label: seg, children: [] }
      draftById.set(id, draft)
      const parent = i > 0 ? draftById.get(sgId(segs.slice(0, i).join('/'))) : undefined
      if (parent) parent.children.push(draft)
      else roots.push(draft)
    }
  }
  const toGroup = (d: Draft): inputModel.Group => ({
    id: d.id,
    label: d.label,
    ...(d.children.length > 0 && { groups: d.children.map(toGroup) }),
  })
  return { groups: roots.map(toGroup), ids: [...draftById.keys()], groupByHostId }
}

/** Humanize a bits/sec speed to a port label (e.g. 100000000000 → "100g"). */
function speedLabel(bps?: number): string | undefined {
  if (!bps || bps <= 0) return undefined
  if (bps % 1_000_000_000 === 0) return `${bps / 1_000_000_000}g`
  if (bps % 1_000_000 === 0) return `${bps / 1_000_000}m`
  return undefined
}

/** Management IP: default (`main==='1'`) interface with an IP, else first with an IP. */
function pickMgmtIp(host: ZabbixHost): string | undefined {
  const withIp = (host.interfaces ?? []).filter((i) => i.ip && i.ip.trim() !== '')
  if (withIp.length === 0) return undefined
  return (withIp.find((i) => i.main === '1') ?? withIp[0])?.ip
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

function deriveSpec(host: ZabbixHost, sysDescr?: string): HardwareSpec {
  const spec: HardwareSpec = { kind: 'hardware' }
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
