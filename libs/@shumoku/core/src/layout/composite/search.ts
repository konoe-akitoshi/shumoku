// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Place-and-route search for the composite layout (engine-v3-migration.md
 * B3, #434; the 突き合わせ loop of engine-v3-design.md §32-35).
 *
 * Placement proposes a form, wiring routes it for real, and the score of
 * the ROUTED geometry arbitrates — never a straight-line proxy (v3 §32:
 * optimizing a proxy quietly diverges from what gets drawn). Three layers,
 * all deterministic and bounded:
 *
 *   1. multi-start over a small parameter grid (gaps),
 *   2. congestion feedback: a channel whose wire-track demand overflows
 *      its band gap widens the road bed and the layout re-runs,
 *   3. pair-flip hill-climb: the left/right order inside each redundant
 *      pair is flipped if real routing gets cheaper (v3 §35 — the move
 *      that reproduced a human reviewer's "these two look backwards").
 */

import type { NetworkGraph } from '../../models/types.js'
import { placePorts } from '../auto-placement/flat-tree/port-placement.js'
import { resolveNodeSize } from '../engine/index.js'
import { findCollinearOverlaps, type PolylineSpec } from '../invariants.js'
import { getLinkWidthForMode } from '../link-utils.js'
import type { ResolvedEdge, ResolvedLayout, ResolvedPort } from '../resolved-types.js'
import { routeEdges } from '../route-edges.js'
import {
  type CompositeLayoutOptions,
  type CompositeLayoutResult,
  layoutComposite,
  pairKey,
  ZONE_SUBGRAPH_PREFIX,
} from './index.js'
import { alignPortsToPeers, applyOctilinearRoutes, type RoutingObstacle } from './router.js'

export interface RoutedScore {
  cost: number
  crossings: number
  collinear: number
  pierce: number
  bends: number
  length: number
  /** Wires that climb against the hierarchy (deeper node drawn above its shallower peer). */
  upward: number
}

export interface CompositeSearchResult {
  comp: CompositeLayoutResult
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  score: RoutedScore
}

export interface CompositeSearchOptions {
  /** Hard cap on layout+route evaluations. Default 48. */
  maxEvaluations?: number
}

/** Lay out, port, route and score one composite variant. */
async function evaluate(
  graph: NetworkGraph,
  layoutOptions: CompositeLayoutOptions,
): Promise<CompositeSearchResult> {
  const comp = layoutComposite(graph, layoutOptions)
  const direction = graph.settings?.direction ?? 'TB'
  const ports = placePorts(comp.nodes, graph.links, direction)
  const edges = await routeEdges(comp.nodes, ports, graph.links, comp.subgraphs)
  for (const edge of edges.values()) {
    edge.width = Math.max(1, getLinkWidthForMode(edge.link, 'linear'))
    // v3 grammar: HA heartbeats are couplings, not wires — explicit
    // (link.redundancy) and inferred (direct link between detected pair
    // members) alike. Couplings skip port seating, routing, and scoring.
    if (
      edge.link.redundancy !== undefined ||
      comp.heartbeats.has(pairKey(edge.fromNodeId, edge.toNodeId))
    ) {
      edge.coupling = true
    }
  }
  alignPortsToPeers(edges, comp.nodes)
  const obstacles: RoutingObstacle[] = []
  for (const [id, sg] of comp.subgraphs) {
    if (sg.bounds) obstacles.push({ id, bounds: sg.bounds })
  }
  // org-chart combs (v3 §47⑤): group primary edges by their parent (the
  // shallower endpoint) — a parent feeding ≥2 children draws one trunk
  // to a shared bus instead of N independent risers.
  const combs = new Map<string, string[]>()
  for (const edge of edges.values()) {
    if (edge.coupling) continue
    if (!comp.primaryEdges.has(pairKey(edge.fromNodeId, edge.toNodeId))) continue
    const da = comp.depths.get(edge.fromNodeId)
    const db = comp.depths.get(edge.toNodeId)
    if (da === undefined || db === undefined || da === db) continue
    const parent = da < db ? edge.fromNodeId : edge.toNodeId
    const list = combs.get(parent) ?? []
    list.push(edge.id)
    combs.set(parent, list)
  }
  for (const [parent, list] of combs) {
    if (list.length < 2) combs.delete(parent)
  }
  applyOctilinearRoutes(edges, { obstacles, combs })
  // A subgraph OWNS the wiring that completes inside it (both endpoints
  // are members), and routes legally run outside the member boxes
  // (gutter bypasses, ramp under-loops, vertical shifts). Container
  // bounds therefore settle bottom-up AFTER routing: every subgraph
  // stretches to its internal routes, and the figure bounds to all of
  // them. Cross-boundary wiring belongs to the enclosing level, not to
  // the zone it happens to pass.
  const memberSets = new Map<string, Set<string>>()
  for (const id of comp.subgraphs.keys()) {
    if (id.startsWith(ZONE_SUBGRAPH_PREFIX)) {
      const zoneMembers = comp.zones.get(id.slice(ZONE_SUBGRAPH_PREFIX.length))
      if (zoneMembers) memberSets.set(id, new Set(zoneMembers))
    } else {
      const set = new Set<string>()
      for (const [nodeId, node] of comp.nodes) if (node.parent === id) set.add(nodeId)
      if (set.size > 0) memberSets.set(id, set)
    }
  }
  interface Extent {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  const grow = (extent: Extent | undefined, x: number, y: number, half: number): Extent => ({
    x1: Math.min(extent?.x1 ?? Number.POSITIVE_INFINITY, x - half),
    y1: Math.min(extent?.y1 ?? Number.POSITIVE_INFINITY, y - half),
    x2: Math.max(extent?.x2 ?? Number.NEGATIVE_INFINITY, x + half),
    y2: Math.max(extent?.y2 ?? Number.NEGATIVE_INFINITY, y + half),
  })
  let figure: Extent | undefined
  const internal = new Map<string, Extent>()
  for (const edge of edges.values()) {
    if (edge.coupling) continue
    const pts = edge.route?.points ?? edge.points
    const half = edge.width / 2 + 2
    const owners: string[] = []
    for (const [id, members] of memberSets) {
      if (members.has(edge.fromNodeId) && members.has(edge.toNodeId)) owners.push(id)
    }
    for (const p of pts) {
      figure = grow(figure, p.x, p.y, half)
      for (const id of owners) internal.set(id, grow(internal.get(id), p.x, p.y, half))
    }
  }
  for (const [id, extent] of internal) {
    const sg = comp.subgraphs.get(id)
    const b = sg?.bounds
    if (!sg || !b) continue
    const nx1 = Math.min(b.x, extent.x1 - 12)
    const ny1 = Math.min(b.y, extent.y1 - 12)
    const nx2 = Math.max(b.x + b.width, extent.x2 + 12)
    const ny2 = Math.max(b.y + b.height, extent.y2 + 12)
    sg.bounds = { x: nx1, y: ny1, width: nx2 - nx1, height: ny2 - ny1 }
  }
  if (figure) {
    const bb = comp.bounds
    const bx1 = Math.min(bb.x, figure.x1 - 28)
    const by1 = Math.min(bb.y, figure.y1 - 28)
    const bx2 = Math.max(bb.x + bb.width, figure.x2 + 28)
    const by2 = Math.max(bb.y + bb.height, figure.y2 + 28)
    comp.bounds = { x: bx1, y: by1, width: bx2 - bx1, height: by2 - by1 }
  }
  return { comp, ports, edges, score: scoreRoutedEdges(edges, comp.nodes, comp.depths) }
}

/**
 * Run the search: parameter multi-start → congestion pass → pair flips.
 * Total evaluations stay within `maxEvaluations` (default 16); the
 * result is always the best ROUTED variant seen.
 */
export async function searchCompositeLayout(
  graph: NetworkGraph,
  options: CompositeSearchOptions = {},
): Promise<CompositeSearchResult> {
  const maxEvaluations = options.maxEvaluations ?? 48
  let evaluations = 0
  const budgeted = async (
    layoutOptions: CompositeLayoutOptions,
  ): Promise<CompositeSearchResult | undefined> => {
    if (evaluations >= maxEvaluations) return undefined
    evaluations++
    return evaluate(graph, layoutOptions)
  }

  // 1) multi-start over the gap grid
  const variants: CompositeLayoutOptions[] = [
    {},
    { zoneGap: 70 },
    { bandGap: 120 },
    { cellGapX: 24 },
    { zoneGap: 70, bandGap: 190 },
  ]
  let bestOptions: CompositeLayoutOptions = {}
  let best = await evaluate(graph, bestOptions)
  evaluations++
  for (const variant of variants.slice(1)) {
    const candidate = await budgeted(variant)
    if (candidate && candidate.score.cost < best.score.cost) {
      best = candidate
      bestOptions = variant
    }
  }

  // 2) congestion feedback: widen overflowing channels and retry once
  const bandExtra = measureCongestion(best)
  if (bandExtra.size > 0) {
    const candidate = await budgeted({ ...bestOptions, bandExtra })
    if (candidate && candidate.score.cost < best.score.cost) {
      best = candidate
      bestOptions = { ...bestOptions, bandExtra }
    }
  }

  // 3) band-order arbitration (v3 §33): adjacent block transpositions per
  //    band, each kept only if the ROUTED score improves — the deterministic
  //    stand-in for v3's simultaneous place-and-route over band orderings.
  const acceptedOrders = new Map<number, readonly string[]>()
  for (const [bandIndex, blocks] of best.comp.bandBlocks.entries()) {
    if (blocks.length < 2) continue
    const current = [...(acceptedOrders.get(bandIndex) ?? blocks)]
    const maxSwaps = Math.min(3, current.length - 1)
    for (let i = 0; i < maxSwaps; i++) {
      const swapped = [...current]
      const a = swapped[i]
      const b = swapped[i + 1]
      if (a === undefined || b === undefined) continue
      swapped[i] = b
      swapped[i + 1] = a
      const trial = new Map(acceptedOrders)
      trial.set(bandIndex, swapped)
      const candidate = await budgeted({ ...bestOptions, bandOrder: trial })
      if (candidate && candidate.score.cost < best.score.cost) {
        best = candidate
        acceptedOrders.set(bandIndex, swapped)
        current.splice(0, current.length, ...swapped)
      }
    }
  }
  if (acceptedOrders.size > 0) bestOptions = { ...bestOptions, bandOrder: acceptedOrders }

  // 4) pair-flip hill-climb (each flip kept only if real routing improves)
  const flips = new Set<string>()
  for (const pair of [...best.comp.pairs].sort()) {
    const trial = new Set(flips)
    trial.add(pair)
    const candidate = await budgeted({ ...bestOptions, pairFlips: trial })
    if (candidate && candidate.score.cost < best.score.cost) {
      best = candidate
      flips.add(pair)
    }
  }
  if (flips.size > 0) bestOptions = { ...bestOptions, pairFlips: flips }

  // 5) unit nudge hill-climb (v3 §32 ±x moves) on the busiest units —
  //    crossing knots usually involve the high-degree units, so spend the
  //    remaining budget there.
  const degree = new Map<string, number>()
  for (const link of graph.links) {
    degree.set(link.from.node, (degree.get(link.from.node) ?? 0) + 1)
    degree.set(link.to.node, (degree.get(link.to.node) ?? 0) + 1)
  }
  const unitOf = new Map<string, string>()
  for (const pair of best.comp.pairs) {
    for (const member of pair.split('+')) unitOf.set(member, pair)
  }
  const unitDegree = new Map<string, number>()
  for (const [nodeId, d] of degree) {
    if (best.comp.sinks.includes(nodeId)) continue
    const unitId = unitOf.get(nodeId) ?? nodeId
    unitDegree.set(unitId, (unitDegree.get(unitId) ?? 0) + d)
  }
  const busiest = [...unitDegree.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 6)
    .map(([id]) => id)
  const nudges = new Map<string, number>()
  for (const unitId of busiest) {
    for (const dx of [24, -24]) {
      const trial = new Map(nudges)
      trial.set(unitId, dx)
      const candidate = await budgeted({ ...bestOptions, nudges: trial })
      if (candidate && candidate.score.cost < best.score.cost) {
        best = candidate
        nudges.set(unitId, dx)
        break
      }
    }
  }

  return best
}

/**
 * Channel congestion: for each inter-band gap, the demand is the summed
 * bundle height of horizontal runs wanting that gap; overflow becomes
 * extra gap before the lower band (v3 §38-39 — measuring placed spans
 * underestimates because allocators clamp into the channel).
 */
function measureCongestion(result: CompositeSearchResult): Map<number, number> {
  const bands = result.comp.bands
  const demand = new Map<number, number>()
  const gapOf = (y: number): number => {
    for (let i = 0; i + 1 < bands.length; i++) {
      const lower = bands[i]
      const upper = bands[i + 1]
      if (!lower || !upper) continue
      if (y >= lower.bottom - 4 && y <= upper.top + 4) return i
    }
    return -1
  }
  for (const edge of result.edges.values()) {
    const points = edge.route?.points ?? edge.points
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      if (!a || !b || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.x - b.x) < 14) continue
      const gap = gapOf(a.y)
      if (gap >= 0) demand.set(gap, (demand.get(gap) ?? 0) + edge.width + 4)
    }
  }
  const extra = new Map<number, number>()
  for (const [gap, need] of demand) {
    const lower = bands[gap]
    const upper = bands[gap + 1]
    if (!lower || !upper) continue
    const available = upper.top - lower.bottom - 24
    if (need > available) extra.set(gap + 1, Math.ceil(need - available))
  }
  return extra
}

