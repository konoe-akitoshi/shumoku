// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Composite zone layout — the v3 placement pipeline (engine-v3-migration.md
 * B1+A7, #432; algorithm history in docs/engine-v3-design.md §23-40).
 *
 * Macro structure comes from a layered quotient over ZONES (location
 * metadata), not over nodes: each zone is laid out locally (sibling rows
 * with deterministic jitter), zones stack in bands by hierarchy depth,
 * and zones that share a primary feeder pack as a grid block under it.
 * Redundant pairs (link.redundancy, with a naming/structure fallback)
 * collapse to one unit during placement and expand side-by-side.
 *
 * Deterministic by construction: no RNG, no time — jitter comes from a
 * golden-ratio sequence keyed by stable node order.
 */

import type { Bounds, Direction, NetworkGraph, Node, Subgraph } from '../../models/types.js'
import { resolveNodeSize } from '../engine/index.js'
import { linkSpeedBps } from '../link-utils.js'
import { resolveTierFromSpec } from '../role-tiers.js'

export interface CompositeLayoutOptions {
  direction?: Direction
  /** Horizontal gap between zone boxes in a band. */
  zoneGap?: number
  /** Vertical gap between bands (also the wiring channel height). */
  bandGap?: number
  /** Gap between rows inside a zone. */
  rowGap?: number
  /** Horizontal gap between units in a row. */
  cellGapX?: number
  /** Zone box padding. */
  zonePad?: number
  /**
   * Pair unit ids (from `CompositeLayoutResult.pairs`) whose member
   * order should be mirrored. Search move vocabulary: the left/right
   * order inside a redundant pair is a real degree of freedom — the v3
   * rounds found exactly the pair a human flagged by eye (§35).
   */
  pairFlips?: ReadonlySet<string>
  /**
   * Extra vertical space inserted BEFORE band index i — congestion
   * feedback from routing (a channel overflowing with wire tracks
   * widens its road bed on the next pass).
   */
  bandExtra?: ReadonlyMap<number, number>
  /**
   * Explicit block order per band index (block keys from
   * `CompositeLayoutResult.bandBlocks`). Search move vocabulary: the
   * v3 simultaneous place-and-route arbitrated band orderings by
   * actually routing them (§33).
   */
  bandOrder?: ReadonlyMap<number, readonly string[]>
  /**
   * Per-unit horizontal nudges (unit id → dx), applied after port
   * refinement. Search move vocabulary (v3 hill-climb ±x, §32).
   */
  nudges?: ReadonlyMap<string, number>
  /** Bands wider than this wrap into sub-rows (v3 §24). */
  maxBandW?: number
}

export interface CompositeLayoutResult {
  /** Copies of the input nodes with `position` (center) set. */
  nodes: Map<string, Node>
  /** Original subgraphs (with bounds) plus synthetic zone boxes. */
  subgraphs: Map<string, Subgraph>
  bounds: Bounds
  /** zone name → member node ids (for invariant checks / diagnostics). */
  zones: Map<string, string[]>
  /** Redundant-pair unit ids (search flip candidates). */
  pairs: string[]
  /** Band y-ranges (top/bottom, final coordinates) for congestion measurement. */
  bands: { top: number; bottom: number }[]
  /** Node pair-keys (`a|b`, sorted) belonging to the primary dependency tree. */
  primaryEdges: Set<string>
  /** Shared-service sink nodes placed on the bottom rail. */
  sinks: string[]
  /** Heartbeat links between pair members (`a|b` keys) — couplings, not wires. */
  heartbeats: Set<string>
  /** Hierarchy depth per node (BFS from the apex). */
  depths: Map<string, number>
  /** Block keys per band, in placed order (band-order search handles). */
  bandBlocks: string[][]
}

/** Synthetic zone subgraphs get this id prefix. */
export const ZONE_SUBGRAPH_PREFIX = '__zone:'

const PHI = 1.618033988749895

/**
 * Heuristic gate for enabling the composite layout automatically: enough
 * nodes that flat-tree gets crowded, and zone metadata present on most of
 * them so the zone quotient has something to work with.
 */
export function shouldUseComposite(graph: NetworkGraph): boolean {
  if (graph.nodes.length < 10) return false
  let located = 0
  for (const node of graph.nodes) {
    if (typeof node.metadata?.['location'] === 'string' && node.metadata['location'] !== '')
      located++
  }
  return located / graph.nodes.length >= 0.5
}

// ============================================================================
// Internal structures
// ============================================================================

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
  zone: string
  depth: number
}

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

const labelOf = (node: Node): string => {
  const label = node.label
  if (Array.isArray(label)) return label[0] ?? node.id
  return label ?? node.id
}

/** "thunder8665s-1.noc" → "thunder8665s.noc" (trailing -N member index). */
const stemOf = (label: string): string => label.replace(/-\d+(?=\.|$)/, '')
/** Host part before the first dot. */
const hostOf = (label: string): string => {
  const dot = label.indexOf('.')
  return dot === -1 ? label : label.slice(0, dot)
}

