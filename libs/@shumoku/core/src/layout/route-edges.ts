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

import type { Link, Node } from '../models/types.js'
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
  _nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  links: readonly Link[],
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
  assignBusRoutes(edges)
  assignLaneOffsets(edges)
  return edges
}

/**
 * Detect fan-out groups and convert them to bus routes (T-shaped
 * polylines sharing a horizontal backbone). Only edges whose source
 * port sits on the `bottom` (or `top`) of its node and whose targets
 * are co-planar enough to share a single backbone Y are eligible —
 * the router prefers to leave noisy edges as Bezier rather than
 * synthesise a misleading bus.
 */
function assignBusRoutes(edges: Map<string, ResolvedEdge>): void {
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

    const side = group[0]?.fromPort.side as 'top' | 'bottom'
    const fromY = group[0]?.fromPort.absolutePosition.y ?? 0
    const targetYs = group.map((e) => e.toPort.absolutePosition.y)
    const minTargetY = Math.min(...targetYs)
    const maxTargetY = Math.max(...targetYs)
    if (maxTargetY - minTargetY > BUS_MAX_TARGET_Y_SPREAD) continue

    // For bottom-side fan-out the trunk runs below the source, just
    // above the target row. For top-side fan-out the trunk runs above
    // the source. The drop direction is the port's outward normal.
    const outwardSign = side === 'bottom' ? 1 : -1
    const targetY = side === 'bottom' ? minTargetY : maxTargetY
    const trunkY =
      side === 'bottom'
        ? Math.min(fromY + BUS_TRUNK_DROP, targetY - BUS_TRUNK_DROP / 2)
        : Math.max(fromY - BUS_TRUNK_DROP, targetY + BUS_TRUNK_DROP / 2)

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
    for (const [i, edge] of sorted.entries()) {
      const source = edge.fromPort.absolutePosition
      const target = edge.toPort.absolutePosition
      edge.route = {
        kind: 'bus',
        busId,
        branchIndex: i,
        branchCount: sorted.length,
        points: [
          { x: source.x, y: source.y },
          { x: source.x, y: trunkY },
          { x: target.x, y: trunkY },
          { x: target.x, y: target.y },
        ],
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
