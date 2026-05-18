// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Edge-routing pass.
 *
 * Now that edges render as cubic Bezier curves directly from port
 * coordinates in the renderer, the routing pass collapses to a
 * trivial constructor: every edge gets a 2-point "polyline" of
 * `[from.absolutePosition, to.absolutePosition]`. The renderer
 * ignores these points for the drawn path and computes a curve from
 * the port sides instead. The points stay on `ResolvedEdge` only so
 * non-rendering consumers (label midpoint, hit testing, static
 * export, BOM cable-length) keep working without a separate code
 * path.
 *
 * History: this file replaces the previous `libavoid-router.ts` (orthogonal
 * routing via libavoid-js WASM + Sugiyama channel routing + bend
 * post-process). All of that became unused when the bezier renderer
 * shipped as the default; keeping it added ~3500 lines of dead code
 * and a 500KB WASM blob to the bundle. See PR #227 for the bezier
 * switch and the refactor that immediately followed.
 *
 * Lane offset post-process: when N>1 edges share a source or target
 * port the curves all leave / arrive at the same point and stack
 * visually on top of each other. The post-process assigns a lateral
 * offset per edge (perpendicular to the port's outward normal) so
 * the curves fan apart at the shared port. Order along the lane is
 * by the peer endpoint's coordinate along the lateral axis, which
 * keeps the lanes parallel to the source→target progression and
 * minimises additional crossings.
 *
 * Bus routing post-process: when N>=3 edges from the same node fan
 * out to roughly-coplanar children (same downstream layer), the
 * router rebuilds them as a single horizontal backbone with vertical
 * stubs ("T-shaped tree"). Each edge becomes a 4-point orthogonal
 * polyline (source port → trunk attach → backbone leave → target
 * port) sharing the middle segment with its siblings via a common
 * `busId`. The bus replaces the default Bezier on a per-edge basis;
 * mixed graphs (some bus, some Bezier) work without extra wiring.
 */

import type { Bounds, Link, Node, Subgraph } from '../models/types.js'
import { getLinkWidth } from './link-utils.js'
import type { ResolvedEdge, ResolvedPort } from './resolved-types.js'

/** Centre-to-centre spacing between adjacent lanes, in SVG units. */
const LANE_STRIDE = 8
/** Hard cap on the half-width of the fan; beyond this we accept some overlap rather than spreading edges off the node footprint. */
const LANE_MAX_HALF_WIDTH = 28

/**
 * Minimum fan-out size for bus routing. Below this the edges stay
 * cubic Bezier (less visual noise for 2-way splits). 3 chosen so that
 * "router → 3 subgraphs" already wins the readability trade-off.
 */
const BUS_MIN_GROUP_SIZE = 3
/**
 * Trunk Y position: distance below the source port at which the
 * backbone runs. Small enough that the trunk stays close to the
 * source node (so the backbone reads as "leaves from this node")
 * but large enough to clear the source label area.
 */
const BUS_TRUNK_DROP = 28
/**
 * Maximum target-y spread before the bus is rejected. If the
 * destinations sit on wildly different layers (e.g. fan-out crosses
 * two unrelated tiers) the trunk would have to slant or fork, both
 * of which we'd rather not do — fall back to Bezier instead.
 */
const BUS_MAX_TARGET_Y_SPREAD = 40

/** Horizontal clearance between an obstacle's edge and the innermost corridor lane. */
const OBSTACLE_CORRIDOR_MARGIN = 20
/** Vertical clearance between an obstacle's edge and the innermost L-shape jog row. */
const OBSTACLE_JOG_MARGIN = 14
/**
 * When a bus must deflect around an obstacle, each branch gets its
 * own parallel lane instead of all converging on a single corridor.
 * `CORRIDOR_LANE_STRIDE` is the centre-to-centre x spacing between
 * adjacent vertical corridors; `JOG_LANE_STRIDE` is the y spacing
 * between adjacent horizontal jog rows. Stride values picked so the
 * fan reads as N distinct cables rather than one fat smudge.
 */
const CORRIDOR_LANE_STRIDE = 12
const JOG_LANE_STRIDE = 6

/**
 * Produce a `ResolvedEdge` for every link whose endpoints resolve to
 * known ports. Links pointing at a missing port are dropped (matches
 * the previous behaviour of libavoid-router).
 *
 * The function returns a Promise for backwards compatibility with
 * the old WASM-backed router — every existing caller already awaits
 * the result, and async-of-sync incurs zero cost.
 *
 * `nodes` is accepted but unused so the signature mirrors the
 * historical libavoid-router API. Bezier edges read positions off
 * `ports` directly via each `ResolvedPort.absolutePosition`.
 */
export async function routeEdges(
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  links: readonly Link[],
  subgraphs?: Map<string, Subgraph>,
): Promise<Map<string, ResolvedEdge>> {
  const edges = new Map<string, ResolvedEdge>()
  for (const [i, link] of links.entries()) {
    const linkId = link.id ?? `__link_${i}`
    const fromNodeId = link.from.node
    const toNodeId = link.to.node
    const fromPortId = `${fromNodeId}:${link.from.port}`
    const toPortId = `${toNodeId}:${link.to.port}`
    const fromPort = ports.get(fromPortId)
    const toPort = ports.get(toPortId)
    if (!fromPort || !toPort) continue
    edges.set(linkId, {
      id: linkId,
      fromPortId,
      toPortId,
      fromPort,
      toPort,
      fromNodeId,
      toNodeId,
      fromEndpoint: link.from,
      toEndpoint: link.to,
      points: [
        { x: fromPort.absolutePosition.x, y: fromPort.absolutePosition.y },
        { x: toPort.absolutePosition.x, y: toPort.absolutePosition.y },
      ],
      width: getLinkWidth(link),
      link,
    })
  }
  assignBusRoutes(edges, nodes, subgraphs)
  assignLaneOffsets(edges)
  if (subgraphs) detourAroundObstacles(edges, nodes, subgraphs)
  return edges
}

/** Margin (in SVG units) between the detoured wire and the obstacle bbox. */
const DETOUR_CLEARANCE = 24
/** Length of the "stalk" between source/target port and the corridor segment. */
const DETOUR_STALK = 36
/** Number of bezier samples to use when checking for obstacle crossings. */
const DETOUR_SAMPLES = 16

/**
 * Replace each bezier whose path crosses a non-endpoint node or
 * subgraph hull with an orthogonal polyline that routes around
 * the obstacle. Only the edges that actually conflict get
 * rerouted — most edges keep their clean default bezier.
 *
 * This is the layout-level enforcement of the "wires never
 * overlap non-endpoint geometry" invariant (#280). The detection
 * is purely geometric: sample the bezier the renderer would
 * draw, and if any sample sits inside an obstacle bbox, build a
 * detour. Layout doesn't need to know about routing details, and
 * routing doesn't need to feed back into placement — the two
 * concerns stay separate but visually coherent.
 */
function detourAroundObstacles(
  edges: Map<string, ResolvedEdge>,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
): void {
  for (const edge of edges.values()) {
    if (edge.route) continue // bus / lane / preassigned routes are explicit
    const fromSide = edge.fromPort.side
    const toSide = edge.toPort.side
    // Only handle vertical-flow cases for now — they're where the
    // transit-through-chain pattern shows up. Horizontal flow (LR
    // direction) would need symmetric treatment along the x axis.
    const isVerticalFlow =
      (fromSide === 'bottom' && toSide === 'top') || (fromSide === 'top' && toSide === 'bottom')
    if (!isVerticalFlow) continue

    const blocker = findBezierObstacle(edge, nodes, subgraphs)
    if (!blocker) continue

    const src = edge.fromPort.absolutePosition
    const tgt = edge.toPort.absolutePosition
    // Pick the side of the blocker closer to the target's x so
    // the trunk of the detour doesn't have to double back.
    const blockerCentre = blocker.x + blocker.width / 2
    const goLeft = tgt.x < blockerCentre
    const corridorX = goLeft
      ? blocker.x - DETOUR_CLEARANCE
      : blocker.x + blocker.width + DETOUR_CLEARANCE
    const sign = fromSide === 'bottom' ? 1 : -1
    const stalkOutY = src.y + sign * DETOUR_STALK
    const stalkInY = tgt.y - sign * DETOUR_STALK
    const points = [
      { x: src.x, y: src.y },
      { x: src.x, y: stalkOutY },
      { x: corridorX, y: stalkOutY },
      { x: corridorX, y: stalkInY },
      { x: tgt.x, y: stalkInY },
      { x: tgt.x, y: tgt.y },
    ]
    edge.route = { kind: 'polyline', points }
    // Lane offsets are applied at the bezier port — they fight
    // the polyline corner shape, so clear them for this edge.
    edge.fromLateralOffset = undefined
    edge.toLateralOffset = undefined
  }
}

/**
 * Sample the bezier the renderer would draw for `edge` and find
 * any non-endpoint node or subgraph hull whose bbox the curve
 * enters. Multiple blockers are merged into one bounding box so
 * the detour wraps the whole cluster.
 */
function findBezierObstacle(
  edge: ResolvedEdge,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
): { x: number; y: number; width: number; height: number } | null {
  const samples = sampleBezier(edge)
  const sourceAncestors = nodeAncestorSubgraphs(edge.fromNodeId, nodes, subgraphs)
  const targetAncestors = nodeAncestorSubgraphs(edge.toNodeId, nodes, subgraphs)
  let merged: { x: number; y: number; width: number; height: number } | null = null
  const grow = (b: { x: number; y: number; width: number; height: number }) => {
    if (!merged) {
      merged = { ...b }
    } else {
      const left = Math.min(merged.x, b.x)
      const top = Math.min(merged.y, b.y)
      const right = Math.max(merged.x + merged.width, b.x + b.width)
      const bottom = Math.max(merged.y + merged.height, b.y + b.height)
      merged = { x: left, y: top, width: right - left, height: bottom - top }
    }
  }
  // Non-endpoint node bodies.
  for (const [nodeId, node] of nodes) {
    if (nodeId === edge.fromNodeId || nodeId === edge.toNodeId) continue
    const bbox = nodeBounds(node)
    if (!bbox) continue
    if (samples.some((s) => pointInRect(s.x, s.y, bbox))) grow(bbox)
  }
  // Non-endpoint subgraph hulls — but only flag subgraphs that
  // aren't ancestors of either endpoint. A wire is allowed to
  // cross the subgraph hull of its own source/target chain;
  // that's just it leaving / entering the visual group.
  for (const [sgId, sg] of subgraphs) {
    if (sourceAncestors.has(sgId) || targetAncestors.has(sgId)) continue
    if (!sg.bounds) continue
    if (samples.some((s) => pointInRect(s.x, s.y, sg.bounds as Bounds))) grow(sg.bounds)
  }
  return merged
}

/** Approximate the renderer's port-anchored bezier with N samples. */
function sampleBezier(edge: ResolvedEdge): Array<{ x: number; y: number }> {
  const fp = edge.fromPort.absolutePosition
  const tp = edge.toPort.absolutePosition
  const dx = tp.x - fp.x
  const dy = tp.y - fp.y
  const dist = Math.hypot(dx, dy)
  const cpDist = Math.max(40, dist * 0.5)
  const normal = (side: ResolvedPort['side']): { x: number; y: number } => {
    if (side === 'top') return { x: 0, y: -1 }
    if (side === 'bottom') return { x: 0, y: 1 }
    if (side === 'left') return { x: -1, y: 0 }
    return { x: 1, y: 0 }
  }
  const fn = normal(edge.fromPort.side)
  const tn = normal(edge.toPort.side)
  const c1 = { x: fp.x + fn.x * cpDist, y: fp.y + fn.y * cpDist }
  const c2 = { x: tp.x + tn.x * cpDist, y: tp.y + tn.y * cpDist }
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= DETOUR_SAMPLES; i++) {
    const t = i / DETOUR_SAMPLES
    const mt = 1 - t
    out.push({
      x: mt ** 3 * fp.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * tp.x,
      y: mt ** 3 * fp.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * tp.y,
    })
  }
  return out
}