// ============================================================================
// Pipeline
// ============================================================================

export function layoutComposite(
  graph: NetworkGraph,
  options: CompositeLayoutOptions = {},
): CompositeLayoutResult {
  const zoneGap = options.zoneGap ?? 90
  const bandGap = options.bandGap ?? 150
  const rowGap = options.rowGap ?? 56
  const cellGapX = options.cellGapX ?? 32
  const zonePad = options.zonePad ?? 26

  // -- nodes (copies; we set position) + deterministic jitter source --------
  const nodes = new Map<string, Node>()
  for (const node of graph.nodes) nodes.set(node.id, { ...node })
  const ids = [...nodes.keys()].sort()
  const idIndex = new Map<string, number>()
  for (const [i, id] of ids.entries()) idIndex.set(id, i)
  const jitter = (id: string, salt: number): number => {
    const seq = (((idIndex.get(id) ?? 0) + 1) * (1 / PHI) + salt * 0.3719) % 1
    return seq - 0.5
  }

  // -- logical edges (parallel links aggregated) -----------------------------
  const logical = new Map<string, LogicalEdge>()
  for (const link of graph.links) {
    const a = link.from.node
    const b = link.to.node
    if (a === b || !nodes.has(a) || !nodes.has(b)) continue
    const key = pairKey(a, b)
    const bw = linkSpeedBps(link) ?? 0
    const existing = logical.get(key)
    if (existing) {
      existing.bw += bw
      existing.count++
      existing.redundancy = existing.redundancy || link.redundancy !== undefined
    } else {
      logical.set(key, {
        a: a < b ? a : b,
        b: a < b ? b : a,
        bw,
        count: 1,
        redundancy: link.redundancy !== undefined,
      })
    }
  }
  const edges = [...logical.values()].sort((x, y) =>
    pairKey(x.a, x.b) < pairKey(y.a, y.b) ? -1 : 1,
  )
  const neighbors = new Map<string, Map<string, LogicalEdge>>()
  for (const id of ids) neighbors.set(id, new Map())
  for (const edge of edges) {
    neighbors.get(edge.a)?.set(edge.b, edge)
    neighbors.get(edge.b)?.set(edge.a, edge)
  }

  // -- zones ------------------------------------------------------------------
  const zoneOf = (id: string): string => {
    const loc = nodes.get(id)?.metadata?.['location']
    return typeof loc === 'string' && loc !== '' ? loc : `__solo:${id}`
  }

  // -- bandwidth classes + shared-service sinks --------------------------------
  // A sink (default-route firewall, shared service) touches everything over
  // thin links: high degree, no trunk-class bandwidth. It must not anchor
  // the hierarchy (v2 §7.5 sink guard), must not shortcut BFS depths, and
  // lives on its own rail below the zones instead of bloating one zone box.
  let globalMaxBw = 0
  const maxBwOf = new Map<string, number>()
  for (const id of ids) {
    let best = 0
    for (const edge of neighbors.get(id)?.values() ?? []) best = Math.max(best, edge.bw)
    maxBwOf.set(id, best)
    globalMaxBw = Math.max(globalMaxBw, best)
  }
  const trunkClass = (id: string): boolean =>
    globalMaxBw <= 0 || (maxBwOf.get(id) ?? 0) >= globalMaxBw * 0.5
  const sinkSet = new Set<string>()
  for (const id of ids) {
    if ((neighbors.get(id)?.size ?? 0) >= 8 && !trunkClass(id)) sinkSet.add(id)
  }

  // -- hierarchy depth: apex from role tiers, then undirected BFS -------------
  const depth = computeDepths(ids, nodes, neighbors, trunkClass, sinkSet)

  // -- redundant pairs ---------------------------------------------------------
  const pairedWith = detectPairs(ids, nodes, edges, neighbors, zoneOf, depth)

  // -- units -------------------------------------------------------------------
  const PAIR_GAP = 16
  const units: Unit[] = []
  const unitOf = new Map<string, string>()
  for (const id of ids) {
    if (sinkSet.has(id)) continue // sinks live on their own rail, not in zones
    const partner = pairedWith.get(id)
    if (partner !== undefined && partner < id) continue
    const members = partner !== undefined ? [id, partner].sort() : [id]
    const unitId = members.join('+')
    let width = (members.length - 1) * PAIR_GAP
    let height = 0
    let minDepth = Number.POSITIVE_INFINITY
    for (const member of members) {
      const node = nodes.get(member)
      if (!node) continue
      const size = resolveNodeSize(node)
      width += size.width
      height = Math.max(height, size.height)
      minDepth = Math.min(minDepth, depth.get(member) ?? 0)
    }
    units.push({ id: unitId, members, width, height, zone: zoneOf(id), depth: minDepth })
    for (const member of members) unitOf.set(member, unitId)
  }
  const unitById = new Map<string, Unit>()
  for (const unit of units) unitById.set(unit.id, unit)

  // unit-level adjacency (skip intra-unit edges) and primary parents
  const unitEdges = new Map<string, { a: string; b: string; bw: number }>()
  for (const edge of edges) {
    const ua = unitOf.get(edge.a)
    const ub = unitOf.get(edge.b)
    if (ua === undefined || ub === undefined || ua === ub) continue
    const key = pairKey(ua, ub)
    const existing = unitEdges.get(key)
    if (existing) existing.bw += edge.bw
    else unitEdges.set(key, { a: ua < ub ? ua : ub, b: ua < ub ? ub : ua, bw: edge.bw })
  }
  const primaryParent = new Map<string, string>()
  for (const unit of units) {
    let best: { parent: string; bw: number } | undefined
    for (const edge of unitEdges.values()) {
      const other = edge.a === unit.id ? edge.b : edge.b === unit.id ? edge.a : undefined
      if (other === undefined) continue
      const otherUnit = unitById.get(other)
      if (!otherUnit || otherUnit.depth >= unit.depth) continue
      if (!best || edge.bw > best.bw || (edge.bw === best.bw && other < best.parent)) {
        best = { parent: other, bw: edge.bw }
      }
    }
    if (best) primaryParent.set(unit.id, best.parent)
  }

  // -- per-zone local layout (rows by relative depth) --------------------------
  const zoneIds = [...new Set(units.map((u) => u.zone))].sort()
  const zoneUnits = new Map<string, Unit[]>()
  for (const zone of zoneIds) zoneUnits.set(zone, [])
  for (const unit of units) zoneUnits.get(unit.zone)?.push(unit)
  for (const list of zoneUnits.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1))

  const localX = new Map<string, number>()
  const localY = new Map<string, number>()
  const zoneBox = new Map<string, { w: number; h: number }>()
  const zoneRows = new Map<string, Unit[][]>()
  for (const zone of zoneIds) {
    const members = zoneUnits.get(zone) ?? []
    const minDepth = Math.min(...members.map((u) => u.depth))
    const rowMap = new Map<number, Unit[]>()
    for (const unit of members) {
      const row = unit.depth - minDepth
      const list = rowMap.get(row)
      if (list) list.push(unit)
      else rowMap.set(row, [unit])
    }
    const rowKeys = [...rowMap.keys()].sort((a, b) => a - b)
    const rows: Unit[][] = []
    let maxRowWidth = 0
    let y = zonePad
    const placeRow = (row: Unit[], rowY: number, rowHeight: number): void => {
      let x = zonePad
      for (const unit of row) {
        localX.set(unit.id, x + unit.width / 2 + jitter(unit.members[0] ?? unit.id, 3) * 8)
        localY.set(unit.id, rowY + rowHeight / 2 + jitter(unit.members[0] ?? unit.id, 7) * 6)
        x += unit.width + cellGapX
      }
    }
    const rowYs: number[] = []
    const rowHeights: number[] = []
    for (const key of rowKeys) {
      const row = rowMap.get(key) ?? []
      rows.push(row)
      const rowWidth = row.reduce((sum, u) => sum + u.width, 0) + cellGapX * (row.length - 1)
      maxRowWidth = Math.max(maxRowWidth, rowWidth)
      const rowHeight = Math.max(...row.map((u) => u.height))
      rowYs.push(y)
      rowHeights.push(rowHeight)
      placeRow(row, y, rowHeight)
      y += rowHeight + rowGap
    }
    // intra-zone barycenter ordering (v3 §24): two sweeps pulling each
    // unit next to its in-zone neighbors before global refinement
    const intraNeighborX = (unit: Unit): number => {
      let sum = 0
      let count = 0
      for (const member of unit.members) {
        for (const [other] of neighbors.get(member) ?? []) {
          const otherUnit = unitById.get(unitOf.get(other) ?? '')
          if (!otherUnit || otherUnit.zone !== zone || otherUnit.id === unit.id) continue
          sum += localX.get(otherUnit.id) ?? 0
          count++
        }
      }
      return count > 0 ? sum / count : (localX.get(unit.id) ?? 0)
    }
    for (let sweep = 0; sweep < 2; sweep++) {
      for (const [i, row] of rows.entries()) {
        if (row.length < 2) continue
        row.sort((a, b) => intraNeighborX(a) - intraNeighborX(b) || (a.id < b.id ? -1 : 1))
        placeRow(row, rowYs[i] ?? zonePad, rowHeights[i] ?? 0)
      }
    }
    zoneRows.set(zone, rows)
    zoneBox.set(zone, { w: maxRowWidth + zonePad * 2, h: y - rowGap + zonePad })
  }

  // -- quotient: bands by zone rank, child-block packing under feeders ---------
  const zoneRank = new Map<string, number>()
  for (const zone of zoneIds) {
    const members = zoneUnits.get(zone) ?? []
    zoneRank.set(zone, Math.min(...members.map((u) => u.depth)))
  }
  const zoneAdj = new Map<string, Map<string, number>>()
  for (const zone of zoneIds) zoneAdj.set(zone, new Map())
  for (const edge of unitEdges.values()) {
    const za = unitById.get(edge.a)?.zone
    const zb = unitById.get(edge.b)?.zone
    if (za === undefined || zb === undefined || za === zb) continue
    const weight =
      primaryParent.get(edge.a) === edge.b || primaryParent.get(edge.b) === edge.a ? 3 : 1
    zoneAdj.get(za)?.set(zb, (zoneAdj.get(za)?.get(zb) ?? 0) + weight)
    zoneAdj.get(zb)?.set(za, (zoneAdj.get(zb)?.get(za) ?? 0) + weight)
  }
  const zoneParent = new Map<string, string | undefined>()
  for (const zone of zoneIds) {
    const counts = new Map<string, number>()
    for (const unit of zoneUnits.get(zone) ?? []) {
      const parent = primaryParent.get(unit.id)
      if (parent === undefined) continue
      const parentZone = unitById.get(parent)?.zone
      if (parentZone === undefined || parentZone === zone) continue
      counts.set(parentZone, (counts.get(parentZone) ?? 0) + 1)
    }
    let best: string | undefined
    let bestCount = 0
    for (const [zone2, count] of [...counts].sort()) {
      if (count > bestCount) {
        best = zone2
        bestCount = count
      }
    }
    zoneParent.set(zone, best)
  }

  const zoneX = new Map<string, number>()
  const zoneY = new Map<string, number>()
  const { bandRanges, bandBlocks } = placeZoneBands(
    zoneIds,
    zoneRank,
    zoneAdj,
    zoneParent,
    zoneBox,
    zoneX,
    zoneY,
    zoneGap,
    bandGap,
    options.maxBandW ?? 1700,
    options.bandExtra,
    options.bandOrder,
  )

  // -- port refine: pull units toward their cross-zone neighbors ---------------
  const minSep = 24
  for (let pass = 0; pass < 2; pass++) {
    for (const zone of zoneIds) {
      const rows = zoneRows.get(zone) ?? []
      const box = zoneBox.get(zone)
      const originX = zoneX.get(zone)
      if (!box || originX === undefined) continue
      for (const row of rows) {
        for (const unit of row) {
          let sum = 0
          let weight = 0
          for (const edge of unitEdges.values()) {
            const other = edge.a === unit.id ? edge.b : edge.b === unit.id ? edge.a : undefined
            if (other === undefined) continue
            const otherUnit = unitById.get(other)
            if (!otherUnit || otherUnit.zone === zone) continue
            const otherX = (zoneX.get(otherUnit.zone) ?? 0) + (localX.get(other) ?? 0)
            const w =
              primaryParent.get(unit.id) === other || primaryParent.get(other) === unit.id ? 4 : 1
            sum += otherX * w
            weight += w
          }
          if (weight === 0) continue
          const target = sum / weight - originX
          const lo = unit.width / 2 + 8
          const hi = box.w - unit.width / 2 - 8
          const current = localX.get(unit.id) ?? lo
          localX.set(unit.id, Math.max(lo, Math.min(hi, current + (target - current) * 0.6)))
        }
        resolveRow(row, localX, box.w, minSep)
      }
    }
  }

  // -- search nudges (hill-climb ±x moves, v3 §32) -------------------------------
  if (options.nudges) {
    for (const [unitId, dx] of options.nudges) {
      const unit = unitById.get(unitId)
      const box = unit ? zoneBox.get(unit.zone) : undefined
      if (!unit || !box) continue
      const lo = unit.width / 2 + 8
      const hi = box.w - unit.width / 2 - 8
      const current = localX.get(unitId) ?? lo
      localX.set(unitId, Math.max(lo, Math.min(hi, current + dx)))
    }
    for (const zone of zoneIds) {
      const box = zoneBox.get(zone)
      if (!box) continue
      for (const row of zoneRows.get(zone) ?? []) resolveRow(row, localX, box.w, minSep)
    }
  }

  // -- snap under primary parent, then re-separate ------------------------------
  const sortedUnits = [...units].sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1))
  for (const unit of sortedUnits) {
    const parent = primaryParent.get(unit.id)
    if (parent === undefined) continue
    const parentUnit = unitById.get(parent)
    const box = zoneBox.get(unit.zone)
    if (!parentUnit || !box) continue
    const parentGlobal = (zoneX.get(parentUnit.zone) ?? 0) + (localX.get(parent) ?? 0)
    const selfGlobal = (zoneX.get(unit.zone) ?? 0) + (localX.get(unit.id) ?? 0)
    const diff = parentGlobal - selfGlobal
    if (Math.abs(diff) <= 0.5 || Math.abs(diff) >= 40) continue
    const lo = unit.width / 2 + 8
    const hi = box.w - unit.width / 2 - 8
    const current = localX.get(unit.id) ?? lo
    localX.set(unit.id, Math.max(lo, Math.min(hi, current + diff)))
  }
  for (const zone of zoneIds) {
    const box = zoneBox.get(zone)
    if (!box) continue
    for (const row of zoneRows.get(zone) ?? []) resolveRow(row, localX, box.w, minSep)
  }

  // -- compose to absolute centers ----------------------------------------------
  for (const unit of units) {
    const gx = (zoneX.get(unit.zone) ?? 0) + (localX.get(unit.id) ?? 0)
    const gy = (zoneY.get(unit.zone) ?? 0) + (localY.get(unit.id) ?? 0)
    if (unit.members.length === 1) {
      const member = unit.members[0]
      const node = member === undefined ? undefined : nodes.get(member)
      if (node) node.position = { x: gx, y: gy }
      continue
    }
    const order = options.pairFlips?.has(unit.id) ? [...unit.members].reverse() : unit.members
    let x = gx - unit.width / 2
    for (const member of order) {
      const node = nodes.get(member)
      if (!node) continue
      const size = resolveNodeSize(node)
      node.position = { x: x + size.width / 2, y: gy }
      x += size.width + PAIR_GAP
    }
  }

  // -- normalize to positive coordinates ------------------------------------------
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const zone of zoneIds) {
    const box = zoneBox.get(zone)
    const x = zoneX.get(zone)
    const y = zoneY.get(zone)
    if (!box || x === undefined || y === undefined) continue
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + box.w)
    maxY = Math.max(maxY, y + box.h)
  }
  const PAD = 60
  const shiftX = PAD - minX
  const shiftY = PAD - minY
  for (const node of nodes.values()) {
    if (!node.position) continue
    node.position = { x: node.position.x + shiftX, y: node.position.y + shiftY }
  }

  // -- sink rail: shared-service sinks sit on their own row below the zones
  //    (v3 collector rail) instead of dragging 15+ links into one zone box --
  let railBottom = maxY - minY + PAD
  if (sinkSet.size > 0) {
    const railY = maxY - minY + PAD + 110
    const sinkIds = [...sinkSet].sort()
    let railWidth = 0
    let railHeight = 0
    for (const id of sinkIds) {
      const node = nodes.get(id)
      if (!node) continue
      const size = resolveNodeSize(node)
      railWidth += size.width + 40
      railHeight = Math.max(railHeight, size.height)
    }
    railWidth -= 40
    const contentWidth = maxX - minX
    let x = PAD + Math.max(0, (contentWidth - railWidth) / 2)
    for (const id of sinkIds) {
      const node = nodes.get(id)
      if (!node) continue
      const size = resolveNodeSize(node)
      node.position = { x: x + size.width / 2, y: railY + railHeight / 2 }
      x += size.width + 40
    }
    railBottom = railY + railHeight
  }

  // -- subgraphs: synthetic zone boxes + original subgraph bounds ------------------
  const subgraphs = new Map<string, Subgraph>()
  const zoneMembers = new Map<string, string[]>()
  for (const zone of zoneIds) {
    const members: string[] = []
    for (const unit of zoneUnits.get(zone) ?? []) members.push(...unit.members)
    zoneMembers.set(zone, members)
    if (zone.startsWith('__solo:') || members.length < 2) continue
    const box = zoneBox.get(zone)
    const x = zoneX.get(zone)
    const y = zoneY.get(zone)
    if (!box || x === undefined || y === undefined) continue
    subgraphs.set(`${ZONE_SUBGRAPH_PREFIX}${zone}`, {
      id: `${ZONE_SUBGRAPH_PREFIX}${zone}`,
      label: zone,
      bounds: { x: x + shiftX, y: y + shiftY, width: box.w, height: box.h },
      style: { strokeDasharray: '5 4' },
    })
  }
  for (const original of graph.subgraphs ?? []) {
    // Skip degenerate groupings that contain most of the graph (e.g. a
    // monitoring host-group every device belongs to) — a box around
    // everything carries no information and visually swallows the zones.
    let memberCount = 0
    for (const node of nodes.values()) if (node.parent === original.id) memberCount++
    if (memberCount >= nodes.size * 0.6) continue
    subgraphs.set(original.id, { ...original, bounds: boundsOfMembers(original, nodes) })
  }

  // primary dependency edges at node level (for emphasis styling / search)
  const primaryEdges = new Set<string>()
  for (const unit of units) {
    const parent = primaryParent.get(unit.id)
    if (parent === undefined) continue
    const parentUnit = unitById.get(parent)
    if (!parentUnit) continue
    for (const m of unit.members) {
      for (const p of parentUnit.members) {
        if (neighbors.get(m)?.has(p)) primaryEdges.add(pairKey(m, p))
      }
    }
  }

  return {
    nodes,
    subgraphs,
    bounds: {
      x: 0,
      y: 0,
      width: maxX - minX + PAD * 2,
      height: railBottom + PAD,
    },
    zones: zoneMembers,
    pairs: units.filter((u) => u.members.length === 2).map((u) => u.id),
    bands: bandRanges.map((b) => ({ top: b.top + shiftY, bottom: b.bottom + shiftY })),
    primaryEdges,
    sinks: [...sinkSet].sort(),
    heartbeats: collectHeartbeats(units, neighbors),
    depths: depth,
    bandBlocks,
  }
}

