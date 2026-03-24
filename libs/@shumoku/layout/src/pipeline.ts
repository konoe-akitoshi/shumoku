// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout Pipeline
 *
 * Combines a PlacementEngine and a RoutingEngine into a single
 * layout pass that produces a complete LayoutResult.
 *
 * Usage:
 *   const pipeline = new LayoutPipeline(
 *     new ElkPlacement(),
 *     new OrthogonalRouter(),
 *   )
 *   const result = await pipeline.layout(graph)
 */

import type { LinkEndpoint, NetworkGraph } from '@shumoku/core'
import type {
  EdgeToRoute,
  LayoutResult,
  Obstacle,
  PlacedNode,
  PlacementEngine,
  PlacementOptions,
  RoutingEngine,
  RoutingOptions,
  RoutingStrategy,
} from './types.js'
import { createRouter } from './routing/index.js'

export interface LayoutPipelineOptions {
  placement?: PlacementOptions
  routing?: Partial<RoutingOptions>
}

export class LayoutPipeline {
  constructor(
    private placementEngine: PlacementEngine,
    private routingEngine: RoutingEngine,
  ) {}

  async layout(
    graph: NetworkGraph,
    options?: LayoutPipelineOptions,
  ): Promise<LayoutResult> {
    // Phase 1: Placement
    const placement = await this.placementEngine.place(graph, options?.placement)

    // Phase 2: Build edges and obstacles from placement
    const obstacles = this.buildObstacles(placement.nodes)
    const edges = this.buildEdges(graph, placement.nodes)

    // Phase 3: Routing
    const routing = this.routingEngine.route(edges, obstacles, options?.routing)

    // Combine
    return {
      nodes: placement.nodes,
      links: routing.edges,
      subgraphs: placement.subgraphs,
      bounds: placement.bounds,
      metadata: {
        placement: placement.metadata,
        routing: routing.metadata,
      },
    }
  }

  /** Re-route only, using existing node positions. Fast path for interactive use. */
  reroute(
    graph: NetworkGraph,
    nodes: Map<string, PlacedNode>,
    options?: Partial<RoutingOptions>,
  ): LayoutResult['links'] {
    const obstacles = this.buildObstacles(nodes)
    const edges = this.buildEdges(graph, nodes)
    const routing = this.routingEngine.route(edges, obstacles, options)
    return routing.edges
  }

  /** Re-route specific links only. Fastest path for drag operations. */
  rerouteSubset(
    links: NetworkGraph['links'],
    nodes: Map<string, PlacedNode>,
    options?: Partial<RoutingOptions>,
  ): LayoutResult['links'] {
    const obstacles = this.buildObstacles(nodes)
    const edges = this.buildEdgesFromLinks(links, nodes)
    const routing = this.routingEngine.route(edges, obstacles, options)
    return routing.edges
  }

  /** Switch routing strategy without re-placing nodes */
  withRouter(router: RoutingEngine): LayoutPipeline {
    return new LayoutPipeline(this.placementEngine, router)
  }

  /** Switch routing strategy by name */
  withStrategy(strategy: RoutingStrategy): LayoutPipeline {
    return new LayoutPipeline(this.placementEngine, createRouter(strategy))
  }

  private buildObstacles(nodes: Map<string, PlacedNode>): Obstacle[] {
    const obstacles: Obstacle[] = []
    for (const node of nodes.values()) {
      obstacles.push({
        x: node.position.x - node.size.width / 2,
        y: node.position.y - node.size.height / 2,
        width: node.size.width,
        height: node.size.height,
      })
    }
    return obstacles
  }

  private buildEdges(
    graph: NetworkGraph,
    nodes: Map<string, PlacedNode>,
  ): EdgeToRoute[] {
    return this.buildEdgesFromLinks(graph.links, nodes)
  }

  private buildEdgesFromLinks(
    links: NetworkGraph['links'],
    nodes: Map<string, PlacedNode>,
  ): EdgeToRoute[] {
    const edges: EdgeToRoute[] = []

    for (const [index, link] of links.entries()) {
      const fromEndpoint = toEndpoint(link.from)
      const toEndpoint_ = toEndpoint(link.to)

      const fromNode = nodes.get(fromEndpoint.node)
      const toNode = nodes.get(toEndpoint_.node)
      if (!fromNode || !toNode) continue

      // Resolve port positions or use node boundary
      const source = this.resolvePortPosition(fromNode, fromEndpoint, 'bottom')
      const target = this.resolvePortPosition(toNode, toEndpoint_, 'top')

      edges.push({
        id: link.id || `edge-${index}`,
        source,
        target,
        link,
        fromEndpoint,
        toEndpoint: toEndpoint_,
      })
    }

    return edges
  }

  private resolvePortPosition(
    node: PlacedNode,
    endpoint: LinkEndpoint,
    defaultSide: 'top' | 'bottom',
  ): { x: number; y: number } {
    // Try to find the port
    if (endpoint.port) {
      const portKey = `${endpoint.node}:${endpoint.port}`
      const port = node.ports.get(portKey)
      if (port) return port.position
    }

    // Default to node boundary center
    if (defaultSide === 'top') {
      return { x: node.position.x, y: node.position.y - node.size.height / 2 }
    }
    return { x: node.position.x, y: node.position.y + node.size.height / 2 }
  }
}

function toEndpoint(endpoint: string | LinkEndpoint): LinkEndpoint {
  if (typeof endpoint === 'string') return { node: endpoint }
  if ('pin' in endpoint && endpoint.pin) {
    return { node: endpoint.node, port: endpoint.pin, ip: endpoint.ip }
  }
  return endpoint
}
