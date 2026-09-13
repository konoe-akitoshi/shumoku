import { orientation } from '../geometry/segment'
import { GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Point } from '../geometry/types'
import type { Route } from '../state'
import { itemAt } from '../utils/collections'

export interface WireMetrics {
  /** Link pairs with at least one proper crossing (touching at endpoints does not count). */
  readonly crossings: number
  /** Collinear shared length, summed over segment pairs of different links. */
  readonly overlapLength: number
  /** Total drawn wire length. */
  readonly length: number
}

interface Segment {
  readonly link: number
  readonly start: Point
  readonly end: Point
  readonly length: number
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
}

export function measureWires(routes: readonly Route[]): WireMetrics {
  let length = 0
  const segments: Segment[] = []
  for (const [link, route] of routes.entries())
    for (const [index, end] of route.points.entries()) {
      if (index === 0) continue
      const start = itemAt(route.points, index - 1)
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y)
      length += segmentLength
      if (segmentLength > 1e-9)
        segments.push({
          link,
          start,
          end,
          length: segmentLength,
          minX: Math.min(start.x, end.x),
          maxX: Math.max(start.x, end.x),
          minY: Math.min(start.y, end.y),
          maxY: Math.max(start.y, end.y),
        })
    }

  segments.sort((a, b) => a.minX - b.minX)
  const crossingPairs = new Set<string>()
  let overlapLength = 0
  for (const [index, s] of segments.entries())
    for (const t of segments.slice(index + 1)) {
      if (t.minX > s.maxX + GEOMETRY_EPSILON) break
      if (s.link === t.link) continue
      if (t.minY > s.maxY + GEOMETRY_EPSILON || t.maxY < s.minY - GEOMETRY_EPSILON) continue
      const startSide = orientation(s.start, s.end, t.start)
      const endSide = orientation(s.start, s.end, t.end)
      const properCrossing =
        startSide * endSide < -GEOMETRY_EPSILON &&
        orientation(t.start, t.end, s.start) * orientation(t.start, t.end, s.end) <
          -GEOMETRY_EPSILON
      if (properCrossing)
        crossingPairs.add(`${Math.min(s.link, t.link)}:${Math.max(s.link, t.link)}`)
      if (Math.abs(startSide) > GEOMETRY_EPSILON || Math.abs(endSide) > GEOMETRY_EPSILON) continue
      overlapLength += collinearOverlap(s, t)
    }
  return { crossings: crossingPairs.size, overlapLength, length }
}

function collinearOverlap(s: Segment, t: Segment): number {
  const unitX = (s.end.x - s.start.x) / s.length
  const unitY = (s.end.y - s.start.y) / s.length
  const tStart = (t.start.x - s.start.x) * unitX + (t.start.y - s.start.y) * unitY
  const tEnd = (t.end.x - s.start.x) * unitX + (t.end.y - s.start.y) * unitY
  return Math.max(
    0,
    Math.min(s.length, Math.max(tStart, tEnd)) - Math.max(0, Math.min(tStart, tEnd)),
  )
}
