// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Bounds, Direction, Link, NetworkGraph, Node, Subgraph } from '../../models/types.js'
import { resolveNodeSize } from '../engine/index.js'
import { linkSpeedBps } from '../link-utils.js'
import {
  buildLayoutProblem,
  type LayoutGroupBoundary,
  type LayoutNodeEntity,
  type LayoutProblem,
  ZONE_SUBGRAPH_PREFIX,
} from '../problem.js'

export interface CompositeLayoutOptions {
  direction?: Direction
  zoneGap?: number
  bandGap?: number
  rowGap?: number
  cellGapX?: number
  zonePad?: number
  pairFlips?: ReadonlySet<string>
  bandExtra?: ReadonlyMap<number, number>
  bandOrder?: ReadonlyMap<number, readonly string[]>
  nudges?: ReadonlyMap<string, number>
  maxBandW?: number
  minNodeWidths?: ReadonlyMap<string, number>
  minNodeHeights?: ReadonlyMap<string, number>
}

export interface CompositeLayoutResult {
  nodes: Map<string, Node>
  subgraphs: Map<string, Subgraph>
  bounds: Bounds
  zones: Map<string, string[]>
  pairs: string[]
  bands: { top: number; bottom: number }[]
  primaryEdges: Set<string>
  sinks: string[]
  heartbeats: Set<string>
  depths: Map<string, number>
  bandBlocks: string[][]
  scopes: string[]
  /** The IR this layout solves — reused by the search for routing/verify so
   *  the problem is built once per variant, not twice. */
  problem: LayoutProblem
}

interface LogicalEdge {
  a: string
  b: string
  bw: number
  count: number
  redundancy: boolean
}

interface Unit {
  id: string
  members: string[]
  width: number
  height: number
  depth: number
  groupId?: string
}

interface PlacedUnit extends Unit {
  x: number
  y: number
}

interface GroupPlan {
  group: LayoutGroupBoundary
  units: PlacedUnit[]
  width: number
  height: number
  rank: number
}

interface GlobalItem {
  id: string
  kind: 'group' | 'unit'
  width: number
  height: number
  rank: number
  desiredX: number
  groupPlan?: GroupPlan
  unit?: Unit
}

interface PlacedGlobalItem extends GlobalItem {
  x: number
  y: number
}

interface RowItem {
  id: string
  width: number
  height: number
  desiredX: number
}

const DEFAULT_NODE_GAP = 44
const DEFAULT_GROUP_GAP = 120
const DEFAULT_BAND_GAP = 180
const DEFAULT_ROLE_ROW_GAP = 148
const DEFAULT_GROUP_PAD = 32
const GROUP_LABEL_H = 28
const PAIR_GAP = 16

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

export { ZONE_SUBGRAPH_PREFIX }

export function shouldUseComposite(graph: NetworkGraph): boolean {
  if (graph.nodes.length < 10) return false
  let grouped = 0
  for (const node of graph.nodes) {
    const location = node.metadata?.['location']
    if (node.parent || (typeof location === 'string' && location !== '')) grouped++
  }
  return grouped / graph.nodes.length >= 0.5
}

export function layoutComposite(
  graph: NetworkGraph,
  options: CompositeLayoutOptions = {},
): CompositeLayoutResult {
  const nodes = cloneNodesWithSizeFloors(graph, options)
  const graphForProblem: NetworkGraph = { ...graph, nodes: [...nodes.values()] }
  const problem = buildLayoutProblem(graphForProblem)
  const logicalEdges = aggregateLinks(graph.links, nodes)
  // Depth ranks + sinks are derived once on the IR — the solver consumes them
  // instead of recomputing structure from the raw graph.
  const depths = new Map(problem.ranks)
  const sinks = problem.sinks
  const pairs = detectPairs(problem, logicalEdges, depths)
  const units = buildUnits(problem, nodes, pairs, depths)
  const unitById = new Map(units.map((unit) => [unit.id, unit]))
  const unitOfNode = mapUnitMembership(units)
  const groupPlans = buildGroupPlans(problem, units, options)
  const globalItems = buildGlobalItems(
    problem,
    units,
    groupPlans,
    logicalEdges,
    unitOfNode,
    options,
  )
  const placedItems = packGlobalItems(problem, globalItems, options)
  const zones = new Map<string, string[]>()
  const subgraphs = new Map<string, Subgraph>()

  placeNodes(nodes, placedItems, groupPlans, unitById, options)
  deriveSubgraphs(graph, problem, nodes, subgraphs, zones, options)

  const heartbeats = buildHeartbeats(logicalEdges, unitOfNode)
  const primaryEdges = buildPrimaryEdges(logicalEdges, depths, heartbeats)
  const bounds = computeBounds(nodes, subgraphs)

  return {
    nodes,
    subgraphs,
    bounds,
    zones,
    pairs: [...pairs.values()].map((pair) => pair.id).sort(),
    bands: bandRanges(placedItems),
    primaryEdges,
    sinks: [...sinks].sort(),
    heartbeats,
    depths,
    bandBlocks: bandBlocks(placedItems),
    scopes: [...subgraphs.keys()].filter((id) => !id.startsWith(ZONE_SUBGRAPH_PREFIX)).sort(),
    problem,
  }
}