/** Point-in-rectangle test (strict — touching the edge doesn't count). */
function pointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height
}

/** Bounding box of a positioned node, or null if it has no position/size. */
function nodeBounds(node: Node): { x: number; y: number; width: number; height: number } | null {
  if (!node.position || !node.size) return null
  return {
    x: node.position.x - node.size.width / 2,
    y: node.position.y - node.size.height / 2,
    width: node.size.width,
    height: node.size.height,
  }
}

/** Set of subgraph ids that contain `nodeId` directly or transitively. */
function nodeAncestorSubgraphs(
  nodeId: string,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
): Set<string> {
  const out = new Set<string>()
  let cur: string | undefined = nodes.get(nodeId)?.parent
  while (cur) {
    if (out.has(cur)) break
    out.add(cur)
    cur = subgraphs.get(cur)?.parent
  }
  return out
}

/**
 * Bounds-merged union of obstacles that all sit in the same vertical
 * band as the bus source-to-trunk corridor. We treat a tight stack of
 * obstacles as one wider blocker so the deflection corridor lands
 * cleanly to one side of the whole cluster.
 */
function findBlockingObstacles(
  fromY: number,
  trunkY: number,
  sourceXMin: number,
  sourceXMax: number,
  exclude: Set<string>,
  subgraphs: Map<string, Subgraph>,
): Bounds | null {
  const yMin = Math.min(fromY, trunkY)
  const yMax = Math.max(fromY, trunkY)
  let merged: Bounds | null = null
  for (const [id, sg] of subgraphs) {
    if (exclude.has(id)) continue
    const b = sg.bounds
    if (!b) continue
    // y-band overlap with the bus's source-to-trunk corridor
    if (b.y + b.height <= yMin) continue
    if (b.y >= yMax) continue
    // x overlap with any source port column
    if (b.x + b.width <= sourceXMin) continue
    if (b.x >= sourceXMax) continue
    if (!merged) {
      merged = { x: b.x, y: b.y, width: b.width, height: b.height }
    } else {
      const left = Math.min(merged.x, b.x)
      const right = Math.max(merged.x + merged.width, b.x + b.width)
      const top = Math.min(merged.y, b.y)
      const bottom = Math.max(merged.y + merged.height, b.y + b.height)
      merged = { x: left, y: top, width: right - left, height: bottom - top }
    }
  }
  return merged
}