/** Score actually-routed geometry (no straight-line proxies). */
export function scoreRoutedEdges(
  edges: Map<string, ResolvedEdge>,
  nodes: ResolvedLayout['nodes'],
  depths?: ReadonlyMap<string, number>,
): RoutedScore {
  interface Poly {
    a: string
    b: string
    pts: { x: number; y: number }[]
    half: number
    id: string
  }
  const polys: Poly[] = []
  for (const edge of edges.values()) {
    if (edge.coupling) continue // glasses bridge, not a wire — never scored
    const pts = edge.route?.points ?? edge.points
    if (pts.length < 2) continue
    polys.push({
      a: edge.fromNodeId,
      b: edge.toNodeId,
      pts,
      half: Math.max(0.5, edge.width / 2),
      id: edge.id,
    })
  }
  let crossings = 0
  let bends = 0
  let length = 0
  for (const poly of polys) {
    bends += Math.max(0, poly.pts.length - 2)
    for (let i = 1; i < poly.pts.length; i++) {
      const a = poly.pts[i - 1]
      const b = poly.pts[i]
      if (a && b) length += Math.hypot(b.x - a.x, b.y - a.y)
    }
  }
  for (let i = 0; i < polys.length; i++) {
    const pa = polys[i]
    if (!pa) continue
    for (let j = i + 1; j < polys.length; j++) {
      const pb = polys[j]
      if (!pb) continue
      if (pa.a === pb.a || pa.a === pb.b || pa.b === pb.a || pa.b === pb.b) continue
      for (let s = 1; s < pa.pts.length; s++) {
        for (let t = 1; t < pb.pts.length; t++) {
          const a1 = pa.pts[s - 1]
          const a2 = pa.pts[s]
          const b1 = pb.pts[t - 1]
          const b2 = pb.pts[t]
          if (a1 && a2 && b1 && b2 && segmentsIntersect(a1, a2, b1, b2)) crossings++
        }
      }
    }
  }
  const lines: PolylineSpec[] = polys.map((p) => ({ id: p.id, points: p.pts, halfWidth: p.half }))
  // comb siblings SHARE the trunk/bus by design — same-bus overlap is the
  // org-chart grammar, not a violation
  const busOf = new Map<string, string>()
  for (const edge of edges.values()) {
    if (edge.route?.kind === 'bus') busOf.set(edge.id, edge.route.busId)
  }
  const collinear = findCollinearOverlaps(lines).filter((o) => {
    const ba = busOf.get(o.a)
    return ba === undefined || ba !== busOf.get(o.b)
  }).length
  // wires running through unrelated node boxes
  let pierce = 0
  const boxes: { id: string; x: number; y: number; w: number; h: number }[] = []
  for (const [id, node] of nodes) {
    if (!node.position) continue
    const size = resolveNodeSize(node)
    boxes.push({ id, x: node.position.x, y: node.position.y, w: size.width, h: size.height })
  }
  for (const poly of polys) {
    for (const box of boxes) {
      if (box.id === poly.a || box.id === poly.b) continue
      const bx = box.x - box.w / 2 - 2
      const by = box.y - box.h / 2 - 2
      const bw = box.w + 4
      const bh = box.h + 4
      let hit = false
      for (let s = 1; s < poly.pts.length && !hit; s++) {
        const a = poly.pts[s - 1]
        const b = poly.pts[s]
        if (!a || !b) continue
        if (Math.max(a.x, b.x) < bx || Math.min(a.x, b.x) > bx + bw) continue
        if (Math.max(a.y, b.y) < by || Math.min(a.y, b.y) > by + bh) continue
        hit =
          segmentsIntersect(a, b, { x: bx, y: by }, { x: bx + bw, y: by }) ||
          segmentsIntersect(a, b, { x: bx, y: by + bh }, { x: bx + bw, y: by + bh }) ||
          segmentsIntersect(a, b, { x: bx, y: by }, { x: bx, y: by + bh }) ||
          segmentsIntersect(a, b, { x: bx + bw, y: by }, { x: bx + bw, y: by + bh })
      }
      if (hit) pierce++
    }
  }
  // upward penalty (v3 §31): 基本上流>下流 — a wire whose deeper endpoint
  // sits ABOVE its shallower endpoint reads as the hierarchy inverting.
  let upward = 0
  if (depths) {
    for (const edge of edges.values()) {
      if (edge.coupling) continue
      const da = depths.get(edge.fromNodeId)
      const db = depths.get(edge.toNodeId)
      if (da === undefined || db === undefined || da === db) continue
      const deeper = da > db ? edge.fromNodeId : edge.toNodeId
      const shallower = da > db ? edge.toNodeId : edge.fromNodeId
      const yDeep = nodes.get(deeper)?.position?.y
      const yShallow = nodes.get(shallower)?.position?.y
      if (yDeep !== undefined && yShallow !== undefined && yDeep < yShallow - 10) upward++
    }
  }
  return {
    cost: crossings + collinear * 8 + pierce * 2 + bends * 0.4 + length / 400 + upward * 12,
    crossings,
    collinear,
    pierce,
    bends,
    length,
    upward,
  }
}

function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): boolean {
  const d1 = (a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x)
  const d2 = (a2.x - a1.x) * (b2.y - a1.y) - (a2.y - a1.y) * (b2.x - a1.x)
  const d3 = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)
  const d4 = (b2.x - b1.x) * (a2.y - b1.y) - (b2.y - b1.y) * (a2.x - b1.x)
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0
}
