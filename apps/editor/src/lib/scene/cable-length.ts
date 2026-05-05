// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link } from '@shumoku/core'
import type { Scene } from '../types'

/**
 * Sum the polyline length (px) for a wire in a scene: from →
 * waypoints → to. wireRoute is optional — without one we just take
 * the straight line between the placed endpoints. Returns null only
 * when an endpoint has no scene placement (no anchor for length
 * math; off-canvas tray / diagram coords aren't meaningful BOM
 * values).
 */
function polylinePx(scene: Scene, link: Link): number | null {
  if (!link.id) return null
  const fromPlacement = scene.nodePlacements.find((p) => p.nodeId === link.from.node)
  const toPlacement = scene.nodePlacements.find((p) => p.nodeId === link.to.node)
  if (!fromPlacement || !toPlacement) return null

  const route = scene.wireRoutes.find((w) => w.linkId === link.id)
  const points = [fromPlacement.position, ...(route?.controlPoints ?? []), toPlacement.position]
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
 *   1. Scene-derived (a calibrated scene contains a route for this
 *      link with both endpoints placed) — the polyline run × m/px.
 *   2. Stored `link.cable.length_m` — manual input or imported value.
 *
 * Returns `{ meters, source }` so callers can label "(from scene)" /
 * "(manual)" or hide the editor when scene-derived. `null` when
 * neither is available.
 */
export function cableLengthMeters(
  link: Link,
  scenes: Scene[],
): { meters: number; source: 'scene' | 'stored' } | null {
  for (const scene of scenes) {
    const ratio = scene.calibration?.pxPerMeter
    if (!ratio || ratio <= 0) continue
    const px = polylinePx(scene, link)
    if (px === null) continue
    return { meters: px / ratio, source: 'scene' }
  }
  const stored = link.cable?.length_m
  if (stored !== undefined && Number.isFinite(stored)) {
    return { meters: stored, source: 'stored' }
  }
  return null
}