function cloneNodesWithSizeFloors(
  graph: NetworkGraph,
  options: CompositeLayoutOptions,
): Map<string, Node> {
  const nodes = new Map<string, Node>()
  for (const node of graph.nodes) {
    const copy: Node = { ...node }
    const size = resolveNodeSize(copy)
    const width = Math.max(size.width, options.minNodeWidths?.get(node.id) ?? 0)
    const height = Math.max(size.height, options.minNodeHeights?.get(node.id) ?? 0)
    if (width > size.width || height > size.height) copy.size = { width, height }
    nodes.set(node.id, copy)
  }
  return nodes
}

function aggregateLinks(links: readonly Link[], nodes: ReadonlyMap<string, Node>): LogicalEdge[] {
  const byPair = new Map<string, LogicalEdge>()
  for (const link of links) {
    if (!nodes.has(link.from.node) || !nodes.has(link.to.node) || link.from.node === link.to.node) {
      continue
    }
    const a = link.from.node < link.to.node ? link.from.node : link.to.node
    const b = link.from.node < link.to.node ? link.to.node : link.from.node
    const key = pairKey(a, b)
    const existing = byPair.get(key)
    if (existing) {
      existing.bw += linkSpeedBps(link) ?? 0
      existing.count++
      existing.redundancy = existing.redundancy || link.redundancy !== undefined
      continue
    }
    byPair.set(key, {
      a,
      b,
      bw: linkSpeedBps(link) ?? 0,
      count: 1,
      redundancy: link.redundancy !== undefined,
    })
  }
  return [...byPair.values()].sort((a, b) => (pairKey(a.a, a.b) < pairKey(b.a, b.b) ? -1 : 1))
}

function detectPairs(
  problem: LayoutProblem,
  edges: readonly LogicalEdge[],
  depths: ReadonlyMap<string, number>,
): Map<string, Unit> {
  const nodeById = new Map(problem.nodes.map((node) => [node.id, node]))
  const paired = new Set<string>()
  const pairs = new Map<string, Unit>()
  for (const edge of edges) {
    if (!edge.redundancy || paired.has(edge.a) || paired.has(edge.b)) continue
    const a = nodeById.get(edge.a)
    const b = nodeById.get(edge.b)
    if (!a || !b || a.groupId !== b.groupId) continue
    const unit = pairUnit(a, b, depths)
    pairs.set(unit.id, unit)
    paired.add(edge.a)
    paired.add(edge.b)
  }
  return pairs
}

function pairUnit(
  a: LayoutNodeEntity,
  b: LayoutNodeEntity,
  depths: ReadonlyMap<string, number>,
): Unit {
  const members = [a.id, b.id].sort()
  return {
    id: members.join('+'),
    members,
    width: a.width + b.width + PAIR_GAP,
    height: Math.max(a.height, b.height),
    depth: Math.min(depths.get(a.id) ?? 0, depths.get(b.id) ?? 0),
    groupId: a.groupId,
  }
}