/**
 * Collect every subgraph that contains `nodeId` directly or
 * transitively, plus that node's parent chain. Used to mark a bus's
 * own source/target ancestors as non-obstacles — a child crossing
 * its own container is by definition not a routing problem.
 */
function collectAncestors(
  nodeId: string,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
  out: Set<string>,
): void {
  let cur: string | undefined = nodes.get(nodeId)?.parent
  while (cur) {
    if (out.has(cur)) return
    out.add(cur)
    cur = subgraphs.get(cur)?.parent
  }
}

/**
 * Detect fan-out groups and convert them to bus routes (T-shaped
 * polylines sharing a horizontal backbone). Only edges whose source
 * port sits on the `bottom` (or `top`) of its node and whose targets
 * are co-planar enough to share a single backbone Y are eligible —
 * the router prefers to leave noisy edges as Bezier rather than
 * synthesise a misleading bus.
 */
function assignBusRoutes(
  edges: Map<string, ResolvedEdge>,
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph> | undefined,
): void {
  // Group by source node + source port side. Children of the same
  // physical node naturally bus together; "side" prevents top-port
  // siblings from being lumped with bottom-port siblings (those
  // produce different fan directions).
  const groups = new Map<string, ResolvedEdge[]>()
  for (const edge of edges.values()) {
    const side = edge.fromPort.side
    if (side !== 'top' && side !== 'bottom') continue
    const key = `${edge.fromNodeId}|${side}`
    const list = groups.get(key)
    if (list) list.push(edge)
    else groups.set(key, [edge])
  }
  for (const group of groups.values()) {
    if (group.length < BUS_MIN_GROUP_SIZE) continue

    // Bus only when source and EVERY target sit in the same parent
    // container. A T-shaped backbone is the right abstraction for
    // "switch fans out to its APs inside the same room"; it's the
    // wrong abstraction for "core switch fans out to subgraphs
    // across the building" — those should render as individual
    // curves so the eye can follow each wire to its destination.
    // Mixed-parent fan-outs fall through to the bezier+lane-offset
    // path.
    const sourceNode = nodes.get(group[0]?.fromNodeId ?? '')
    const sourceParent = sourceNode?.parent ?? null
    const allSameParent = group.every((e) => {
      const targetNode = nodes.get(e.toNodeId)
      return (targetNode?.parent ?? null) === sourceParent
    })
    if (!allSameParent) continue

    const side = group[0]?.fromPort.side as 'top' | 'bottom'
    const fromY = group[0]?.fromPort.absolutePosition.y ?? 0
    const targetYs = group.map((e) => e.toPort.absolutePosition.y)
    const minTargetY = Math.min(...targetYs)
    const maxTargetY = Math.max(...targetYs)
    if (maxTargetY - minTargetY > BUS_MAX_TARGET_Y_SPREAD) continue

    // Trunk runs just before the target row (not just below the
    // source). Putting the trunk near the targets means each branch
    // is short and only the *single* source-to-trunk leg traverses
    // the rows in between; the alternative (trunk near source) gives
    // every branch its own long vertical run, each of which would
    // cross any intervening row of nodes/subgraphs separately.
    const outwardSign = side === 'bottom' ? 1 : -1
    const targetY = side === 'bottom' ? minTargetY : maxTargetY
    const trunkY =
      side === 'bottom'
        ? Math.max(fromY + BUS_TRUNK_DROP, targetY - BUS_TRUNK_DROP / 2)
        : Math.min(fromY - BUS_TRUNK_DROP, targetY + BUS_TRUNK_DROP / 2)

    // Sanity: trunk must lie between source and target on the
    // outward axis. If it doesn't (degenerate or inverted layout) we
    // refuse to bus the group.
    if ((trunkY - fromY) * outwardSign <= 0) continue
    if ((targetY - trunkY) * outwardSign <= 0) continue

    // Branch order along the trunk follows the target x ordering;
    // tie-break by edge id so the assignment is deterministic.
    const sorted = [...group].sort(
      (a, b) =>
        a.toPort.absolutePosition.x - b.toPort.absolutePosition.x || a.id.localeCompare(b.id),
    )

    const busId = `bus:${group[0]?.fromNodeId ?? 'unknown'}:${side}:${sorted[0]?.id ?? 'x'}`

    // Obstacle-aware deflection. The default bus shape drops each
    // source port straight down to the trunk; when that vertical run
    // would punch through an intervening subgraph (e.g. a row of
    // siblings sitting between the source's row and the target's
    // row), we re-shape the source-to-trunk leg as an L: jog out to
    // a corridor that runs to one side of the obstacle, then descend
    // through that corridor before joining the trunk. All branches
    // share the same corridor so the visual still reads as one bus.
    const sourceXs = sorted.map((e) => e.fromPort.absolutePosition.x)
    const sourceXMin = Math.min(...sourceXs)
    const sourceXMax = Math.max(...sourceXs)
    let corridor: { baseX: number; baseJogY: number; goLeft: boolean } | null = null
    if (subgraphs && subgraphs.size > 0) {
      const exclude = new Set<string>()
      const sourceNodeId = group[0]?.fromNodeId
      if (sourceNodeId) collectAncestors(sourceNodeId, nodes, subgraphs, exclude)
      for (const e of sorted) collectAncestors(e.toNodeId, nodes, subgraphs, exclude)
      const blocker = findBlockingObstacles(
        fromY,
        trunkY,
        sourceXMin,
        sourceXMax,
        exclude,
        subgraphs,
      )
      if (blocker) {
        const targetXs = sorted.map((e) => e.toPort.absolutePosition.x)
        const targetCentroid = targetXs.reduce((a, b) => a + b, 0) / targetXs.length
        const blockerCenter = blocker.x + blocker.width / 2
        // Pick the side that keeps the corridor on the same side as
        // the bulk of the targets — avoids the trunk doubling back
        // across the obstacle after we deflect.
        const goLeft = targetCentroid < blockerCenter
        const corridorX = goLeft
          ? blocker.x - OBSTACLE_CORRIDOR_MARGIN
          : blocker.x + blocker.width + OBSTACLE_CORRIDOR_MARGIN
        const jogY =
          side === 'bottom'
            ? blocker.y - OBSTACLE_JOG_MARGIN
            : blocker.y + blocker.height + OBSTACLE_JOG_MARGIN
        // Sanity: jog row must lie between source and obstacle on
        // the outward axis. If the source already sits past the
        // obstacle's near edge (unlikely but possible with deeply
        // nested layouts) the L-shape would invert — fall back to
        // the straight bus rather than draw a bad route.
        const jogValid = side === 'bottom' ? jogY > fromY : jogY < fromY
        if (jogValid) corridor = { baseX: corridorX, baseJogY: jogY, goLeft }
      }
    }

    const N = sorted.length
    for (const [i, edge] of sorted.entries()) {
      const source = edge.fromPort.absolutePosition
      const target = edge.toPort.absolutePosition
      let points: { x: number; y: number }[]
      if (corridor) {
        // Per-branch lanes. Lane 0 = leftmost target → corridor lane
        // *furthest* from the obstacle (outermost); lane N-1 = closest
        // target → corridor lane just outside the obstacle. The jog
        // row strides in the matching direction so each branch's
        // horizontal jog sits above the next branch's vertical
        // corridor — no two segments share coordinates, no
        // crossings between lanes.
        const corridorSign = corridor.goLeft ? -1 : 1
        const corridorX = corridor.baseX + corridorSign * (N - 1 - i) * CORRIDOR_LANE_STRIDE
        const jogY = corridor.baseJogY - outwardSign * (N - 1 - i) * JOG_LANE_STRIDE
        points = [
          { x: source.x, y: source.y },
          { x: source.x, y: jogY },
          { x: corridorX, y: jogY },
          { x: corridorX, y: trunkY },
          { x: target.x, y: trunkY },
          { x: target.x, y: target.y },
        ]
      } else {
        points = [
          { x: source.x, y: source.y },
          { x: source.x, y: trunkY },
          { x: target.x, y: trunkY },
          { x: target.x, y: target.y },
        ]
      }
      edge.route = {
        kind: 'bus',
        busId,
        branchIndex: i,
        branchCount: sorted.length,
        points,
      }
      // Bus routes already handle the per-branch fan-out; lane offset
      // on the source side would visually fight with the trunk attach
      // points, so we strip any prior assignment.
      edge.fromLateralOffset = undefined
    }
  }
}

