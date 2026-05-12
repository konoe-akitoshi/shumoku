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
 */

import type { Link, Node } from '../models/types.js'
import { getLinkWidth } from './link-utils.js'
import type { ResolvedEdge, ResolvedPort } from './resolved-types.js'

/**
 * Options retained for API compatibility with callers passing
 * `{ direction }`. None of the values are read today — Bezier edges
 * derive direction from per-port `side` attributes already on the
 * resolved ports.
 */
export interface RouteEdgesOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL'
}

/**
 * Produce a `ResolvedEdge` for every link whose endpoints resolve to
 * known ports. Links pointing at a missing port are dropped (matches
 * the previous behaviour of libavoid-router).
 *
 * The function returns a Promise for backwards compatibility with
 * the old WASM-backed router — every existing caller already awaits
 * the result, and async-of-sync incurs zero cost.
 */
export async function routeEdges(
  _nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  links: readonly Link[],
  _options?: RouteEdgesOptions,
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
  return edges
}
