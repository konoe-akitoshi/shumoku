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
} from './index.js'
import { alignPortsToPeers, applyOctilinearRoutes, type RoutingObstacle } from './router.js'

export interface RoutedScore {
  cost: number
  crossings: number
  collinear: number
  pierce: number
  bends: number
  length: number
}

export interface CompositeSearchResult {
  comp: CompositeLayoutResult
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  score: RoutedScore
}

export interface CompositeSearchOptions {
  /** Hard cap on layout+route evaluations. Default 16. */
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
  }
  alignPortsToPeers(edges, comp.nodes)
  const obstacles: RoutingObstacle[] = []
  for (const [id, sg] of comp.subgraphs) {
    if (sg.bounds) obstacles.push({ id, bounds: sg.bounds })
  }
  applyOctilinearRoutes(edges, { obstacles })
  return { comp, ports, edges, score: scoreRoutedEdges(edges, comp.nodes) }
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
  const maxEvaluations = options.maxEvaluations ?? 16
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

  // 3) pair-flip hill-climb (each flip kept only if real routing improves)
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
  const collinear = findCollinearOverlaps(lines).length
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
  return {
    cost: crossings + collinear * 8 + pierce * 2 + bends * 0.4 + length / 400,
    crossings,
    collinear,
    pierce,
    bends,
    length,
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
