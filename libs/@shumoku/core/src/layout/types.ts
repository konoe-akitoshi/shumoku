// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout engine interfaces and types
 *
 * Separates node placement from edge routing, enabling independent replacement
 * of each concern (e.g., ELK for placement, libavoid for routing).
 */

import type {
  Bounds,
  LayoutLink,
  LayoutNode,
  LayoutPort,
  LayoutResult,
  LayoutSubgraph,
  Link,
  LinkEndpoint,
  NetworkGraph,
  Position,
  Size,
  Subgraph,
} from '../models/types.js'

// ============================================================================
// Node Placement
// ============================================================================

/** Positioned node with size, ports, and original node data */
export interface PositionedNode {
  id: string
  position: Position
  size: Size
  ports: Map<string, LayoutPort>
}

/** Positioned subgraph with bounds */
export interface PositionedSubgraph {
  id: string
  bounds: Bounds
  subgraph: Subgraph
  ports?: Map<string, LayoutPort>
}

/** Result of node placement (no edge routing) */
export interface NodePlacementResult {
  nodes: Map<string, PositionedNode>
  subgraphs: Map<string, PositionedSubgraph>
  bounds: Bounds
}

/** Options for node placement */
export interface PlacementOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL'
  nodeSpacing?: number
  rankSpacing?: number
  subgraphPadding?: number
  iconDimensions?: Map<string, { width: number; height: number }>
}

/** Engine that positions nodes without routing edges */
export interface NodePlacementEngine {
  place(graph: NetworkGraph, options?: PlacementOptions): Promise<NodePlacementResult>
}

// ============================================================================
// Edge Routing
// ============================================================================

/** Routed edge with point sequence */
export interface RoutedEdge {
  id: string
  from: string
  to: string
  fromEndpoint: LinkEndpoint
  toEndpoint: LinkEndpoint
  points: Position[]
  link: Link
}

/** Result of edge routing */
export interface EdgeRoutingResult {
  edges: Map<string, RoutedEdge>
}

/** Options for edge routing */
export interface RoutingOptions {
  edgeStyle?: 'orthogonal' | 'polyline' | 'straight'
  shapeBufferDistance?: number
  idealNudgingDistance?: number
  nudgeConnectedSegments?: boolean
}

/** Engine that routes edges given fixed node positions */
export interface EdgeRoutingEngine {
  route(
    placement: NodePlacementResult,
    links: Link[],
    options?: RoutingOptions,
  ): Promise<EdgeRoutingResult>
}

// ============================================================================
// Composition
// ============================================================================

/**
 * Compose a LayoutResult from separate placement and routing results.
 * This is the bridge between the new split interface and the existing
 * renderer which expects a unified LayoutResult.
 */
export function composeLayoutResult(
  graph: NetworkGraph,
  placement: NodePlacementResult,
  routing: EdgeRoutingResult,
  metadata?: LayoutResult['metadata'],
): LayoutResult {
  // Convert PositionedNode → LayoutNode
  const nodes = new Map<string, LayoutNode>()
  for (const [id, pn] of placement.nodes) {
    const originalNode = graph.nodes.find((n) => n.id === id)
    if (!originalNode) continue
    nodes.set(id, {
      id,
      position: pn.position,
      size: pn.size,
      node: originalNode,
      ports: pn.ports.size > 0 ? pn.ports : undefined,
    })
  }

  // Convert RoutedEdge → LayoutLink
  const links = new Map<string, LayoutLink>()
  for (const [id, re] of routing.edges) {
    links.set(id, {
      id,
      from: re.from,
      to: re.to,
      fromEndpoint: re.fromEndpoint,
      toEndpoint: re.toEndpoint,
      points: re.points,
      link: re.link,
    })
  }

  // Convert PositionedSubgraph → LayoutSubgraph
  const subgraphs = new Map<string, LayoutSubgraph>()
  for (const [id, ps] of placement.subgraphs) {
    subgraphs.set(id, {
      id,
      bounds: ps.bounds,
      subgraph: ps.subgraph,
      ports: ps.ports,
    })
  }

  return {
    nodes,
    links,
    subgraphs,
    bounds: placement.bounds,
    metadata,
  }
}

/**
 * Decompose an existing LayoutResult into placement + routing results.
 * Used for migration: allows existing HierarchicalLayout output to be
 * consumed through the new split interface.
 */
export function decomposeLayoutResult(result: LayoutResult): {
  placement: NodePlacementResult
  routing: EdgeRoutingResult
} {
  const nodes = new Map<string, PositionedNode>()
  for (const [id, ln] of result.nodes) {
    nodes.set(id, {
      id,
      position: ln.position,
      size: ln.size,
      ports: ln.ports ?? new Map(),
    })
  }

  const subgraphs = new Map<string, PositionedSubgraph>()
  for (const [id, ls] of result.subgraphs) {
    subgraphs.set(id, {
      id,
      bounds: ls.bounds,
      subgraph: ls.subgraph,
      ports: ls.ports,
    })
  }

  const edges = new Map<string, RoutedEdge>()
  for (const [id, ll] of result.links) {
    edges.set(id, {
      id,
      from: ll.from,
      to: ll.to,
      fromEndpoint: ll.fromEndpoint,
      toEndpoint: ll.toEndpoint,
      points: ll.points,
      link: ll.link,
    })
  }

  return {
    placement: {
      nodes,
      subgraphs,
      bounds: result.bounds,
    },
    routing: { edges },
  }
}