function buildUnits(
  problem: LayoutProblem,
  nodes: ReadonlyMap<string, Node>,
  pairs: ReadonlyMap<string, Unit>,
  depths: ReadonlyMap<string, number>,
): Unit[] {
  const byMember = new Map<string, Unit>()
  for (const pair of pairs.values()) {
    for (const member of pair.members) byMember.set(member, pair)
  }
  const units: Unit[] = []
  const emitted = new Set<string>()
  const nodeEntity = new Map(problem.nodes.map((node) => [node.id, node]))
  for (const id of [...nodes.keys()].sort()) {
    const pair = byMember.get(id)
    if (pair) {
      if (!emitted.has(pair.id)) {
        units.push(pair)
        emitted.add(pair.id)
      }
      continue
    }
    const entity = nodeEntity.get(id)
    if (!entity) continue
    units.push({
      id,
      members: [id],
      width: entity.width,
      height: entity.height,
      depth: depths.get(id) ?? 0,
      groupId: entity.groupId,
    })
  }
  return units.sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1))
}

function mapUnitMembership(units: readonly Unit[]): Map<string, string> {
  const unitOfNode = new Map<string, string>()
  for (const unit of units) {
    for (const member of unit.members) unitOfNode.set(member, unit.id)
  }
  return unitOfNode
}

function buildGroupPlans(
  problem: LayoutProblem,
  units: readonly Unit[],
  options: CompositeLayoutOptions,
): Map<string, GroupPlan> {
  const unitsByGroup = new Map<string, Unit[]>()
  for (const unit of units) {
    if (!unit.groupId) continue
    const list = unitsByGroup.get(unit.groupId) ?? []
    list.push(unit)
    unitsByGroup.set(unit.groupId, list)
  }

  const plans = new Map<string, GroupPlan>()
  for (const group of problem.groups) {
    const members = unitsByGroup.get(group.id) ?? []
    if (members.length === 0) continue
    const placed = placeLocalUnits(members, problem, options)
    const extents = extentsOfUnits(placed)
    const pad = options.zonePad ?? DEFAULT_GROUP_PAD
    const width = Math.max(1, extents.width + pad * 2)
    const height = Math.max(1, extents.height + pad * 2 + GROUP_LABEL_H)
    const shifted = placed.map((unit) => ({
      ...unit,
      x: unit.x - extents.x + pad,
      y: unit.y - extents.y + pad + GROUP_LABEL_H,
    }))
    plans.set(group.id, {
      group,
      units: shifted,
      width,
      height,
      rank: minDepth(members),
    })
  }
  return plans
}

function placeLocalUnits(
  units: readonly Unit[],
  problem: LayoutProblem,
  options: CompositeLayoutOptions,
): PlacedUnit[] {
  const rows = rowsByRank(units, (unit) => unit.depth)
  const placed: PlacedUnit[] = []
  const rowGap = options.rowGap ?? DEFAULT_NODE_GAP
  const cellGap = options.cellGapX ?? DEFAULT_NODE_GAP
  let y = 0
  for (const row of rows) {
    const projected = legalizeRow(
      row.map(
        (unit): RowItem => ({
          id: unit.id,
          width: unit.width,
          height: unit.height,
          desiredX: options.nudges?.get(unit.id) ?? 0,
        }),
      ),
      cellGap,
      Number.POSITIVE_INFINITY,
    )
    const itemById = new Map(projected.map((item) => [item.id, item]))
    const rowHeight = Math.max(...row.map((unit) => unit.height))
    for (const unit of row) {
      const item = itemById.get(unit.id)
      if (!item) continue
      placed.push({ ...unit, x: item.x, y: y + rowHeight / 2 })
    }
    y += rowHeight + rowGapForMode(problem, rowGap)
  }
  return placed
}

function rowGapForMode(problem: LayoutProblem, rowGap: number): number {
  return problem.mode === 'role-driven' ? Math.max(rowGap + 16, DEFAULT_ROLE_ROW_GAP) : rowGap
}

function buildGlobalItems(
  problem: LayoutProblem,
  units: readonly Unit[],
  groupPlans: ReadonlyMap<string, GroupPlan>,
  edges: readonly LogicalEdge[],
  unitOfNode: ReadonlyMap<string, string>,
  options: CompositeLayoutOptions,
): GlobalItem[] {
  const groupIds = new Set(groupPlans.keys())
  const items: GlobalItem[] = []
  const groupDesired = desiredXByAffinity(problem, edges, unitOfNode)

  for (const plan of groupPlans.values()) {
    items.push({
      id: plan.group.id,
      kind: 'group',
      width: plan.width,
      height: plan.height,
      rank: plan.rank,
      desiredX: groupDesired.get(plan.group.id) ?? 0,
      groupPlan: plan,
    })
  }

  for (const unit of units) {
    if (unit.groupId && groupIds.has(unit.groupId)) continue
    items.push({
      id: unit.id,
      kind: 'unit',
      width: unit.width,
      height: unit.height,
      rank: unit.depth,
      desiredX: options.nudges?.get(unit.id) ?? 0,
      unit,
    })
  }

  return items.sort((a, b) => a.rank - b.rank || a.desiredX - b.desiredX || (a.id < b.id ? -1 : 1))
}

