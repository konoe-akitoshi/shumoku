// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node, Subgraph } from '@shumoku/core'
import type { Scene } from '../types'
import { nodesInScope } from './scope'

/**
 * Endpoint position in a scene. Order:
 *   1. explicit placement (user dragged the pin somewhere)
 *   2. Node.position (diagram-side auto-layout) — only as a
 *      fallback for in-scope nodes; out-of-scope nodes' diagram
 *      positions are unrelated to the scene's coordinate system.
 *
 * For an out-of-scope endpoint without an explicit placement, the
 * scene can't physically measure where the cable goes, so we return
 * null (no scene-derived length until the user places the pin).
 */
function endpointPos(
  scene: Scene,
  nodeId: string,
  nodes: Map<string, Node>,
  inScope: Set<string>,
): { x: number; y: number } | null {
  const placement = scene.nodePlacements.find((p) => p.nodeId === nodeId)
  if (placement) return placement.position
  if (inScope.has(nodeId)) return nodes.get(nodeId)?.position ?? null
  return null
}

function polylinePx(
  scene: Scene,
  link: Link,
  nodes: Map<string, Node>,
  inScope: Set<string>,
): number | null {
  if (!link.id) return null
  const fromPos = endpointPos(scene, link.from.node, nodes, inScope)
  const toPos = endpointPos(scene, link.to.node, nodes, inScope)
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
 *   1. Scene-derived: a calibrated scene where both endpoints have
 *      a usable position — placement (any node) or Node.position
 *      fallback (in-scope nodes only). For an out-of-scope endpoint
 *      (cross-boundary wire), the user must explicitly place the
 *      pin in this scene before length computes.
 *   2. Stored `link.cable.length_m`.
 *
 * Returns `{ meters, source }`; null when neither qualifies.
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
