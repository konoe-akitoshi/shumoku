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
import { findCollinearOverlaps, findPortClutter, type PolylineSpec } from '../invariants.js'
import { getLinkWidthForMode } from '../link-utils.js'
import { portLabelBox } from '../port-geometry.js'
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
  /** Port-box / label-box collisions (first-class geometry, #430 lesson). */
  clutter: number
}

export interface CompositeSearchResult {
  comp: CompositeLayoutResult
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  score: RoutedScore
  /**
   * Faces that had to compress their port slots this round: node id →
   * width/height the node needs. Non-empty means the layout should
   * re-run with these as `minNodeWidths`/`minNodeHeights`
   * (port-demand feedback).
   */
  portDeficits: { widths: Map<string, number>; heights: Map<string, number> }
  /** Search telemetry: how much of the budget ran and what it bought. */
  stats?: {
    evaluations: number
    accepted: number
    initialCost: number
    finalCost: number
  }
}

export interface CompositeSearchOptions {
  /** Hard cap on layout+route evaluations. Default 160 (~2s on a
   *  60-node graph — the v3 norm; the move vocabulary saturates near
   *  190, so larger budgets buy nothing). */
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
      // the glasses bridge spans a 16px pair gap — port labels there can
      // only ever collide with the partner, so they don't render
      edge.fromPort.label = ''
      edge.toPort.label = ''
    }
  }
  // pair members seat lateral ports on their OUTWARD face, never into
  // the 16px gap toward the partner
  const outwardSide = new Map<string, 'left' | 'right'>()
  for (const pair of comp.pairs) {
    const members = pair.split('+')
    const a = members[0]
    const b = members[1]
    if (a === undefined || b === undefined) continue
    const ax = comp.nodes.get(a)?.position?.x ?? 0
    const bx = comp.nodes.get(b)?.position?.x ?? 0
    outwardSide.set(ax <= bx ? a : b, 'left')
    outwardSide.set(ax <= bx ? b : a, 'right')
  }
  const align = alignPortsToPeers(edges, comp.nodes, { outwardSide })
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
  const nodeObstacles: RoutingObstacle[] = []
  for (const [id, node] of comp.nodes) {
    if (!node.position) continue
    const size = resolveNodeSize(node)
    nodeObstacles.push({
      id,
      bounds: {
        x: node.position.x - size.width / 2,
        y: node.position.y - size.height / 2,
        width: size.width,
        height: size.height,
      },
    })
  }
  applyOctilinearRoutes(edges, { obstacles, combs, nodeObstacles })
  placeLinkLabels(edges, comp.nodes)
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
    // Port labels are owned geometry — their boxes are footprint too.
    for (const port of [edge.fromPort, edge.toPort]) {
      const labelRect = portLabelBox(port)
      if (!labelRect) continue
      for (const [x, y] of [
        [labelRect.x, labelRect.y],
        [labelRect.x + labelRect.width, labelRect.y + labelRect.height],
      ] as const) {
        figure = grow(figure, x, y, 2)
        for (const id of owners) internal.set(id, grow(internal.get(id), x, y, 2))
      }
    }
    // Labels are part of the edge's rendered footprint too. Mirror the
    // renderer's placement (midpoint of the routed points, 10px mono,
    // centered, one 12px line per label) with a conservative width
    // estimate so text never pokes out of the owning container.
    const labelLines: string[] = []
    const linkLabel = edge.link.label
    if (linkLabel !== undefined) {
      labelLines.push(Array.isArray(linkLabel) ? linkLabel.join(' / ') : linkLabel)
    }
    const vlan = edge.link.vlan
    if (vlan && vlan.length > 0) labelLines.push(`VLAN ${vlan.join(', ')}`)
    if (labelLines.length > 0 && pts.length >= 2) {
      const midIdx = Math.floor(pts.length / 2)
      const a = pts[midIdx - 1]
      const b = pts[midIdx]
      if (a && b) {
        const mx = edge.labelAnchor?.x ?? (a.x + b.x) / 2
        const my = edge.labelAnchor?.y ?? (a.y + b.y) / 2
        const halfWidth = (Math.max(...labelLines.map((t) => t.length)) * 6.5) / 2
        const top = my - 8 - 12
        const bottom = my - 8 + labelLines.length * 12
        for (const [x, y] of [
          [mx - halfWidth, top],
          [mx + halfWidth, bottom],
        ] as const) {
          figure = grow(figure, x, y, 2)
          for (const id of owners) internal.set(id, grow(internal.get(id), x, y, 2))
        }
      }
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
  return {
    comp,
    ports,
    edges,
    score: scoreRoutedEdges(edges, comp.nodes, comp.depths),
    portDeficits: { widths: align.minWidths, heights: align.minHeights },
  }
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
  const maxEvaluations = options.maxEvaluations ?? 160
  let evaluations = 0
  const budgeted = async (
    layoutOptions: CompositeLayoutOptions,
  ): Promise<CompositeSearchResult | undefined> => {
    if (evaluations >= maxEvaluations) return undefined
    evaluations++
    return evaluate(graph, layoutOptions)
  }

  let bestOptions: CompositeLayoutOptions = {}
  let best = await evaluate(graph, bestOptions)
  evaluations++
  let accepted = 0
  const initialCost = best.score.cost

  // 0) port-demand feedback: a face that had to compress its port slots
  //    reports the width its node needs. Re-layout with those floors —
  //    adopted unconditionally, because compressed ports are a geometric
  //    violation (overlapping port/label boxes), not a style preference.
  //    Faces can shift after resizing, so iterate (bounded).
  let widthFloors: ReadonlyMap<string, number> | undefined
  let heightFloors: ReadonlyMap<string, number> | undefined
  for (
    let round = 0;
    round < 3 && (best.portDeficits.widths.size > 0 || best.portDeficits.heights.size > 0);
    round++
  ) {
    const mergedW = new Map(widthFloors ?? [])
    for (const [id, w] of best.portDeficits.widths) {
      mergedW.set(id, Math.max(mergedW.get(id) ?? 0, w))
    }
    const mergedH = new Map(heightFloors ?? [])
    for (const [id, h] of best.portDeficits.heights) {
      mergedH.set(id, Math.max(mergedH.get(id) ?? 0, h))
    }
    widthFloors = mergedW
    heightFloors = mergedH
    const candidate = await budgeted({
      ...bestOptions,
      minNodeWidths: widthFloors,
      minNodeHeights: heightFloors,
    })
    if (!candidate) break
    best = candidate
    accepted++
    bestOptions = { ...bestOptions, minNodeWidths: widthFloors, minNodeHeights: heightFloors }
  }

  // 1) multi-start over the gap grid (floors ride along)
  const variants: CompositeLayoutOptions[] = [
    { zoneGap: 70 },
    { bandGap: 120 },
    { cellGapX: 24 },
    { zoneGap: 70, bandGap: 190 },
    { zoneGap: 60, bandGap: 130 },
    { zoneGap: 110 },
    { maxBandW: 2600 },
    { maxBandW: 3200 },
  ]
  for (const variant of variants) {
    const trial = { ...variant, minNodeWidths: widthFloors, minNodeHeights: heightFloors }
    const candidate = await budgeted(trial)
    if (candidate && candidate.score.cost < best.score.cost) {
      best = candidate
      accepted++
      bestOptions = trial
    }
  }

  // 2) congestion feedback: widen overflowing channels and retry once
  const bandExtra = measureCongestion(best)
  if (bandExtra.size > 0) {
    const candidate = await budgeted({ ...bestOptions, bandExtra })
    if (candidate && candidate.score.cost < best.score.cost) {
      best = candidate
      accepted++
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
    const maxSwaps = Math.min(5, current.length - 1)
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
        accepted++
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
      accepted++
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
    .slice(0, 16)
    .map(([id]) => id)
  const nudges = new Map<string, number>()
  // wider amplitude grid + second round while budget remains: the ±24
  // single shot left obvious slack on the table
  for (let round = 0; round < 2; round++) {
    let improvedThisRound = false
    for (const unitId of busiest) {
      for (const dx of [24, -24, 48, -48, 96, -96]) {
        const trial = new Map(nudges)
        trial.set(unitId, (nudges.get(unitId) ?? 0) + dx)
        const candidate = await budgeted({ ...bestOptions, nudges: trial })
        if (candidate && candidate.score.cost < best.score.cost) {
          best = candidate
          accepted++
          nudges.set(unitId, trial.get(unitId) ?? dx)
          improvedThisRound = true
          break
        }
      }
    }
    if (!improvedThisRound) break
  }

  best.stats = {
    evaluations,
    accepted,
    initialCost,
    finalCost: best.score.cost,
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

/**
 * Link-label placement as a routing stage (the same mutual-awareness
 * model as ports/labels/nodes): each edge's label slides ALONG its own
 * routed polyline to a spot that collides with nothing already known —
 * node boxes, port-label strips, and labels placed before it. The
 * renderer's fixed-midpoint is only the fallback.
 */
function placeLinkLabels(edges: Map<string, ResolvedEdge>, nodes: ResolvedLayout['nodes']): void {
  interface Box {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  const obstacles: Box[] = []
  for (const [, node] of nodes) {
    if (!node.position) continue
    const size = resolveNodeSize(node)
    obstacles.push({
      x1: node.position.x - size.width / 2,
      y1: node.position.y - size.height / 2,
      x2: node.position.x + size.width / 2,
      y2: node.position.y + size.height / 2,
    })
  }
  for (const edge of edges.values()) {
    for (const port of [edge.fromPort, edge.toPort]) {
      const strip = portLabelBox(port)
      if (strip) {
        obstacles.push({
          x1: strip.x,
          y1: strip.y,
          x2: strip.x + strip.width,
          y2: strip.y + strip.height,
        })
      }
    }
  }
  const hits = (box: Box): number => {
    let n = 0
    for (const o of obstacles) {
      if (box.x1 < o.x2 && box.x2 > o.x1 && box.y1 < o.y2 && box.y2 > o.y1) n++
    }
    return n
  }
  for (const edge of [...edges.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (edge.coupling) continue
    const lines: string[] = []
    const linkLabel = edge.link.label
    if (linkLabel !== undefined) {
      lines.push(Array.isArray(linkLabel) ? linkLabel.join(' / ') : linkLabel)
    }
    const vlan = edge.link.vlan
    if (vlan && vlan.length > 0) lines.push(`VLAN ${vlan.join(', ')}`)
    if (lines.length === 0) continue
    const pts = edge.route?.points ?? edge.points
    if (pts.length < 2) continue
    const halfW = (Math.max(...lines.map((t) => t.length)) * 6) / 2
    const boxAt = (x: number, y: number): Box => ({
      x1: x - halfW,
      y1: y - 20,
      x2: x + halfW,
      y2: y - 8 + lines.length * 12,
    })
    let best: { x: number; y: number } | undefined
    let bestCost = Number.POSITIVE_INFINITY
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1]
      const b = pts[s]
      if (!a || !b) continue
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < 24 && pts.length > 2) continue
      for (const t of [0.5, 0.3, 0.7]) {
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        // prefer the path's middle and segment centers, but a clean
        // spot anywhere on the wire beats a cluttered midpoint
        const cost = hits(boxAt(x, y)) * 10 + Math.abs(s - pts.length / 2) + (t === 0.5 ? 0 : 0.5)
        if (cost < bestCost) {
          bestCost = cost
          best = { x, y }
        }
      }
    }
    if (best) {
      edge.labelAnchor = best
      obstacles.push(boxAt(best.x, best.y))
    }
  }
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
  // port/label clutter: collisions among owned geometry (port boxes,
  // label boxes, labels vs foreign nodes). With the demand feedback
  // this should be zero; the term makes any residual visible to the
  // search instead of invisible to it.
  const seenPorts = new Map<string, ResolvedPort>()
  for (const edge of edges.values()) {
    seenPorts.set(edge.fromPort.id, edge.fromPort)
    seenPorts.set(edge.toPort.id, edge.toPort)
  }
  const nodeBoxSpecs = [...nodes]
    .filter(([, node]) => node.position)
    .map(([id, node]) => {
      const size = resolveNodeSize(node)
      return {
        id,
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width: size.width,
        height: size.height,
      }
    })
  const clutter = findPortClutter([...seenPorts.values()], nodeBoxSpecs).length

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
    cost:
      crossings +
      collinear * 8 +
      // a wire under a node is a defect, not a trade-off (90° crossings
      // are the grammar; piercing is not)
      pierce * 20 +
      bends * 0.4 +
      length / 400 +
      upward * 12 +
      // overlap-free is a REQUIREMENT, not a preference — weight high
      // enough that no crossing/length win can buy a collision
      clutter * 40,
    crossings,
    collinear,
    pierce,
    bends,
    length,
    upward,
    clutter,
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
