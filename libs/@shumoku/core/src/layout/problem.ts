// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Bounds, Link, NetworkGraph, Node, Subgraph } from '../models/types.js'
import { resolveNodeSize } from './engine/index.js'
import { linkSpeedBps } from './link-utils.js'
import { resolveTierFromSpec, type TierHint } from './role-tiers.js'

/** Synthetic location group subgraphs get this id prefix. */
export const ZONE_SUBGRAPH_PREFIX = '__zone:'

export type LayoutMode = 'role-driven' | 'discovered'
export type ConstraintPriority = 'hard' | 'semantic' | 'objective'

export interface LayoutNodeEntity {
  kind: 'node'
  id: string
  width: number
  height: number
  groupId?: string
  tier?: TierHint
  degree: number
}

export interface LayoutGroupBoundary {
  kind: 'group-boundary'
  id: string
  label: string
  source: 'subgraph' | 'location'
  memberIds: string[]
  layoutSubgraphId: string
  parentId?: string
  tier?: number
}

export type LayoutEntity = LayoutNodeEntity | LayoutGroupBoundary

export interface LayoutProblemLink {
  id: string
  from: string
  to: string
  bandwidthBps?: number
  fromGroupId?: string
  toGroupId?: string
}

export interface GroupAffinity {
  a: string
  b: string
  linkCount: number
  bandwidthBps: number
}

export type LinkIntentKind =
  | 'primary-downstream'
  | 'same-tier-peer'
  | 'redundancy-coupling'
  | 'cross-group-through'
  | 'local-fanout'
  | 'unknown'

export type RoutingGrammar =
  | 'direct-orthogonal'
  | 'lateral-ramp'
  | 'coupling-bridge'
  | 'long-gutter'
  | 'comb-bus'
  | 'independent-polyline'

export interface RoutingIntent {
  linkId: string
  from: string
  to: string
  kind: LinkIntentKind
  allowedGrammars: RoutingGrammar[]
}

export type GeometryConstraint =
  | { kind: 'non-overlap'; target: 'nodes' | 'groups'; priority: 'hard' }
  | { kind: 'containment'; parentGroupId: string; childNodeIds: string[]; priority: 'hard' }
  | { kind: 'port-label-clearance'; target: 'nodes'; priority: 'hard' }

export type SemanticConstraint =
  | {
      kind: 'tier-order'
      beforeNodeId: string
      afterNodeId: string
      priority: 'semantic'
      reason: 'device-tier' | 'link-direction'
    }
  | {
      kind: 'same-rank-horizontal'
      groupIds: string[]
      tier: number
      priority: 'semantic'
    }
  | {
      kind: 'apex-centering'
      apexNodeId: string
      childNodeIds: string[]
      priority: 'semantic'
      tolerancePx: number
    }

export type LayoutObjective =
  | { kind: 'edge-length'; priority: 'objective' }
  | { kind: 'edge-crossings'; priority: 'objective' }
  | { kind: 'compactness'; priority: 'objective'; appliesTo: LayoutMode }
  | { kind: 'symmetry'; priority: 'objective' }

export interface LayoutProblemDiagnostics {
  mode: LayoutMode
  roleDriven: boolean
  apexNodeId?: string
  typedDegreeNodes: number
  degreeNodes: number
}

export interface LayoutProblem {
  mode: LayoutMode
  entities: LayoutEntity[]
  nodes: LayoutNodeEntity[]
  groups: LayoutGroupBoundary[]
  links: LayoutProblemLink[]
  groupAffinities: GroupAffinity[]
  routingIntents: RoutingIntent[]
  hardConstraints: GeometryConstraint[]
  semanticConstraints: SemanticConstraint[]
  objectives: LayoutObjective[]
  diagnostics: LayoutProblemDiagnostics
  /**
   * Depth rank per node — the single structural source the placement solves
   * against (role-driven: eccentricity-apex BFS; discovered: apex BFS). The
   * solver consumes this instead of recomputing it from the raw graph.
   */
  ranks: ReadonlyMap<string, number>
  /** High fan-out / thin-link nodes BFS must not traverse through. */
  sinks: ReadonlySet<string>
}

export interface SemanticLayoutViolation {
  kind: SemanticConstraint['kind']
  severity: 'error' | 'warning'
  message: string
  ids: string[]
  actual?: number
  expected?: number
}