/** Direct links between the two members of a pair are couplings, not wires. */
function collectHeartbeats(
  units: readonly Unit[],
  neighbors: Map<string, Map<string, LogicalEdge>>,
): Set<string> {
  const heartbeats = new Set<string>()
  for (const unit of units) {
    if (unit.members.length !== 2) continue
    const [a, b] = unit.members
    if (a !== undefined && b !== undefined && neighbors.get(a)?.has(b)) {
      heartbeats.add(pairKey(a, b))
    }
  }
  return heartbeats
}

// ============================================================================
// Helpers
// ============================================================================

function computeDepths(
  ids: readonly string[],
  nodes: Map<string, Node>,
  neighbors: Map<string, Map<string, LogicalEdge>>,
  trunkClass: (id: string) => boolean,
  sinkSet: ReadonlySet<string>,
): Map<string, number> {
  // Apex candidates must carry trunk-class bandwidth (v3 sink guard:
  // a shared last-resort firewall has a low device tier and 17 thin
  // links — without the gate it out-ranks the border routers).
  let bestTier = Number.POSITIVE_INFINITY
  const tierOf = new Map<string, number>()
  for (const id of ids) {
    if ((neighbors.get(id)?.size ?? 0) === 0) continue
    if (!trunkClass(id)) continue
    const hint = resolveTierFromSpec(nodes.get(id)?.spec)
    if (!hint) continue
    tierOf.set(id, hint.tier)
    bestTier = Math.min(bestTier, hint.tier)
  }
  let roots = ids.filter((id) => tierOf.get(id) === bestTier)
  // v3 apex rule (§16, generalized): within the top device tier, the
  // LOCATION hierarchy picks the border group. Split each location into
  // (prefix, trailing number), take the DOMINANT prefix family among the
  // candidates (most top-tier devices live in the network-core rooms),
  // and keep only the lowest two numbers in that family — on the
  // reference network that is exactly the three border routers.
  if (roots.length > 2) {
    const parseLoc = (id: string): { prefix: string; num: number } | undefined => {
      const loc = nodes.get(id)?.metadata?.['location']
      if (typeof loc !== 'string' || loc === '') return undefined
      const match = /^(.*?)(\d+)\s*$/.exec(loc)
      if (!match) return { prefix: loc, num: 0 }
      return { prefix: match[1] ?? loc, num: Number(match[2]) }
    }
    const familyCount = new Map<string, number>()
    for (const id of roots) {
      const parsed = parseLoc(id)
      if (!parsed) continue
      familyCount.set(parsed.prefix, (familyCount.get(parsed.prefix) ?? 0) + 1)
    }
    let family: string | undefined
    let familySize = 0
    for (const [prefix, count] of [...familyCount].sort()) {
      if (count > familySize) {
        family = prefix
        familySize = count
      }
    }
    if (family !== undefined && familySize >= 2) {
      const nums = [
        ...new Set(
          roots
            .map(parseLoc)
            .filter((p): p is { prefix: string; num: number } => p?.prefix === family)
            .map((p) => p.num),
        ),
      ].sort((a, b) => a - b)
      const keep = new Set(nums.slice(0, 2))
      const familyRoots = roots.filter((id) => {
        const parsed = parseLoc(id)
        return parsed?.prefix === family && keep.has(parsed.num)
      })
      if (familyRoots.length > 0) roots = familyRoots
    }
  }
  if (roots.length === 0) {
    let maxDegree = -1
    let best: string | undefined
    for (const id of ids) {
      const degree = neighbors.get(id)?.size ?? 0
      if (degree > maxDegree) {
        maxDegree = degree
        best = id
      }
    }
    roots = best === undefined ? [] : [best]
  }
  const depth = new Map<string, number>()
  const queue: string[] = []
  for (const root of roots) {
    depth.set(root, 0)
    queue.push(root)
  }
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    // never traverse THROUGH a sink — it touches everything and would
    // shortcut every depth to root+2
    if (sinkSet.has(current)) continue
    const currentDepth = depth.get(current) ?? 0
    const adj = neighbors.get(current)
    if (!adj) continue
    for (const next of [...adj.keys()].sort()) {
      if (depth.has(next)) continue
      depth.set(next, currentDepth + 1)
      queue.push(next)
    }
  }
  for (const id of ids) if (!depth.has(id)) depth.set(id, 0)
  return depth
}

