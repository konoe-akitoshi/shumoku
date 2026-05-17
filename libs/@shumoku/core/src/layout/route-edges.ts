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
 */

import type { Link, Node } from '../models/types.js'
import { getLinkWidth } from './link-utils.js'
import type { ResolvedEdge, ResolvedPort } from './resolved-types.js'

/** Centre-to-centre spacing between adjacent lanes, in SVG units. */
const LANE_STRIDE = 8
/** Hard cap on the half-width of the fan; beyond this we accept some overlap rather than spreading edges off the node footprint. */
const LANE_MAX_HALF_WIDTH = 28

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
  assignLaneOffsets(edges)
  return edges
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