export interface SemanticLayoutReport {
  ok: boolean
  violations: SemanticLayoutViolation[]
  counts: Record<SemanticConstraint['kind'], number>
}

interface GroupCandidate {
  id: string
  label: string
  source: 'subgraph' | 'location'
  layoutSubgraphId: string
  parentId?: string
}

export function isRoleDrivenGraph(graph: NetworkGraph): boolean {
  const degree = nodeDegrees(graph.links)
  let typed = 0
  let withDegree = 0
  for (const node of graph.nodes) {
    if ((degree.get(node.id) ?? 0) === 0) continue
    withDegree++
    if (resolveTierFromSpec(node.spec)?.source === 'device-type') typed++
  }
  return withDegree > 0 && typed / withDegree >= 0.5
}
export function buildLayoutProblem(graph: NetworkGraph): LayoutProblem {
  const degree = nodeDegrees(graph.links)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const roleDriven = isRoleDrivenGraph(graph)
  const mode: LayoutMode = roleDriven ? 'role-driven' : 'discovered'
  const groupByNode = deriveNodeGroups(graph)
  const groups = buildGroups(graph, groupByNode, nodeById)
  const nodes = graph.nodes.map((node): LayoutNodeEntity => {
    const size = resolveNodeSize(node)
    const groupId = groupByNode.get(node.id)
    return {
      kind: 'node',
      id: node.id,
      width: size.width,
      height: size.height,
      groupId,
      tier: resolveTierFromSpec(node.spec) ?? undefined,
      degree: degree.get(node.id) ?? 0,
    }
  })

  const links = graph.links.map((link, index): LayoutProblemLink => {
    const fromGroupId = groupByNode.get(link.from.node)
    const toGroupId = groupByNode.get(link.to.node)
    const bandwidthBps = linkSpeedBps(link) ?? undefined
    return {
      id: link.id ?? `__link_${index}`,
      from: link.from.node,
      to: link.to.node,
      bandwidthBps,
      fromGroupId,
      toGroupId,
    }
  })

  // Structure is derived ONCE here and carried on the IR (ranks + sinks); the
  // solver consumes it rather than recomputing from the raw graph.
  const sinks = computeStructuralSinks(graph)
  const roleRanks =
    mode === 'role-driven' ? computeRoleDrivenRanks(graph, sinks) : new Map<string, number>()
  // Single apex source of truth. Role-driven derives it from the shared rank
  // (the rank-0 root the placement grows the tree from), NEVER raw link
  // direction — so the diagnostics/verify layer sees the same apex the layout
  // is actually built around. Discovered has no roles, so it keeps the
  // structural fallback.
  const apexNodeId =
    mode === 'role-driven' ? apexFromRanks(roleRanks, nodes) : chooseApex(nodes, graph)?.id
  const ranks =
    mode === 'role-driven' ? roleRanks : computeDiscoveredRanks(graph, apexNodeId, degree)
  // Group rank = its shallowest member's depth — the SAME value the solver
  // bands the group at (plan.rank = minDepth). same-rank-horizontal and the
  // placement therefore agree on which groups share a row.
  for (const group of groups) {
    group.tier = groupRank(group, ranks)
  }
  const semanticConstraints = buildSemanticConstraints(
    graph,
    groups,
    mode,
    degree,
    roleRanks,
    apexNodeId,
  )
  const hardConstraints: GeometryConstraint[] = [
    { kind: 'non-overlap', target: 'nodes', priority: 'hard' },
    { kind: 'non-overlap', target: 'groups', priority: 'hard' },
    { kind: 'port-label-clearance', target: 'nodes', priority: 'hard' },
  ]
  for (const group of groups) {
    hardConstraints.push({
      kind: 'containment',
      parentGroupId: group.id,
      childNodeIds: group.memberIds,
      priority: 'hard',
    })
  }

  const typedDegreeNodes = nodes.filter(
    (node) => node.degree > 0 && node.tier?.source === 'device-type',
  ).length
  const degreeNodes = nodes.filter((node) => node.degree > 0).length

  return {
    mode,
    entities: [...nodes, ...groups],
    nodes,
    groups,
    links,
    groupAffinities: buildGroupAffinities(links),
    routingIntents: buildRoutingIntents(graph, links, nodes, mode, roleRanks),
    hardConstraints,
    semanticConstraints,
    objectives: [
      { kind: 'edge-length', priority: 'objective' },
      { kind: 'edge-crossings', priority: 'objective' },
      { kind: 'compactness', priority: 'objective', appliesTo: mode },
      { kind: 'symmetry', priority: 'objective' },
    ],
    diagnostics: {
      mode,
      roleDriven,
      apexNodeId,
      typedDegreeNodes,
      degreeNodes,
    },
    ranks,
    sinks,
  }
}