function desiredXByAffinity(
  problem: LayoutProblem,
  edges: readonly LogicalEdge[],
  unitOfNode: ReadonlyMap<string, string>,
): Map<string, number> {
  const groupByNode = new Map(problem.nodes.map((node) => [node.id, node.groupId]))
  const score = new Map<string, number>()
  for (const edge of edges) {
    const ga = groupByNode.get(edge.a)
    const gb = groupByNode.get(edge.b)
    if (!ga || !gb || ga === gb) continue
    const ua = unitOfNode.get(edge.a) ?? edge.a
    const ub = unitOfNode.get(edge.b) ?? edge.b
    const sign = ua < ub ? -1 : 1
    score.set(ga, (score.get(ga) ?? 0) + sign * Math.max(1, edge.bw))
    score.set(gb, (score.get(gb) ?? 0) - sign * Math.max(1, edge.bw))
  }
  return score
}

function packGlobalItems(
  problem: LayoutProblem,
  items: readonly GlobalItem[],
  options: CompositeLayoutOptions,
): PlacedGlobalItem[] {
  const rows = rowsByRank(items, (item) => item.rank)
  const placed: PlacedGlobalItem[] = []
  const zoneGap = options.zoneGap ?? DEFAULT_GROUP_GAP
  const bandGap = options.bandGap ?? DEFAULT_BAND_GAP
  const maxBandW =
    problem.mode === 'role-driven' ? Number.POSITIVE_INFINITY : (options.maxBandW ?? 3200)
  let y = 0

  for (const [bandIndex, row] of rows.entries()) {
    y += options.bandExtra?.get(bandIndex) ?? 0
    const ordered = applyBandOrder(row, options.bandOrder?.get(bandIndex))
    const subRows = splitRows(ordered, zoneGap, maxBandW)
    for (const subRow of subRows) {
      const projected = legalizeRow(
        subRow.map((item) => ({
          id: item.id,
          width: item.width,
          height: item.height,
          desiredX: item.desiredX,
        })),
        zoneGap,
        Number.POSITIVE_INFINITY,
      )
      const projectedById = new Map(projected.map((item) => [item.id, item]))
      const rowHeight = Math.max(...subRow.map((item) => item.height))
      for (const item of subRow) {
        const projectedItem = projectedById.get(item.id)
        if (!projectedItem) continue
        placed.push({ ...item, x: projectedItem.x, y: y + rowHeight / 2 })
      }
      y += rowHeight + bandGap
    }
  }

  return centerRows(placed)
}

function applyBandOrder<T extends { id: string }>(
  row: readonly T[],
  order?: readonly string[],
): T[] {
  if (!order) return [...row]
  const rank = new Map(order.map((id, index) => [id, index]))
  return [...row].sort(
    (a, b) =>
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      (a.id < b.id ? -1 : 1),
  )
}

function splitRows<T extends { width: number }>(
  row: readonly T[],
  gap: number,
  maxWidth: number,
): T[][] {
  if (!Number.isFinite(maxWidth)) return [[...row]]
  const rows: T[][] = []
  let current: T[] = []
  let width = 0
  for (const item of row) {
    const nextWidth = current.length === 0 ? item.width : width + gap + item.width
    if (current.length > 0 && nextWidth > maxWidth) {
      rows.push(current)
      current = [item]
      width = item.width
      continue
    }
    current.push(item)
    width = nextWidth
  }
  if (current.length > 0) rows.push(current)
  return rows
}