function detectPairs(
  ids: readonly string[],
  nodes: Map<string, Node>,
  edges: readonly LogicalEdge[],
  neighbors: Map<string, Map<string, LogicalEdge>>,
  zoneOf: (id: string) => string,
  depth: Map<string, number>,
): Map<string, string> {
  const paired = new Map<string, string>()
  const tryPair = (a: string, b: string): void => {
    if (paired.has(a) || paired.has(b)) return
    paired.set(a, b)
    paired.set(b, a)
  }
  // 1) explicit redundancy field — the typed source of truth
  for (const edge of edges) {
    if (!edge.redundancy) continue
    if (zoneOf(edge.a) !== zoneOf(edge.b)) continue
    tryPair(edge.a, edge.b)
  }
  // 2) naming + structure fallback: same zone, twin-style names (stem or
  //    host part match), similar depth, and structural evidence — a direct
  //    interconnect OR a shared uplink. Jaccard/direct-only is wrong both
  //    ways (v3 §24/§30): true HA pairs often uplink to DIFFERENT routers
  //    on purpose, and some pairs have no direct heartbeat link at all.
  const candidates: { a: string; b: string; direct: boolean }[] = []
  for (const a of ids) {
    const nodeA = nodes.get(a)
    if (!nodeA) continue
    const labelA = labelOf(nodeA)
    for (const b of ids) {
      if (b <= a) continue
      if (zoneOf(a) !== zoneOf(b)) continue
      if (Math.abs((depth.get(a) ?? 0) - (depth.get(b) ?? 0)) > 1) continue
      const nodeB = nodes.get(b)
      if (!nodeB) continue
      const labelB = labelOf(nodeB)
      if (stemOf(labelA) !== stemOf(labelB) && hostOf(labelA) !== hostOf(labelB)) continue
      const direct = neighbors.get(a)?.has(b) ?? false
      let shared = false
      if (!direct) {
        for (const n of neighbors.get(a)?.keys() ?? []) {
          if (n !== b && neighbors.get(b)?.has(n)) {
            shared = true
            break
          }
        }
      }
      if (direct || shared) candidates.push({ a, b, direct })
    }
  }
  candidates.sort(
    (x, y) =>
      Number(y.direct) - Number(x.direct) || (pairKey(x.a, x.b) < pairKey(y.a, y.b) ? -1 : 1),
  )
  for (const candidate of candidates) tryPair(candidate.a, candidate.b)
  return paired
}

