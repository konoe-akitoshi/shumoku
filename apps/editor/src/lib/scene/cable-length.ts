// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node } from '@shumoku/core'
import type { Scene } from '../types'

/**
 * Effective endpoint position in a scene: explicit placement
 * override → diagram-side Node.position fallback. Both are in the
 * same coordinate system as the scene's calibration (the
 * calibration was clicked on rendered positions, whatever those
 * were), so either is a valid anchor for length math.
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
 * Sum the polyline length (px) for a wire in a scene: from →
 * waypoints → to. Returns null only when an endpoint has no
 * resolvable position at all (orphan link).
 */
function polylinePx(scene: Scene, link: Link, nodes: Map<string, Node>): number | null {
  if (!link.id) return null
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
 *   1. Scene-derived: any calibrated scene where both endpoints
 *      have a position (placement override or diagram fallback)
 *      and pxPerMeter is set — polyline px × m/px.
 *   2. Stored `link.cable.length_m` — manual input or imported.
 *
 * The scene-derived path doesn't require explicit nodePlacements
 * — the calibration was clicked on rendered positions in the
 * scene's coordinate system, and Node.position lives in the same
 * system, so it's a valid anchor. Manual placements just override.
 *
 * Returns `{ meters, source }` so callers can label "(from scene)"
 * vs "(manual)". Null when neither path produces a value.
 */
export function cableLengthMeters(
  link: Link,
  scenes: Scene[],
  nodes: Map<string, Node>,
): { meters: number; source: 'scene' | 'stored' } | null {
  for (const scene of scenes) {
    const ratio = scene.calibration?.pxPerMeter
    if (!ratio || ratio <= 0) continue
    const px = polylinePx(scene, link, nodes)
    if (px === null) continue
    return { meters: px / ratio, source: 'scene' }
  }
  const stored = link.cable?.length_m
  if (stored !== undefined && Number.isFinite(stored)) {
    return { meters: stored, source: 'stored' }
  }
  return null
}