function legalizeRow(
  items: readonly RowItem[],
  gap: number,
  maxWidth: number,
): Array<RowItem & { x: number }> {
  const sorted = [...items].sort(
    (a, b) => a.desiredX - b.desiredX || a.width - b.width || (a.id < b.id ? -1 : 1),
  )
  const placed: Array<RowItem & { x: number }> = []
  let cursor = 0
  for (const item of sorted) {
    const left = placed.length === 0 ? 0 : cursor + gap
    placed.push({ ...item, x: left + item.width / 2 })
    cursor = left + item.width
  }
  const totalWidth = cursor
  const shift = Number.isFinite(maxWidth) && totalWidth > maxWidth ? 0 : -totalWidth / 2
  return placed.map((item) => ({ ...item, x: item.x + shift }))
}

function centerRows(items: readonly PlacedGlobalItem[]): PlacedGlobalItem[] {
  const rows = rowsByRank(items, (item) => item.y)
  const centered: PlacedGlobalItem[] = []
  for (const row of rows) {
    const minX = Math.min(...row.map((item) => item.x - item.width / 2))
    const maxX = Math.max(...row.map((item) => item.x + item.width / 2))
    const shift = -(minX + maxX) / 2
    for (const item of row) centered.push({ ...item, x: item.x + shift })
  }
  return centered
}

function placeNodes(
  nodes: Map<string, Node>,
  items: readonly PlacedGlobalItem[],
  groupPlans: ReadonlyMap<string, GroupPlan>,
  unitById: ReadonlyMap<string, Unit>,
  options: CompositeLayoutOptions,
): void {
  for (const item of items) {
    if (item.kind === 'group') {
      const plan = item.groupPlan ?? groupPlans.get(item.id)
      if (!plan) continue
      const left = item.x - item.width / 2
      const top = item.y - item.height / 2
      for (const unit of plan.units) placeUnit(nodes, unit, left + unit.x, top + unit.y, options)
      continue
    }
    if (item.unit) placeUnit(nodes, item.unit, item.x, item.y, options)
  }

  for (const [id, node] of nodes) {
    if (node.position) continue
    const unit = unitById.get(id)
    node.position = unit ? { x: 0, y: unit.depth * DEFAULT_BAND_GAP } : { x: 0, y: 0 }
  }
}

function placeUnit(
  nodes: Map<string, Node>,
  unit: Pick<Unit, 'id' | 'members'>,
  centerX: number,
  centerY: number,
  options: CompositeLayoutOptions,
): void {
  const ordered = options.pairFlips?.has(unit.id) ? [...unit.members].reverse() : [...unit.members]
  if (ordered.length === 1) {
    const node = nodes.get(ordered[0] ?? '')
    if (node) node.position = { x: centerX, y: centerY }
    return
  }
  let total = (ordered.length - 1) * PAIR_GAP
  const sizes = new Map<string, { width: number; height: number }>()
  for (const id of ordered) {
    const node = nodes.get(id)
    if (!node) continue
    const size = resolveNodeSize(node)
    sizes.set(id, size)
    total += size.width
  }
  let x = centerX - total / 2
  for (const id of ordered) {
    const node = nodes.get(id)
    const size = sizes.get(id)
    if (!node || !size) continue
    node.position = { x: x + size.width / 2, y: centerY }
    x += size.width + PAIR_GAP
  }
}

function deriveSubgraphs(
  graph: NetworkGraph,
  problem: LayoutProblem,
  nodes: ReadonlyMap<string, Node>,
  subgraphs: Map<string, Subgraph>,
  zones: Map<string, string[]>,
  options: CompositeLayoutOptions,
): void {
  const original = new Map((graph.subgraphs ?? []).map((subgraph) => [subgraph.id, subgraph]))
  for (const group of problem.groups) {
    const bounds = boundsForMembers(group.memberIds, nodes, options.zonePad ?? DEFAULT_GROUP_PAD)
    if (!bounds) continue
    const source = original.get(group.layoutSubgraphId) ?? original.get(group.id)
    subgraphs.set(group.layoutSubgraphId, {
      ...(source ?? { id: group.layoutSubgraphId, label: group.label }),
      id: group.layoutSubgraphId,
      label: source?.label ?? group.label,
      bounds,
    })
    zones.set(group.id, group.memberIds)
    if (group.source === 'location') zones.set(group.label, group.memberIds)
  }
  for (const subgraph of graph.subgraphs ?? []) {
    if (subgraphs.has(subgraph.id)) continue
    const memberIds = [...nodes.values()]
      .filter((node) => node.parent === subgraph.id)
      .map((node) => node.id)
    const bounds = boundsForMembers(memberIds, nodes, options.zonePad ?? DEFAULT_GROUP_PAD)
    subgraphs.set(subgraph.id, bounds ? { ...subgraph, bounds } : { ...subgraph })
  }
}