function placeZoneBands(
  zoneIds: readonly string[],
  zoneRank: Map<string, number>,
  zoneAdj: Map<string, Map<string, number>>,
  zoneParent: Map<string, string | undefined>,
  zoneBox: Map<string, { w: number; h: number }>,
  zoneX: Map<string, number>,
  zoneY: Map<string, number>,
  zoneGap: number,
  bandGap: number,
  maxBandW: number,
  bandExtra?: ReadonlyMap<number, number>,
  bandOrder?: ReadonlyMap<number, readonly string[]>,
): { bandRanges: { top: number; bottom: number }[]; bandBlocks: string[][] } {
  const ranks = [...new Set(zoneIds.map((z) => zoneRank.get(z) ?? 0))].sort((a, b) => a - b)
  const centerOf = new Map<string, number>()
  for (const zone of zoneIds) centerOf.set(zone, 0)
  const bandRanges: { top: number; bottom: number }[] = []
  const bandBlocks: string[][] = []

  let y = 0
  const placed = new Set<string>()
  for (const [bandIndex, rank] of ranks.entries()) {
    y += bandExtra?.get(bandIndex) ?? 0
    const bandZones = zoneIds.filter((z) => (zoneRank.get(z) ?? 0) === rank)
    // group zones under their (already placed) feeder zone
    const groups = new Map<string, string[]>()
    for (const zone of bandZones) {
      const parent = zoneParent.get(zone)
      const key = parent !== undefined && placed.has(parent) ? parent : `~${zone}`
      const list = groups.get(key)
      if (list) list.push(zone)
      else groups.set(key, [zone])
    }
    interface Block {
      key: string
      zones: string[]
      w: number
      h: number
      offsets: Map<string, { x: number; y: number }>
      desired: number
    }
    const blocks: Block[] = []
    for (const [key, members] of [...groups].sort()) {
      if (!key.startsWith('~') && members.length >= 2) {
        members.sort((a, b) => (centerOf.get(a) ?? 0) - (centerOf.get(b) ?? 0) || (a < b ? -1 : 1))
        const cols = Math.min(4, Math.ceil(Math.sqrt(members.length * 1.7)))
        const gapInner = Math.round(zoneGap * 0.55)
        const offsets = new Map<string, { x: number; y: number }>()
        let blockW = 0
        let blockY = 0
        for (let start = 0; start < members.length; start += cols) {
          const row = members.slice(start, start + cols)
          let x = 0
          let rowH = 0
          for (const zone of row) {
            const box = zoneBox.get(zone)
            if (!box) continue
            offsets.set(zone, { x, y: blockY })
            x += box.w + gapInner
            rowH = Math.max(rowH, box.h)
          }
          blockW = Math.max(blockW, x - gapInner)
          blockY += rowH + gapInner
        }
        blocks.push({
          key,
          zones: members,
          w: blockW,
          h: blockY - gapInner,
          offsets,
          desired: centerOf.get(key) ?? 0,
        })
      } else {
        for (const zone of members) {
          const box = zoneBox.get(zone)
          if (!box) continue
          blocks.push({
            key: `~${zone}`,
            zones: [zone],
            w: box.w,
            h: box.h,
            offsets: new Map([[zone, { x: 0, y: 0 }]]),
            desired: barycenter(zone, zoneAdj, centerOf),
          })
        }
      }
    }
    blocks.sort((a, b) => a.desired - b.desired || (a.key < b.key ? -1 : 1))
    // explicit search-supplied order overrides the barycenter sort (§33)
    const requested = bandOrder?.get(bandIndex)
    if (requested) {
      const rank = new Map<string, number>()
      for (const [i, key] of requested.entries()) rank.set(key, i)
      blocks.sort(
        (a, b) =>
          (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER) || (a.key < b.key ? -1 : 1),
      )
    }
    bandBlocks.push(blocks.map((b) => b.key))
    // wrap the band into sub-rows when it exceeds maxBandW (v3 §24)
    const subRows: Block[][] = [[]]
    let rowWidth = 0
    for (const block of blocks) {
      const need = block.w + zoneGap
      const current = subRows[subRows.length - 1]
      if (current && current.length > 0 && rowWidth + need > maxBandW) {
        subRows.push([block])
        rowWidth = need
      } else {
        current?.push(block)
        rowWidth += need
      }
    }
    const bandTop = y
    for (const rowBlocks of subRows) {
      if (rowBlocks.length === 0) continue
      // 1D placement at desired x, resolving overlaps left→right, then center
      const xs: number[] = []
      let cursor = Number.NEGATIVE_INFINITY
      for (const block of rowBlocks) {
        let x = block.desired - block.w / 2
        if (x < cursor) x = cursor
        xs.push(x)
        cursor = x + block.w + zoneGap
      }
      // Preserve the desired-x frame: shift the row only by the average
      // deviation the overlap resolution introduced. Re-centering every
      // row at x=0 (the old behavior) destroyed cross-band alignment —
      // a child band could never sit under its feeder when band content
      // was asymmetric (test6: pods drifted 300-900px off their hub).
      let deviation = 0
      for (const [i, block] of rowBlocks.entries()) {
        deviation += block.desired - ((xs[i] ?? 0) + block.w / 2)
      }
      const shift = rowBlocks.length > 0 ? deviation / rowBlocks.length : 0
      let rowHeight = 0
      for (const [i, block] of rowBlocks.entries()) {
        const blockX = (xs[i] ?? 0) + shift
        for (const zone of block.zones) {
          const offset = block.offsets.get(zone)
          const box = zoneBox.get(zone)
          if (!offset || !box) continue
          zoneX.set(zone, blockX + offset.x)
          zoneY.set(zone, y + offset.y)
          centerOf.set(zone, blockX + offset.x + box.w / 2)
          placed.add(zone)
        }
        rowHeight = Math.max(rowHeight, block.h)
      }
      y += rowHeight + Math.round(bandGap * 0.55)
    }
    y -= Math.round(bandGap * 0.55)
    bandRanges.push({ top: bandTop, bottom: y })
    y += bandGap
  }
  return { bandRanges, bandBlocks }
}

