import { LayoutInvariantError } from '../errors'
import { BOUNDARY_TOLERANCE, GEOMETRY_EPSILON } from './tolerance'
import type { Bounds, Box, HorizontalExtent, PerSide, Point, Side } from './types'
import { SIDES } from './types'

export function boundsOf(box: Box, padding = 0): Bounds {
  return {
    left: box.x - box.w / 2 - padding,
    right: box.x + box.w / 2 + padding,
    top: box.y - box.h / 2 - padding,
    bottom: box.y + box.h / 2 + padding,
  }
}

export function boxFromBounds(bounds: Bounds): Box {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    w: bounds.right - bounds.left,
    h: bounds.bottom - bounds.top,
  }
}

export function horizontalExtentOf(box: Box): HorizontalExtent {
  return { left: box.x - box.w / 2, right: box.x + box.w / 2 }
}

/** Positive when the extents share an interval; the value is the shared length. */
export function horizontalOverlap(a: HorizontalExtent, b: HorizontalExtent): number {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left)
}

/** Shared width (`x`) and height (`y`) of two boxes; a non-positive value means no overlap. */
export function overlapOf(a: Box, b: Box): Point {
  return {
    x: Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2),
    y: Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2),
  }
}

export interface IndexPair {
  /** The later index of the pair. */
  readonly first: number
  /** The earlier index of the pair (`second < first`). */
  readonly second: number
}

/** All overlapping pairs, ordered by `first` and then `second`. */
export function overlappingPairs(boxes: readonly Box[], tolerance = GEOMETRY_EPSILON): IndexPair[] {
  const pairs: IndexPair[] = []
  for (const [first, a] of boxes.entries())
    for (const [second, b] of boxes.slice(0, first).entries()) {
      const overlap = overlapOf(a, b)
      if (overlap.x > tolerance && overlap.y > tolerance) pairs.push({ first, second })
    }
  return pairs
}

export function translate<T extends Point>(item: T, dx: number, dy: number): T {
  return { ...item, x: item.x + dx, y: item.y + dy }
}

export function sideMidpoint(box: Box, side: Side): Point {
  return {
    x: box.x + (side === 'left' ? -box.w / 2 : side === 'right' ? box.w / 2 : 0),
    y: box.y + (side === 'top' ? -box.h / 2 : side === 'bottom' ? box.h / 2 : 0),
  }
}

export function isStrictlyInside(point: Point, bounds: Bounds, tolerance: number): boolean {
  return (
    point.x > bounds.left + tolerance &&
    point.x < bounds.right - tolerance &&
    point.y > bounds.top + tolerance &&
    point.y < bounds.bottom - tolerance
  )
}

export function isWithin(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  )
}

/** The side of `box` whose edge `point` lies on. Ties resolve in {@link SIDES} order. */
export function sideOfBoundaryPoint(box: Box, point: Point): Side {
  const distances: PerSide<number> = {
    left: Math.abs(point.x - (box.x - box.w / 2)),
    right: Math.abs(point.x - (box.x + box.w / 2)),
    top: Math.abs(point.y - (box.y - box.h / 2)),
    bottom: Math.abs(point.y - (box.y + box.h / 2)),
  }
  let nearest: Side = 'left'
  for (const side of SIDES) if (distances[side] < distances[nearest]) nearest = side
  if (distances[nearest] > BOUNDARY_TOLERANCE)
    throw new LayoutInvariantError('Endpoint does not lie on the node outline')
  return nearest
}