/**
 * Assign `fromLateralOffset` / `toLateralOffset` to every edge whose
 * source or target port is shared with at least one other edge. The
 * offsets centre the fan on the port (lane indices symmetric around
 * 0) so the visual centroid is unchanged.
 */
function assignLaneOffsets(edges: Map<string, ResolvedEdge>): void {
  const fromGroups = new Map<string, ResolvedEdge[]>()
  const toGroups = new Map<string, ResolvedEdge[]>()
  for (const edge of edges.values()) {
    // Bus-routed edges already orchestrate their own per-branch
    // fan-out via the trunk; layering another lateral shift on top
    // would only fight with the polyline attach points.
    if (edge.route?.kind === 'bus') continue
    const fromList = fromGroups.get(edge.fromPortId)
    if (fromList) fromList.push(edge)
    else fromGroups.set(edge.fromPortId, [edge])
    const toList = toGroups.get(edge.toPortId)
    if (toList) toList.push(edge)
    else toGroups.set(edge.toPortId, [edge])
  }
  for (const group of fromGroups.values()) {
    if (group.length < 2) continue
    // Sort along the port's lateral axis using the peer (target)
    // position as the comparator. Lanes then fan out in the same
    // order as the targets they connect to, so no two lanes cross
    // each other inside the fan region.
    sortByLateralOrder(
      group,
      (edge) => edge.fromPort,
      (edge) => edge.toPort.absolutePosition,
    )
    const stride = pickStride(group.length)
    for (const [i, edge] of group.entries()) {
      edge.fromLateralOffset = (i - (group.length - 1) / 2) * stride
    }
  }
  for (const group of toGroups.values()) {
    if (group.length < 2) continue
    sortByLateralOrder(
      group,
      (edge) => edge.toPort,
      (edge) => edge.fromPort.absolutePosition,
    )
    const stride = pickStride(group.length)
    for (const [i, edge] of group.entries()) {
      edge.toLateralOffset = (i - (group.length - 1) / 2) * stride
    }
  }
}

/** Shrink `LANE_STRIDE` when the group is wide enough that the full fan would exceed the cap. */
function pickStride(n: number): number {
  if (n <= 1) return 0
  const halfWidth = ((n - 1) / 2) * LANE_STRIDE
  if (halfWidth <= LANE_MAX_HALF_WIDTH) return LANE_STRIDE
  return (LANE_MAX_HALF_WIDTH * 2) / (n - 1)
}

function sortByLateralOrder(
  group: ResolvedEdge[],
  portOf: (edge: ResolvedEdge) => ResolvedPort,
  peerPosOf: (edge: ResolvedEdge) => { x: number; y: number },
): void {
  // For top / bottom ports the lateral axis is x; for left / right
  // it's y. Tie-break by edge id for determinism (same peer
  // coordinate happens when two edges target ports on the same
  // node aligned along the lateral axis).
  const side = portOf(group[0] as ResolvedEdge).side
  const lateralKey: (e: ResolvedEdge) => number =
    side === 'top' || side === 'bottom' ? (e) => peerPosOf(e).x : (e) => peerPosOf(e).y
  group.sort((a, b) => lateralKey(a) - lateralKey(b) || a.id.localeCompare(b.id))
}
