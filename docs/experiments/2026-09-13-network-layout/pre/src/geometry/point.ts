import { itemAt } from '../utils/collections'
import { GEOMETRY_EPSILON } from './tolerance'
import type { Point } from './types'

/** Copies only the coordinates, dropping any extra properties of a point-like value. */
export function toPoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

export function samePoint(a: Point, b: Point, tolerance = GEOMETRY_EPSILON): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < tolerance
}

/** Drops every point that repeats its predecessor in the input sequence. */
export function withoutRepeatedPoints(
  points: readonly Point[],
  tolerance = GEOMETRY_EPSILON,
): Point[] {
  return points.filter(
    (point, index) => index === 0 || !samePoint(point, itemAt(points, index - 1), tolerance),
  )
}