function boundsForMembers(
  memberIds: readonly string[],
  nodes: ReadonlyMap<string, Node>,
  pad: number,
): Bounds | undefined {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const id of memberIds) {
    const node = nodes.get(id)
    if (!node?.position) continue
    const size = resolveNodeSize(node)
    minX = Math.min(minX, node.position.x - size.width / 2)
    minY = Math.min(minY, node.position.y - size.height / 2)
    maxX = Math.max(maxX, node.position.x + size.width / 2)
    maxY = Math.max(maxY, node.position.y + size.height / 2)
  }
  if (!Number.isFinite(minX)) return undefined
  return {
    x: minX - pad,
    y: minY - pad - GROUP_LABEL_H,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2 + GROUP_LABEL_H,
  }
}

function buildHeartbeats(
  edges: readonly LogicalEdge[],
  unitOfNode: ReadonlyMap<string, string>,
): Set<string> {
  const heartbeats = new Set<string>()
  for (const edge of edges) {
    if (edge.redundancy || unitOfNode.get(edge.a) === unitOfNode.get(edge.b)) {
      heartbeats.add(pairKey(edge.a, edge.b))
    }
  }
  return heartbeats
}

function buildPrimaryEdges(
  edges: readonly LogicalEdge[],
  depths: ReadonlyMap<string, number>,
  heartbeats: ReadonlySet<string>,
): Set<string> {
  const primary = new Set<string>()
  for (const edge of edges) {
    const key = pairKey(edge.a, edge.b)
    if (heartbeats.has(key)) continue
    if ((depths.get(edge.a) ?? 0) !== (depths.get(edge.b) ?? 0)) primary.add(key)
  }
  return primary
}

function computeBounds(
  nodes: ReadonlyMap<string, Node>,
  subgraphs: ReadonlyMap<string, Subgraph>,
): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const include = (bounds: Bounds): void => {
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  for (const node of nodes.values()) {
    if (!node.position) continue
    const size = resolveNodeSize(node)
    include({
      x: node.position.x - size.width / 2,
      y: node.position.y - size.height / 2,
      width: size.width,
      height: size.height,
    })
  }
  for (const subgraph of subgraphs.values()) {
    if (subgraph.bounds) include(subgraph.bounds)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  const pad = 48
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

function bandRanges(items: readonly PlacedGlobalItem[]): { top: number; bottom: number }[] {
  const rows = rowsByRank(items, (item) => item.y)
  return rows.map((row) => ({
    top: Math.min(...row.map((item) => item.y - item.height / 2)),
    bottom: Math.max(...row.map((item) => item.y + item.height / 2)),
  }))
}

function bandBlocks(items: readonly PlacedGlobalItem[]): string[][] {
  return rowsByRank(items, (item) => item.y).map((row) =>
    [...row].sort((a, b) => a.x - b.x || (a.id < b.id ? -1 : 1)).map((item) => item.id),
  )
}

function rowsByRank<T>(items: readonly T[], rankOf: (item: T) => number): T[][] {
  const byRank = new Map<number, T[]>()
  for (const item of items) {
    const rank = rankOf(item)
    const row = byRank.get(rank) ?? []
    row.push(item)
    byRank.set(rank, row)
  }
  return [...byRank.entries()].sort(([a], [b]) => a - b).map(([, row]) => [...row].sort(rowSort))
}

function rowSort<T>(a: T, b: T): number {
  const aid = typeof a === 'object' && a !== null && 'id' in a ? String(a.id) : ''
  const bid = typeof b === 'object' && b !== null && 'id' in b ? String(b.id) : ''
  return aid < bid ? -1 : aid > bid ? 1 : 0
}

function extentsOfUnits(units: readonly PlacedUnit[]): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const unit of units) {
    minX = Math.min(minX, unit.x - unit.width / 2)
    minY = Math.min(minY, unit.y - unit.height / 2)
    maxX = Math.max(maxX, unit.x + unit.width / 2)
    maxY = Math.max(maxY, unit.y + unit.height / 2)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function minDepth(units: readonly Unit[]): number {
  const depths = units.map((unit) => unit.depth)
  return depths.length > 0 ? Math.min(...depths) : 0
}
