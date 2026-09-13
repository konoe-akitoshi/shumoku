import { GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Box, Point } from '../geometry/types'
import type { LayoutModel } from '../model'
import type { Route } from '../state'
import { itemAt } from '../utils/collections'

export interface LineAvoidance {
  /** Link/device pairs where a wire enters an unrelated device. */
  readonly hits: number
  /** Link/device pairs where a wire comes closer than the clearance. */
  readonly nearPairs: number
  /** Sum of squared clearance penetration depths. */
  readonly penalty: number
}

/** Separating-axis penetration depth of a segment into a (padded) box; 0 when they are apart. */
export function segmentPenetration(start: Point, end: Point, box: Box, padding = 0): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-9) return 0
  const centerX = (start.x + end.x) / 2
  const centerY = (start.y + end.y) / 2
  const axes: readonly (readonly [number, number])[] = [
    [1, 0],
    [0, 1],
    [-dy / length, dx / length],
  ]
  let depth = Number.POSITIVE_INFINITY
  for (const [axisX, axisY] of axes) {
    const halfExtent =
      Math.abs(axisX) * (box.w / 2 + padding) +
      Math.abs(axisY) * (box.h / 2 + padding) +
      Math.abs(dx * axisX + dy * axisY) / 2
    const overlap = halfExtent - Math.abs((box.x - centerX) * axisX + (box.y - centerY) * axisY)
    if (overlap <= GEOMETRY_EPSILON) return 0
    depth = Math.min(depth, overlap)
  }
  return depth
}

/** Checks every wire against every device that is not one of its own endpoints. */
export function measureLineAvoidance(
  model: LayoutModel,
  nodes: readonly Box[],
  routes: readonly Route[],
  clearance: number,
): LineAvoidance {
  let hits = 0
  let nearPairs = 0
  let penalty = 0
  for (const [nodeIndex, node] of nodes.entries())
    for (const [linkIndex, link] of model.links.entries()) {
      if (nodeIndex === link.source || nodeIndex === link.target) continue
      const points = itemAt(routes, linkIndex).points
      let actual = 0
      let padded = 0
      for (const [pointIndex, end] of points.entries()) {
        if (pointIndex === 0) continue
        const start = itemAt(points, pointIndex - 1)
        const farApart =
          Math.max(start.x, end.x) < node.x - node.w / 2 - clearance ||
          Math.min(start.x, end.x) > node.x + node.w / 2 + clearance ||
          Math.max(start.y, end.y) < node.y - node.h / 2 - clearance ||
          Math.min(start.y, end.y) > node.y + node.h / 2 + clearance
        if (farApart) continue
        actual = Math.max(actual, segmentPenetration(start, end, node))
        padded = Math.max(padded, segmentPenetration(start, end, node, clearance))
      }
      if (actual > 0) hits += 1
      if (padded > 0) {
        nearPairs += 1
        penalty += padded * padded
      }
    }
  return { hits, nearPairs, penalty }
}
