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
}

export interface CompositeLayoutResult {
  /** Copies of the input nodes with `position` (center) set. */
  nodes: Map<string, Node>
  /** Original subgraphs (with bounds) plus synthetic zone boxes. */
  subgraphs: Map<string, Subgraph>
  bounds: Bounds
  /** zone name → member node ids (for invariant checks / diagnostics). */
  zones: Map<string, string[]>
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

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

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

  // -- hierarchy depth: apex from role tiers, then undirected BFS -------------
  const depth = computeDepths(ids, nodes, neighbors)

  // -- redundant pairs ---------------------------------------------------------
  const pairedWith = detectPairs(ids, nodes, edges, neighbors, zoneOf, depth)

  // -- units -------------------------------------------------------------------
  const PAIR_GAP = 16
  const units: Unit[] = []
  const unitOf = new Map<string, string>()
  for (const id of ids) {
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
    for (const key of rowKeys) {
      const row = rowMap.get(key) ?? []
      rows.push(row)
      const rowWidth = row.reduce((sum, u) => sum + u.width, 0) + cellGapX * (row.length - 1)
      maxRowWidth = Math.max(maxRowWidth, rowWidth)
      const rowHeight = Math.max(...row.map((u) => u.height))
      let x = zonePad
      for (const unit of row) {
        localX.set(unit.id, x + unit.width / 2 + jitter(unit.members[0] ?? unit.id, 3) * 8)
        localY.set(unit.id, y + rowHeight / 2 + jitter(unit.members[0] ?? unit.id, 7) * 6)
        x += unit.width + cellGapX
      }
      y += rowHeight + rowGap
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
  placeZoneBands(zoneIds, zoneRank, zoneAdj, zoneParent, zoneBox, zoneX, zoneY, zoneGap, bandGap)

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
    let x = gx - unit.width / 2
    for (const member of unit.members) {
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

  return {
    nodes,
    subgraphs,
    bounds: {
      x: 0,
      y: 0,
      width: maxX - minX + PAD * 2,
      height: maxY - minY + PAD * 2,
    },
    zones: zoneMembers,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function computeDepths(
  ids: readonly string[],
  nodes: Map<string, Node>,
  neighbors: Map<string, Map<string, LogicalEdge>>,
): Map<string, number> {
  // Apex candidates must carry trunk-class bandwidth. This is the v3
  // "default-route sink guard" (engine-v2-design.md §7.5): a shared
  // firewall/last-resort node touches everything over thin links and a
  // low device-tier (firewall=15), so without the bandwidth gate it
  // out-ranks the actual border routers and the whole diagram hangs off
  // the sink.
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
  // 2) naming + structure fallback: same zone, same depth, direct link,
  //    and twin-style names (stem or host part match)
  for (const a of ids) {
    if (paired.has(a)) continue
    const nodeA = nodes.get(a)
    if (!nodeA) continue
    const labelA = labelOf(nodeA)
    for (const [b] of [...(neighbors.get(a) ?? new Map())].sort()) {
      if (b <= a || paired.has(b)) continue
      if (zoneOf(a) !== zoneOf(b)) continue
      if (depth.get(a) !== depth.get(b)) continue
      const nodeB = nodes.get(b)
      if (!nodeB) continue
      const labelB = labelOf(nodeB)
      if (stemOf(labelA) === stemOf(labelB) || hostOf(labelA) === hostOf(labelB)) {
        tryPair(a, b)
        break
      }
    }
  }
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
): void {
  const ranks = [...new Set(zoneIds.map((z) => zoneRank.get(z) ?? 0))].sort((a, b) => a - b)
  const centerOf = new Map<string, number>()
  for (const zone of zoneIds) centerOf.set(zone, 0)

  let y = 0
  const placed = new Set<string>()
  for (const rank of ranks) {
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
    // 1D placement at desired x, resolving overlaps left→right, then center
    const xs: number[] = []
    let cursor = Number.NEGATIVE_INFINITY
    for (const block of blocks) {
      let x = block.desired - block.w / 2
      if (x < cursor) x = cursor
      xs.push(x)
      cursor = x + block.w + zoneGap
    }
    const firstX = xs[0] ?? 0
    const lastBlock = blocks[blocks.length - 1]
    const lastX = xs[xs.length - 1] ?? 0
    const shift = -(firstX + lastX + (lastBlock?.w ?? 0)) / 2
    let bandHeight = 0
    for (const [i, block] of blocks.entries()) {
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
      bandHeight = Math.max(bandHeight, block.h)
    }
    y += bandHeight + bandGap
  }
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
