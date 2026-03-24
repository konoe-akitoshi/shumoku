// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Straight-line routing engine
 *
 * Draws direct lines from source to target.
 * No obstacle avoidance - simplest possible routing.
 */

import type {
  EdgeToRoute,
  Obstacle,
  RoutedEdge,
  RoutingEngine,
  RoutingOptions,
  RoutingResult,
} from '../types.js'

export class StraightRouter implements RoutingEngine {
  route(
    edges: EdgeToRoute[],
    _obstacles: Obstacle[],
    _options?: Partial<RoutingOptions>,
  ): RoutingResult {
    const start = performance.now()
    const result = new Map<string, RoutedEdge>()

    for (const edge of edges) {
      result.set(edge.id, {
        id: edge.id,
        from: edge.fromEndpoint.node,
        to: edge.toEndpoint.node,
        fromEndpoint: edge.fromEndpoint,
        toEndpoint: edge.toEndpoint,
        sourcePort: edge.source,
        targetPort: edge.target,
        points: [edge.source, edge.target],
        link: edge.link,
      })
    }

    return {
      edges: result,
      metadata: {
        strategy: 'straight',
        duration: performance.now() - start,
      },
    }
  }
}
