// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku Layout Engines
 */

export type { HierarchicalLayoutOptions } from './hierarchical.js'
export { HierarchicalLayout } from './hierarchical.js'

// Concrete engine implementations
export { ElkNodePlacement } from './elk-placement.js'
export { LibavoidEdgeRouter, ensureLibavoidLoaded } from './libavoid-router.js'

// Resolved layout model (Node/Port/Edge as independent objects)
export type {
  ResolvedEdge,
  ResolvedLayout,
  ResolvedNode,
  ResolvedPort,
  ResolvedSubgraph,
} from './resolved-types.js'
export { resolveLayout, unresolveLayout } from './resolve.js'

// Layout engine interfaces and composition utilities
export type {
  EdgeRoutingEngine,
  EdgeRoutingResult,
  NodePlacementEngine,
  NodePlacementResult,
  PlacementOptions,
  PositionedNode,
  PositionedSubgraph,
  RoutedEdge,
  RoutingOptions,
} from './types.js'
export { composeLayoutResult, decomposeLayoutResult } from './types.js'
