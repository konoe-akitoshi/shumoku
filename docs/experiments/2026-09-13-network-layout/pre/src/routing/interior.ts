import { LayoutError } from '../errors'
import { boundsOf, isStrictlyInside, isWithin } from '../geometry/box'
import { withoutRepeatedPoints } from '../geometry/point'
import { segmentEntersInterior } from '../geometry/segment'
import type { WeightedNeighbor } from '../geometry/shortest-path'
import { shortestPathIndices } from '../geometry/shortest-path'
import { GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Bounds, Box, Point } from '../geometry/types'
import { firstItem, itemAt } from '../utils/collections'

/**
 * Obstacles for routing inside a group: every member device, grown by `clearance` unless it is one of
 * the link's own endpoints (`owners`), which the wire must be able to touch.
 */
export function memberObstacles(
  nodes: readonly Box[],
  members: readonly number[],
  owners: ReadonlySet<number>,
  clearance: number,
): Bounds[] {
  return members.map((member) =>
    boundsOf(itemAt(nodes, member), owners.has(member) ? 0 : clearance),
  )
}

/** Shortest obstacle-avoiding path from `from` to `to`, bending only at obstacle corners inside `frame`. */
export function interiorRoute(
  from: Point,
  to: Point,
  obstacles: readonly Bounds[],
  frame: Box,
): Point[] {
  const isBlocked = (a: Point, b: Point) =>
    obstacles.some((obstacle) => segmentEntersInterior(a, b, obstacle))
  if (!isBlocked(from, to)) return [from, to]

  const frameBounds = boundsOf(frame)
  const corners = obstacles
    .flatMap((bounds) => [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.top },
      { x: bounds.left, y: bounds.bottom },
      { x: bounds.right, y: bounds.bottom },
    ])
    .filter(
      (corner) =>
        isWithin(corner, frameBounds) &&
        !obstacles.some((obstacle) => isStrictlyInside(corner, obstacle, GEOMETRY_EPSILON)),
    )
  const vertices = [from, to, ...corners]
  function* visibleNeighbors(vertex: number): Generator<WeightedNeighbor> {
    const a = itemAt(vertices, vertex)
    for (const [index, b] of vertices.entries())
      if (index !== vertex && !isBlocked(a, b))
        yield { index, distance: Math.hypot(a.x - b.x, a.y - b.y) }
  }
  const path = shortestPathIndices(vertices.length, 0, 1, visibleNeighbors)
  if (path === null) throw new LayoutError('No interior route inside the group frame')
  return path.map((vertex) => itemAt(vertices, vertex))
}

/** Visits mandatory waypoints in order, detouring around obstacles between consecutive ones. */
export function routeThroughWaypoints(
  waypoints: readonly Point[],
  obstacles: readonly Bounds[],
  frame: Box,
  mergeTolerance: number,
): Point[] {
  const points: Point[] = [firstItem(waypoints)]
  for (const [index, waypoint] of waypoints.entries())
    if (index > 0)
      points.push(
        ...interiorRoute(itemAt(waypoints, index - 1), waypoint, obstacles, frame).slice(1),
      )
  return withoutRepeatedPoints(points, mergeTolerance)
}