function barycenter(
  zone: string,
  zoneAdj: Map<string, Map<string, number>>,
  centerOf: Map<string, number>,
): number {
  let sum = 0
  let weight = 0
  for (const [other, w] of zoneAdj.get(zone) ?? new Map<string, number>()) {
    sum += (centerOf.get(other) ?? 0) * w
    weight += w
  }
  return weight > 0 ? sum / weight : 0
}

/** Sort a row by x and enforce minimum separation inside the zone box. */
function resolveRow(
  row: Unit[],
  localX: Map<string, number>,
  boxWidth: number,
  minSep: number,
): void {
  const sorted = [...row].sort(
    (a, b) => (localX.get(a.id) ?? 0) - (localX.get(b.id) ?? 0) || (a.id < b.id ? -1 : 1),
  )
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (!prev || !curr) continue
    const minX = (localX.get(prev.id) ?? 0) + prev.width / 2 + minSep + curr.width / 2
    if ((localX.get(curr.id) ?? 0) < minX) localX.set(curr.id, minX)
  }
  const last = sorted[sorted.length - 1]
  if (!last) return
  const over = (localX.get(last.id) ?? 0) + last.width / 2 + 8 - boxWidth
  if (over <= 0) return
  const first = sorted[0]
  const slack = first ? Math.max(0, (localX.get(first.id) ?? 0) - (first.width / 2 + 8)) : 0
  const shift = Math.min(over, slack)
  for (const unit of sorted) localX.set(unit.id, (localX.get(unit.id) ?? 0) - shift)
}

function boundsOfMembers(subgraph: Subgraph, nodes: Map<string, Node>): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const node of nodes.values()) {
    if (node.parent !== subgraph.id || !node.position) continue
    const size = resolveNodeSize(node)
    minX = Math.min(minX, node.position.x - size.width / 2)
    minY = Math.min(minY, node.position.y - size.height / 2)
    maxX = Math.max(maxX, node.position.x + size.width / 2)
    maxY = Math.max(maxY, node.position.y + size.height / 2)
  }
  if (!Number.isFinite(minX)) return subgraph.bounds ?? { x: 0, y: 0, width: 0, height: 0 }
  const pad = 20
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
