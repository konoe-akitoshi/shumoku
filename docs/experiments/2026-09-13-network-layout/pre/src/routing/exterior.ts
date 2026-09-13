import { LayoutError } from '../errors'
import { boundsOf, isStrictlyInside } from '../geometry/box'
import { toPoint } from '../geometry/point'
import { segmentEntersInterior } from '../geometry/segment'
import type { WeightedNeighbor } from '../geometry/shortest-path'
import { shortestPathIndices } from '../geometry/shortest-path'
import { GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Box, Point } from '../geometry/types'
import { linkEndKey } from '../model'
import { itemAt, mapValue, range } from '../utils/collections'
import type { BoundaryTerminal } from './boundary-terminals'

/** Returns the path between a cross-group link's two terminals, starting at its source terminal. */
export type ExteriorRouter = (link: number) => Point[]

/**
 * Shortest paths between boundary terminals that never cross a frame interior (touching frames is
 * allowed). A direct segment is used whenever it is clear; otherwise the path bends at frame corners.
 * The visibility graph is built once and shared by all links.
 */
export function createExteriorRouter(
  frames: readonly Box[],
  terminals: readonly BoundaryTerminal[],
): ExteriorRouter {
  const obstacles = frames.map((frame) => boundsOf(frame))
  const isBlocked = (a: Point, b: Point) =>
    obstacles.some((obstacle) => segmentEntersInterior(a, b, obstacle))
  const corners = obstacles
    .flatMap((bounds) => [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
      { x: bounds.left, y: bounds.bottom },
    ])
    .filter(
      (corner) =>
        !obstacles.some((obstacle) => isStrictlyInside(corner, obstacle, GEOMETRY_EPSILON)),
    )
  const waypoints = [...corners, ...terminals.map(toPoint)]
  const waypointOfTerminal = new Map(
    terminals.map((terminal, index) => [
      linkEndKey(terminal.link, terminal.end),
      corners.length + index,
    ]),
  )

  const neighbors: WeightedNeighbor[][] = waypoints.map(() => [])
  for (const [index, a] of waypoints.entries())
    for (const other of range(index)) {
      const b = itemAt(waypoints, other)
      if (isBlocked(a, b)) continue
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      itemAt(neighbors, index).push({ index: other, distance })
      itemAt(neighbors, other).push({ index, distance })
    }

  return (link) => {
    const start = mapValue(waypointOfTerminal, linkEndKey(link, 'source'))
    const end = mapValue(waypointOfTerminal, linkEndKey(link, 'target'))
    const from = itemAt(waypoints, start)
    const to = itemAt(waypoints, end)
    if (!isBlocked(from, to)) return [from, to]
    const path = shortestPathIndices(waypoints.length, start, end, (vertex) =>
      itemAt(neighbors, vertex),
    )
    if (path === null) throw new LayoutError('No exterior route between group frames')
    return path.map((vertex) => itemAt(waypoints, vertex))
  }
}
