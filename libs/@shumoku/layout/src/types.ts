// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/layout - Core types
 *
 * Layout is split into two independent phases:
 *   1. Placement: decides where nodes go (x, y, width, height)
 *   2. Routing: decides how edges connect placed nodes
 *
 * Any PlacementEngine can be combined with any RoutingEngine.
 */

import type {
  Bounds,
  IconDimensions,
  Link,
  LinkEndpoint,
  NetworkGraph,
  Node,
  Position,
  Size,
  Subgraph,
} from '@shumoku/core'

// ============================================
// Placement types
// ============================================

/** Port placement on a node boundary */
export interface PlacedPort {
  id: string
  label: string
  /** Absolute position */
  position: Position
  size: Size
  side: 'top' | 'bottom' | 'left' | 'right'
}

/** A node with its computed position and size */
export interface PlacedNode {
  id: string
  position: Position
  size: Size
  node: Node
  ports: Map<string, PlacedPort>
}

/** A subgraph with its computed bounds */
export interface PlacedSubgraph {
  id: string
  bounds: Bounds
  subgraph: Subgraph
  ports: Map<string, PlacedPort>
}

/** Output of a PlacementEngine - only positions, no edge routing */
export interface PlacementResult {
  nodes: Map<string, PlacedNode>
  subgraphs: Map<string, PlacedSubgraph>
  bounds: Bounds
  metadata?: {
    algorithm: string
    duration: number
    [key: string]: unknown
  }
}

/** Options passed to PlacementEngine */
export interface PlacementOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
  nodeSpacing?: number
  rankSpacing?: number
  subgraphPadding?: number
  /** Pre-resolved icon dimensions for node sizing */
  iconDimensions?: Map<string, IconDimensions>
  /** Fixed positions for specific nodes (partial manual placement) */
  fixedPositions?: Map<string, Position>
}

/** Engine that computes node positions */
export interface PlacementEngine {
  place(graph: NetworkGraph, options?: PlacementOptions): Promise<PlacementResult>
}

// ============================================
// Routing types
// ============================================

export type RoutingStrategy = 'straight' | 'orthogonal' | 'spline'

/** A routed edge between two nodes */
export interface RoutedEdge {
  id: string
  from: string
  to: string
  fromEndpoint: LinkEndpoint
  toEndpoint: LinkEndpoint
  /** Ordered list of points defining the edge path */
  points: Position[]
  /** Source port connection point */
  sourcePort: Position
  /** Target port connection point */
  targetPort: Position
  link: Link
}

/** Output of a RoutingEngine */
export interface RoutingResult {
  edges: Map<string, RoutedEdge>
  metadata?: {
    strategy: RoutingStrategy
    duration: number
    [key: string]: unknown
  }
}

/** An obstacle that edges must route around */
export interface Obstacle {
  x: number
  y: number
  width: number
  height: number
  /** Padding around the obstacle */
  margin?: number
}

/** Options passed to RoutingEngine */
export interface RoutingOptions {
  strategy: RoutingStrategy
  /** Default margin around obstacles (default: 8) */
  obstacleMargin?: number
  /** Corner radius for orthogonal bends (default: 0, sharp corners) */
  cornerRadius?: number
  /** Spline tension (0-1, only for spline strategy, default: 0.5) */
  splineTension?: number
}

/** Edge definition for routing (independent of Link model) */
export interface EdgeToRoute {
  id: string
  /** Source point (typically a port position) */
  source: Position
  /** Target point (typically a port position) */
  target: Position
  /** Original link data */
  link: Link
  fromEndpoint: LinkEndpoint
  toEndpoint: LinkEndpoint
}

/** Engine that computes edge paths between placed nodes */
export interface RoutingEngine {
  route(
    edges: EdgeToRoute[],
    obstacles: Obstacle[],
    options?: Partial<RoutingOptions>,
  ): RoutingResult
}

// ============================================
// Combined result (what renderers consume)
// ============================================

/** Final layout result = placement + routing combined */
export interface LayoutResult {
  nodes: Map<string, PlacedNode>
  links: Map<string, RoutedEdge>
  subgraphs: Map<string, PlacedSubgraph>
  bounds: Bounds
  metadata?: {
    placement: PlacementResult['metadata']
    routing: RoutingResult['metadata']
    [key: string]: unknown
  }
}
