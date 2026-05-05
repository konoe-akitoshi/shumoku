// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Subgraph } from '@shumoku/core'
import type { Scene } from '../types'
import { nodesInScope } from './scope'

/**
 * Effective endpoint position in a scene: explicit placement
 * override → diagram-side Node.position fallback. Both live in the
 * same coordinate system as the scene's calibration anchor (it was
 * clicked on rendered positions), so either is valid for length math.
 */
function endpointPos(
  scene: Scene,
  nodeId: string,
  nodes: Map<string, Node>,
): { x: number; y: number } | null {
  const placement = scene.nodePlacements.find((p) => p.nodeId === nodeId)
  if (placement) return placement.position
  return nodes.get(nodeId)?.position ?? null
}

/**
 * Sum the polyline length (px) for a wire in a scene, only when
 * both endpoints are in the scene's scope. Cross-boundary wires
 * (one endpoint outside the scope subgraph) return null — a single
 * scene can't measure distances that exit it; the boundary point
 * isn't physically meaningful without explicit user marking.
 */
function polylinePx(
  scene: Scene,
  link: Link,
  nodes: Map<string, Node>,
  inScopeIds: Set<string>,
): number | null {
  if (!link.id) return null
  if (!inScopeIds.has(link.from.node)) return null
  if (!inScopeIds.has(link.to.node)) return null

  const fromPos = endpointPos(scene, link.from.node, nodes)
  const toPos = endpointPos(scene, link.to.node, nodes)
  if (!fromPos || !toPos) return null

  const route = scene.wireRoutes.find((w) => w.linkId === link.id)
  const points = [fromPos, ...(route?.controlPoints ?? []), toPos]
  let len = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!a || !b) continue
    len += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return len
}

/**
 * Effective real-world cable length for a link.
 *
 * Priority:
 *   1. Scene-derived: a calibrated scene whose scope contains BOTH
 *      endpoints. The polyline through that scene's positions ×
 *      m/px. Cross-boundary wires (one endpoint outside the scope)
 *      don't qualify — the within-scope length isn't the cable's
 *      real length, and we don't yet model the boundary exit point.
 *   2. Stored `link.cable.length_m` — manual input or imported.
 *
 * Returns `{ meters, source }` so callers can label "(from scene)"
 * vs "(manual)". Null when neither path produces a value.
 */
export function cableLengthMeters(
  link: Link,
  scenes: Scene[],
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
): { meters: number; source: 'scene' | 'stored' } | null {
  for (const scene of scenes) {
    const ratio = scene.calibration?.pxPerMeter
    if (!ratio || ratio <= 0) continue
    const inScope = new Set(
      nodesInScope(nodes.values(), subgraphs, scene.scopeSubgraphId).map((n) => n.id),
    )
    const px = polylinePx(scene, link, nodes, inScope)
    if (px === null) continue
    return { meters: px / ratio, source: 'scene' }
  }
  const stored = link.cable?.length_m
  if (stored !== undefined && Number.isFinite(stored)) {
    return { meters: stored, source: 'stored' }
  }
  return null
}