export function verifySemanticLayout(
  problem: LayoutProblem,
  nodes: ReadonlyMap<string, Node>,
  subgraphs: ReadonlyMap<string, Subgraph> = new Map(),
): SemanticLayoutReport {
  const violations: SemanticLayoutViolation[] = []
  for (const constraint of problem.semanticConstraints) {
    switch (constraint.kind) {
      case 'tier-order': {
        const before = nodes.get(constraint.beforeNodeId)?.position
        const after = nodes.get(constraint.afterNodeId)?.position
        if (!before || !after) break
        if (before.y > after.y + 1) {
          violations.push({
            kind: constraint.kind,
            severity: 'error',
            message: `${constraint.beforeNodeId} is below ${constraint.afterNodeId}`,
            ids: [constraint.beforeNodeId, constraint.afterNodeId],
            actual: before.y - after.y,
            expected: 0,
          })
        }
        break
      }
      case 'same-rank-horizontal': {
        const centers = constraint.groupIds
          .map((id) => groupCenterY(problem, id, nodes, subgraphs))
          .filter((value): value is number => value !== undefined)
        if (centers.length < 2) break
        const min = Math.min(...centers)
        const max = Math.max(...centers)
        const spread = max - min
        if (spread > 160) {
          violations.push({
            kind: constraint.kind,
            severity: 'warning',
            message: `same-rank groups are vertically spread by ${Math.round(spread)}px`,
            ids: constraint.groupIds,
            actual: spread,
            expected: 160,
          })
        }
        break
      }
      case 'apex-centering': {
        const apex = nodes.get(constraint.apexNodeId)?.position
        if (!apex) break
        const childXs = constraint.childNodeIds
          .map((id) => nodes.get(id)?.position?.x)
          .filter((value): value is number => value !== undefined)
        if (childXs.length < 2) break
        const centroid = childXs.reduce((sum, x) => sum + x, 0) / childXs.length
        const delta = Math.abs(apex.x - centroid)
        if (delta > constraint.tolerancePx) {
          violations.push({
            kind: constraint.kind,
            severity: 'warning',
            message: `${constraint.apexNodeId} is ${Math.round(delta)}px from child centroid`,
            ids: [constraint.apexNodeId, ...constraint.childNodeIds],
            actual: delta,
            expected: constraint.tolerancePx,
          })
        }
        break
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    counts: {
      'tier-order': violations.filter((v) => v.kind === 'tier-order').length,
      'same-rank-horizontal': violations.filter((v) => v.kind === 'same-rank-horizontal').length,
      'apex-centering': violations.filter((v) => v.kind === 'apex-centering').length,
    },
  }
}

function nodeDegrees(links: readonly Link[]): Map<string, number> {
  const degree = new Map<string, number>()
  for (const link of links) {
    degree.set(link.from.node, (degree.get(link.from.node) ?? 0) + 1)
    degree.set(link.to.node, (degree.get(link.to.node) ?? 0) + 1)
  }
  return degree
}

/**
 * Role-driven depth rank, robust to UNDIRECTED inventory cables (NetBox/Zabbix
 * arrow:none). Direction can't be trusted, so the root is chosen by role +
 * structure (the most peripheral boundary device = WAN edge) and depth is the
 * BFS distance over the undirected graph — not raw link from→to (which makes a
 * node whose cable happens to point "outward" a false source, e.g. a server at
 * the top). High fan-out / thin-link sinks are not traversed through; a second
 * pass reaches nodes that sit behind them.
 */
export function computeRoleDrivenRanks(
  graph: NetworkGraph,
  sinks: ReadonlySet<string> = computeStructuralSinks(graph),
): Map<string, number> {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  // Rank derivation only needs adjacency — bandwidth is already folded into
  // `sinks` (the one place the 8/thin-link threshold lives).
  const neighbors = new Map<string, Set<string>>()
  for (const node of graph.nodes) neighbors.set(node.id, new Set())
  for (const link of graph.links) {
    if (
      !nodeById.has(link.from.node) ||
      !nodeById.has(link.to.node) ||
      link.from.node === link.to.node
    ) {
      continue
    }
    neighbors.get(link.from.node)?.add(link.to.node)
    neighbors.get(link.to.node)?.add(link.from.node)
  }
  const degreeOf = (id: string): number => neighbors.get(id)?.size ?? 0
  const tierOf = (id: string): number | undefined =>
    resolveTierFromSpec(nodeById.get(id)?.spec)?.tier

  // Default apex: lowest device tier among non-sink, degree-bearing nodes.
  let bestTier = Number.POSITIVE_INFINITY
  for (const node of graph.nodes) {
    if (degreeOf(node.id) === 0 || sinks.has(node.id)) continue
    const tier = tierOf(node.id)
    if (tier !== undefined) bestTier = Math.min(bestTier, tier)
  }
  let roots = graph.nodes
    .filter((node) => tierOf(node.id) === bestTier && degreeOf(node.id) > 0 && !sinks.has(node.id))
    .map((node) => node.id)

  // Among boundary devices (≤ Router), root at the most PERIPHERAL one
  // (max BFS eccentricity = the WAN edge). The device-type table alone ranks
  // firewall above router and would hoist an internal firewall over the edge.
  const BOUNDARY_TIER = 20
  const eccOf = (start: string): number => {
    const seen = new Set([start])
    const work: Array<[string, number]> = [[start, 0]]
    let max = 0
    while (work.length > 0) {
      const entry = work.shift()
      if (entry === undefined) break
      const [current, distance] = entry
      if (sinks.has(current)) continue
      max = Math.max(max, distance)
      for (const next of [...(neighbors.get(current)?.keys() ?? [])].sort()) {
        if (seen.has(next)) continue
        seen.add(next)
        work.push([next, distance + 1])
      }
    }
    return max
  }
  const boundary = graph.nodes
    .filter(
      (node) =>
        degreeOf(node.id) > 0 &&
        !sinks.has(node.id) &&
        (tierOf(node.id) ?? Number.POSITIVE_INFINITY) <= BOUNDARY_TIER,
    )
    .map((node) => node.id)
  if (boundary.length > 0) {
    const ecc = new Map(boundary.map((id) => [id, eccOf(id)]))
    let maxEcc = -1
    for (const value of ecc.values()) maxEcc = Math.max(maxEcc, value)
    const eccRoots = boundary.filter((id) => ecc.get(id) === maxEcc)
    if (eccRoots.length > 0) roots = eccRoots
  }
  if (roots.length === 0) {
    const best = [...graph.nodes].sort(
      (a, b) => degreeOf(b.id) - degreeOf(a.id) || (a.id < b.id ? -1 : 1),
    )[0]
    roots = best ? [best.id] : []
  }

  const ranks = new Map<string, number>()
  const queue: string[] = []
  for (const root of roots) {
    ranks.set(root, 0)
    queue.push(root)
  }
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (sinks.has(current)) continue
    const depth = ranks.get(current) ?? 0
    for (const next of [...(neighbors.get(current)?.keys() ?? [])].sort()) {
      if (ranks.has(next)) continue
      ranks.set(next, depth + 1)
      queue.push(next)
    }
  }
  // Second pass: reach nodes only reachable THROUGH a sink (access behind a
  // high fan-out distribution switch) so they sit below their connector.
  const seeded = graph.nodes.filter((node) => ranks.has(node.id)).map((node) => node.id)
  while (seeded.length > 0) {
    const current = seeded.shift()
    if (current === undefined) break
    const depth = ranks.get(current) ?? 0
    for (const next of [...(neighbors.get(current)?.keys() ?? [])].sort()) {
      if (ranks.has(next)) continue
      ranks.set(next, depth + 1)
      seeded.push(next)
    }
  }
  for (const node of graph.nodes) if (!ranks.has(node.id)) ranks.set(node.id, 0)
  return normalizeRanks(ranks)
}

function normalizeRanks(ranks: ReadonlyMap<string, number>): Map<string, number> {
  const finite = [...ranks.values()].filter(Number.isFinite)
  const min = finite.length > 0 ? Math.min(...finite) : 0
  const normalized = new Map<string, number>()
  for (const [id, rank] of ranks) normalized.set(id, Number.isFinite(rank) ? rank - min : 0)
  return normalized
}

/**
 * High fan-out, thin-link nodes (a distribution/access switch fanning out to
 * many endpoints on links far thinner than the network's fat trunks). BFS
 * must not traverse THROUGH these — otherwise the far side of the fan reads as
 * "one hop past a switch" and floats up a tier. The single home for the
 * degree/bandwidth threshold, consumed by both the rank derivation and the IR.
 */
export function computeStructuralSinks(graph: NetworkGraph): Set<string> {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const bwByNeighbor = new Map<string, Map<string, number>>()
  for (const node of graph.nodes) bwByNeighbor.set(node.id, new Map())
  let maxBw = 0
  for (const link of graph.links) {
    if (
      !nodeById.has(link.from.node) ||
      !nodeById.has(link.to.node) ||
      link.from.node === link.to.node
    ) {
      continue
    }
    const bw = linkSpeedBps(link) ?? 0
    maxBw = Math.max(maxBw, bw)
    const from = bwByNeighbor.get(link.from.node)
    const to = bwByNeighbor.get(link.to.node)
    from?.set(link.to.node, Math.max(from.get(link.to.node) ?? 0, bw))
    to?.set(link.from.node, Math.max(to.get(link.from.node) ?? 0, bw))
  }
  const sinks = new Set<string>()
  for (const node of graph.nodes) {
    const adjacency = bwByNeighbor.get(node.id)
    const degree = adjacency?.size ?? 0
    let nodeMax = 0
    for (const bw of adjacency?.values() ?? []) nodeMax = Math.max(nodeMax, bw)
    if (degree >= 8 && maxBw > 0 && nodeMax < maxBw * 0.5) sinks.add(node.id)
  }
  return sinks
}

/**
 * Discovered-mode depth: plain BFS distance from the structural apex over the
 * undirected graph (no roles to lean on). Unreached nodes fall back by degree.
 * Role-driven uses {@link computeRoleDrivenRanks}; both land on the IR's
 * `ranks` so the solver never re-derives depth from the raw graph.
 */
function computeDiscoveredRanks(
  graph: NetworkGraph,
  apexNodeId: string | undefined,
  degree: ReadonlyMap<string, number>,
): Map<string, number> {
  const neighbors = new Map<string, Set<string>>()
  for (const node of graph.nodes) neighbors.set(node.id, new Set())
  for (const link of graph.links) {
    if (link.from.node === link.to.node) continue
    neighbors.get(link.from.node)?.add(link.to.node)
    neighbors.get(link.to.node)?.add(link.from.node)
  }
  const apex =
    apexNodeId ??
    [...graph.nodes].sort(
      (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || (a.id < b.id ? -1 : 1),
    )[0]?.id
  const ranks = new Map<string, number>()
  const queue: string[] = []
  if (apex !== undefined) {
    ranks.set(apex, 0)
    queue.push(apex)
  }
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    const depth = ranks.get(current) ?? 0
    for (const next of [...(neighbors.get(current) ?? [])].sort()) {
      if (ranks.has(next)) continue
      ranks.set(next, depth + 1)
      queue.push(next)
    }
  }
  for (const node of graph.nodes) {
    if (!ranks.has(node.id)) ranks.set(node.id, (degree.get(node.id) ?? 0) === 0 ? 99 : 10)
  }
  return normalizeRanks(ranks)
}

function isLateralDependencyLink(link: Link, graph: NetworkGraph): boolean {
  if (link.redundancy !== undefined) return true
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const from = nodeById.get(link.from.node)
  const to = nodeById.get(link.to.node)
  if (!from || !to) return false
  if (from.parent !== to.parent) return false
  const fromStem = labelStem(from)
  const toStem = labelStem(to)
  if (fromStem === '' || toStem === '') return false
  return fromStem === toStem
}

function labelStem(node: Node): string {
  const label = Array.isArray(node.label) ? (node.label[0] ?? node.id) : (node.label ?? node.id)
  const plain =
    label
      .replace(/<[^>]*>/g, '')
      .trim()
      .split(/\s+/)[0] ?? node.id
  const host = plain.split('.')[0] ?? plain
  return host.toLowerCase().replace(/(?:[-_.]?\d+)+$/, '')
}

function deriveNodeGroups(graph: NetworkGraph): Map<string, string> {
  const subgraphs = new Set((graph.subgraphs ?? []).map((subgraph) => subgraph.id))
  const groups = new Map<string, string>()
  for (const node of graph.nodes) {
    if (node.parent && subgraphs.has(node.parent)) {
      groups.set(node.id, node.parent)
      continue
    }
    const location = node.metadata?.['location']
    if (typeof location === 'string' && location !== '') groups.set(node.id, `location:${location}`)
  }
  return groups
}

function buildGroups(
  graph: NetworkGraph,
  groupByNode: ReadonlyMap<string, string>,
  nodeById: ReadonlyMap<string, Node>,
): LayoutGroupBoundary[] {
  const candidates = new Map<string, GroupCandidate>()
  for (const subgraph of graph.subgraphs ?? []) {
    candidates.set(subgraph.id, {
      id: subgraph.id,
      label: subgraph.label,
      source: 'subgraph',
      layoutSubgraphId: subgraph.id,
      parentId: subgraph.parent,
    })
  }
  for (const [nodeId, groupId] of groupByNode) {
    if (candidates.has(groupId) || !nodeById.has(nodeId)) continue
    const location = groupId.startsWith('location:') ? groupId.slice('location:'.length) : groupId
    candidates.set(groupId, {
      id: groupId,
      label: location,
      source: 'location',
      layoutSubgraphId: `${ZONE_SUBGRAPH_PREFIX}${location}`,
    })
  }

  const members = new Map<string, string[]>()
  for (const [nodeId, groupId] of groupByNode) {
    const list = members.get(groupId)
    if (list) list.push(nodeId)
    else members.set(groupId, [nodeId])
  }

  const groups: LayoutGroupBoundary[] = []
  for (const candidate of candidates.values()) {
    const memberIds = members.get(candidate.id) ?? []
    if (memberIds.length === 0) continue
    groups.push({
      kind: 'group-boundary',
      id: candidate.id,
      label: candidate.label,
      source: candidate.source,
      memberIds: [...memberIds].sort(),
      layoutSubgraphId: candidate.layoutSubgraphId,
      parentId: candidate.parentId,
    })
  }
  return groups.sort((a, b) => (a.id < b.id ? -1 : 1))
}

function groupRank(
  group: LayoutGroupBoundary,
  ranks: ReadonlyMap<string, number>,
): number | undefined {
  let min: number | undefined
  for (const id of group.memberIds) {
    const rank = ranks.get(id)
    if (rank === undefined) continue
    min = min === undefined ? rank : Math.min(min, rank)
  }
  return min
}

function buildSemanticConstraints(
  graph: NetworkGraph,
  groups: readonly LayoutGroupBoundary[],
  mode: LayoutMode,
  degree: ReadonlyMap<string, number>,
  ranks: ReadonlyMap<string, number>,
  apexNodeId: string | undefined,
): SemanticConstraint[] {
  if (mode !== 'role-driven') return []
  const constraints: SemanticConstraint[] = []
  for (const link of graph.links) {
    if (link.from.node === link.to.node || isLateralDependencyLink(link, graph)) continue
    // Orient by the role-driven depth rank, not raw from→to: cables are
    // undirected, so the shallower (closer-to-apex) endpoint is "above". Skip
    // same-rank links — they carry no tier order.
    const rankFrom = ranks.get(link.from.node)
    const rankTo = ranks.get(link.to.node)
    if (rankFrom === undefined || rankTo === undefined || rankFrom === rankTo) continue
    constraints.push({
      kind: 'tier-order',
      beforeNodeId: rankFrom < rankTo ? link.from.node : link.to.node,
      afterNodeId: rankFrom < rankTo ? link.to.node : link.from.node,
      priority: 'semantic',
      reason: 'link-direction',
    })
  }

  const groupsByTier = new Map<number, string[]>()
  for (const group of groups) {
    if (group.tier === undefined) continue
    const list = groupsByTier.get(group.tier)
    if (list) list.push(group.id)
    else groupsByTier.set(group.tier, [group.id])
  }
  for (const [tier, groupIds] of groupsByTier) {
    if (groupIds.length < 2) continue
    constraints.push({
      kind: 'same-rank-horizontal',
      groupIds: [...groupIds].sort(),
      tier,
      priority: 'semantic',
    })
  }

  if (apexNodeId !== undefined) {
    // Children = the apex's UNDIRECTED neighbours one rank deeper (rank+1),
    // not link.from→to (cables are undirected). Same rank source as the
    // placement, so the centring target matches what actually gets drawn.
    const apexRank = ranks.get(apexNodeId) ?? 0
    const childNodeIds = [
      ...new Set(
        graph.links.flatMap((link) => {
          if (isLateralDependencyLink(link, graph)) return []
          if (link.from.node === apexNodeId) return [link.to.node]
          if (link.to.node === apexNodeId) return [link.from.node]
          return []
        }),
      ),
    ]
      .filter((id) => (degree.get(id) ?? 0) > 0 && ranks.get(id) === apexRank + 1)
      .sort()
    if (childNodeIds.length >= 2) {
      constraints.push({
        kind: 'apex-centering',
        apexNodeId,
        childNodeIds,
        priority: 'semantic',
        tolerancePx: 220,
      })
    }
  }

  return constraints
}

/**
 * The role-driven apex is the shared rank's root: the shallowest (rank-0)
 * degree-bearing node, tie-broken by id — the SAME node the placement grows
 * the tree from. Deriving diagnostics + apex-centring from this instead of a
 * second, direction-based heuristic keeps the verify layer honest on
 * undirected cables, where raw from→to is arbitrary.
 */
function apexFromRanks(
  ranks: ReadonlyMap<string, number>,
  nodes: readonly LayoutNodeEntity[],
): string | undefined {
  const degreeById = new Map(nodes.map((node) => [node.id, node.degree]))
  let best: string | undefined
  let bestRank = Number.POSITIVE_INFINITY
  for (const [id, rank] of ranks) {
    if ((degreeById.get(id) ?? 0) === 0) continue
    if (best === undefined || rank < bestRank || (rank === bestRank && id < best)) {
      bestRank = rank
      best = id
    }
  }
  return best
}

/** Structural apex for discovered mode (no roles): the directed source with
 * the lowest tier / highest out-degree. Role-driven uses {@link apexFromRanks}. */
function chooseApex(
  nodes: readonly LayoutNodeEntity[],
  graph: NetworkGraph,
): LayoutNodeEntity | undefined {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const incoming = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map(nodes.map((node) => [node.id, 0]))
  for (const link of graph.links) {
    if (!nodeById.has(link.from.node) || !nodeById.has(link.to.node)) continue
    if (link.from.node === link.to.node || isLateralDependencyLink(link, graph)) continue
    outgoing.set(link.from.node, (outgoing.get(link.from.node) ?? 0) + 1)
    incoming.set(link.to.node, (incoming.get(link.to.node) ?? 0) + 1)
  }
  const sources = nodes.filter(
    (node) =>
      node.degree > 0 && (incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) > 0,
  )
  const candidates = sources.length > 0 ? sources : nodes.filter((node) => node.degree > 0)
  if (candidates.length === 0) return undefined
  return [...candidates].sort((a, b) => {
    const outA = outgoing.get(a.id) ?? 0
    const outB = outgoing.get(b.id) ?? 0
    const tierA = a.tier?.tier ?? Number.POSITIVE_INFINITY
    const tierB = b.tier?.tier ?? Number.POSITIVE_INFINITY
    return tierA - tierB || outB - outA || b.degree - a.degree || (a.id < b.id ? -1 : 1)
  })[0]
}

function buildRoutingIntents(
  graph: NetworkGraph,
  links: readonly LayoutProblemLink[],
  nodes: readonly LayoutNodeEntity[],
  mode: LayoutMode,
  ranks: ReadonlyMap<string, number>,
): RoutingIntent[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  return links.map((link, index) => {
    const source = graph.links[index]
    const fromRank = ranks.get(link.from)
    const toRank = ranks.get(link.to)
    const from = nodeById.get(link.from)
    const to = nodeById.get(link.to)
    if (!source || !from || !to) return unknownRoutingIntent(link)
    if (source.redundancy !== undefined) {
      return {
        linkId: link.id,
        from: link.from,
        to: link.to,
        kind: 'redundancy-coupling',
        allowedGrammars: ['coupling-bridge'],
      }
    }
    if (mode === 'role-driven' && isLateralDependencyLink(source, graph)) {
      return {
        linkId: link.id,
        from: link.from,
        to: link.to,
        kind: 'same-tier-peer',
        allowedGrammars: ['direct-orthogonal', 'lateral-ramp'],
      }
    }
    if (fromRank !== undefined && toRank !== undefined && fromRank === toRank) {
      const sameGroup = link.fromGroupId !== undefined && link.fromGroupId === link.toGroupId
      return {
        linkId: link.id,
        from: link.from,
        to: link.to,
        kind: sameGroup ? 'same-tier-peer' : 'unknown',
        allowedGrammars: sameGroup
          ? ['direct-orthogonal', 'lateral-ramp']
          : ['independent-polyline'],
      }
    }
    const rankSpan =
      fromRank !== undefined && toRank !== undefined ? Math.abs(fromRank - toRank) : undefined
    const crossGroup =
      link.fromGroupId !== undefined &&
      link.toGroupId !== undefined &&
      link.fromGroupId !== link.toGroupId
    const lower =
      fromRank !== undefined && toRank !== undefined ? (fromRank > toRank ? from : to) : undefined
    if (lower && lower.degree <= 2) {
      return {
        linkId: link.id,
        from: link.from,
        to: link.to,
        kind: 'local-fanout',
        allowedGrammars: ['direct-orthogonal'],
      }
    }
    if (crossGroup && (rankSpan ?? 0) > 1) {
      return {
        linkId: link.id,
        from: link.from,
        to: link.to,
        kind: 'cross-group-through',
        allowedGrammars: ['direct-orthogonal', 'long-gutter'],
      }
    }
    if (rankSpan !== undefined && rankSpan > 0) {
      return {
        linkId: link.id,
        from: link.from,
        to: link.to,
        kind: 'primary-downstream',
        allowedGrammars: ['direct-orthogonal'],
      }
    }
    return unknownRoutingIntent(link)
  })
}

function unknownRoutingIntent(link: LayoutProblemLink): RoutingIntent {
  return {
    linkId: link.id,
    from: link.from,
    to: link.to,
    kind: 'unknown',
    allowedGrammars: ['independent-polyline'],
  }
}
function buildGroupAffinities(links: readonly LayoutProblemLink[]): GroupAffinity[] {
  const byPair = new Map<string, GroupAffinity>()
  for (const link of links) {
    if (!link.fromGroupId || !link.toGroupId || link.fromGroupId === link.toGroupId) continue
    const a = link.fromGroupId < link.toGroupId ? link.fromGroupId : link.toGroupId
    const b = link.fromGroupId < link.toGroupId ? link.toGroupId : link.fromGroupId
    const key = `${a}|${b}`
    const existing = byPair.get(key)
    if (existing) {
      existing.linkCount++
      existing.bandwidthBps += link.bandwidthBps ?? 0
    } else {
      byPair.set(key, {
        a,
        b,
        linkCount: 1,
        bandwidthBps: link.bandwidthBps ?? 0,
      })
    }
  }
  return [...byPair.values()].sort((a, b) => (a.a < b.a ? -1 : a.a > b.a ? 1 : a.b < b.b ? -1 : 1))
}

function groupCenterY(
  problem: LayoutProblem,
  groupId: string,
  nodes: ReadonlyMap<string, Node>,
  subgraphs: ReadonlyMap<string, Subgraph>,
): number | undefined {
  const group = problem.groups.find((candidate) => candidate.id === groupId)
  if (!group) return undefined
  const bounds = subgraphs.get(group.layoutSubgraphId)?.bounds
  if (bounds) return centerY(bounds)
  const memberYs = group.memberIds
    .map((id) => nodes.get(id)?.position?.y)
    .filter((value): value is number => value !== undefined)
  if (memberYs.length === 0) return undefined
  return memberYs.reduce((sum, y) => sum + y, 0) / memberYs.length
}

function centerY(bounds: Bounds): number {
  return bounds.y + bounds.height / 2
}
