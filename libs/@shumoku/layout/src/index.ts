// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Types
export type {
  PlacedNode,
  PlacedPort,
  PlacedSubgraph,
  PlacementEngine,
  PlacementOptions,
  PlacementResult,
  RoutingEngine,
  RoutingOptions,
  RoutingResult,
  RoutingStrategy,
  RoutedEdge,
  EdgeToRoute,
  Obstacle,
  LayoutResult,
} from './types.js'

// Placement engines
export { ElkPlacement } from './placement/index.js'

// Routing engines
export { StraightRouter, OrthogonalRouter, SplineRouter, createRouter } from './routing/index.js'

// Pipeline
export { LayoutPipeline } from './pipeline.js'
export type { LayoutPipelineOptions } from './pipeline.js'
