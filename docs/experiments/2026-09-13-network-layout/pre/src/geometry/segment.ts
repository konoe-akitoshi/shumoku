import { GEOMETRY_EPSILON } from './tolerance'
import type { Bounds, Point } from './types'

/**
 * True when segment `a`–`b` passes through the open interior of `bounds`.
 * Running along or touching an edge is allowed (Liang–Barsky clipping on a slightly shrunken box).
 */
export function segmentEntersInterior(a: Point, b: Point, bounds: Bounds): boolean {
  let enter = 0
  let exit = 1
  const axes = [
    {
      origin: a.x,
      delta: b.x - a.x,
      min: bounds.left + GEOMETRY_EPSILON,
      max: bounds.right - GEOMETRY_EPSILON,
    },
    {
      origin: a.y,
      delta: b.y - a.y,
      min: bounds.top + GEOMETRY_EPSILON,
      max: bounds.bottom - GEOMETRY_EPSILON,
    },
  ]
  for (const { origin, delta, min, max } of axes) {
    if (Math.abs(delta) < 1e-12) {
      if (origin <= min || origin >= max) return false
    } else {
      const atMin = (min - origin) / delta
      const atMax = (max - origin) / delta
      enter = Math.max(enter, Math.min(atMin, atMax))
      exit = Math.min(exit, Math.max(atMin, atMax))
      if (enter >= exit) return false
    }
  }
  return enter < exit && exit > 0 && enter < 1
}

/** Twice the signed area of the triangle `a`, `b`, `c`. Zero when the points are collinear. */
export function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}
