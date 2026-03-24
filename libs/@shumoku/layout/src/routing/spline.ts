// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Spline routing engine
 *
 * First routes orthogonally (obstacle avoidance), then smooths
 * the path into cubic bezier curves using Catmull-Rom interpolation.
 *
 * This gives curves that:
 *   - Avoid obstacles (orthogonal routing handles this)
 *   - Look smooth and natural
 *   - Pass through all control points
 */

import type { Position } from '@shumoku/core'
import type {
  EdgeToRoute,
  Obstacle,
  RoutedEdge,
  RoutingEngine,
  RoutingOptions,
  RoutingResult,
} from '../types.js'
import { OrthogonalRouter } from './orthogonal.js'

/**
 * Convert a set of points to a smooth curve using Catmull-Rom spline.
 * Returns a denser set of interpolated points.
 */
function catmullRomSmooth(points: Position[], tension: number, segments = 8): Position[] {
  if (points.length <= 2) return points

  const result: Position[] = [points[0]]

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    for (let t = 1; t <= segments; t++) {
      const s = t / segments
      const s2 = s * s
      const s3 = s2 * s

      const alpha = tension

      const x =
        0.5 *
        ((2 * p1.x) +
          (-p0.x + p2.x) * s * alpha +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 * alpha +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3 * alpha)

      const y =
        0.5 *
        ((2 * p1.y) +
          (-p0.y + p2.y) * s * alpha +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 * alpha +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3 * alpha)

      result.push({ x, y })
    }
  }

  // Ensure exact start and end points are preserved
  result[0] = points[0]
  result[result.length - 1] = points[points.length - 1]

  return result
}

export class SplineRouter implements RoutingEngine {
  private orthogonal = new OrthogonalRouter()

  route(
    edges: EdgeToRoute[],
    obstacles: Obstacle[],
    options?: Partial<RoutingOptions>,
  ): RoutingResult {
    const start = performance.now()
    const tension = options?.splineTension ?? 0.5

    // First get orthogonal routes for obstacle avoidance
    const orthoResult = this.orthogonal.route(edges, obstacles, options)

    // Then smooth each path
    const result = new Map<string, RoutedEdge>()

    for (const [id, edge] of orthoResult.edges) {
      const smoothed = catmullRomSmooth(edge.points, tension)

      result.set(id, {
        ...edge,
        points: smoothed,
      })
    }

    return {
      edges: result,
      metadata: {
        strategy: 'spline',
        duration: performance.now() - start,
      },
    }
  }
}
