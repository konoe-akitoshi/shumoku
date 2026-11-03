// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Point } from './metrics.js'
import { EPS, STRAIGHT } from './tolerance.js'

/** The circular arc that rounds one vertex of a polyline. */
export interface Arc {
  /** Where it leaves the run coming in, and where it joins the run going out. */
  from: Point
  to: Point
  /** The radius it is drawn with, which is less than the one asked for where a run is too short. */
  r: number
  centre: Point
  /** The angle it turns through, in radians. */
  theta: number
  /** Whether it turns clockwise on the page (y down). */
  clockwise: boolean
}

/**
 * How each vertex of a polyline is rounded, given the radius asked for at each (0 at the ends).
 * The arc is tangent to both runs, so a vertex turning through θ takes `r·tan(θ/2)` off each, at
 * most half of either run; where that does not fit, the radius is reduced to fit. A vertex that
 * is not rounded (an end, no radius, a run of no length, no turn) has no arc. This is the one
 * place a drawn corner is worked out; the renderer writes the arcs out and the layout samples them.
 */
export function arcsOf(points: readonly Point[], radii: readonly number[]): (Arc | undefined)[] {
  return points.map((v, i) => {
    const p = points[i - 1]
    const n = points[i + 1]
    const wanted = radii[i] ?? 0
    if (!p || !n || wanted <= 0) return undefined
    const lenIn = Math.hypot(v.x - p.x, v.y - p.y)
    const lenOut = Math.hypot(n.x - v.x, n.y - v.y)
    if (lenIn < EPS || lenOut < EPS) return undefined
    const din = { x: (v.x - p.x) / lenIn, y: (v.y - p.y) / lenIn }
    const dout = { x: (n.x - v.x) / lenOut, y: (n.y - v.y) / lenOut }
    const cross = din.x * dout.y - din.y * dout.x
    const theta = Math.atan2(Math.abs(cross), din.x * dout.x + din.y * dout.y)
    if (theta < STRAIGHT) return undefined
    const tanHalf = Math.tan(theta / 2)
    const t = Math.min(wanted * tanHalf, lenIn / 2, lenOut / 2)
    const r = t / tanHalf
    if (!(t > EPS) || !Number.isFinite(r)) return undefined
    const from = { x: v.x - din.x * t, y: v.y - din.y * t }
    // the centre lies on the inside of the turn, `r` off the run coming in
    const side = cross > 0 ? 1 : -1
    return {
      from,
      to: { x: v.x + dout.x * t, y: v.y + dout.y * t },
      r,
      centre: { x: from.x - din.y * r * side, y: from.y + din.x * r * side },
      theta,
      clockwise: cross > 0,
    }
  })
}
