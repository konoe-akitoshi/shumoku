// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku Layout — public surface.
 *
 *   - `createEngine(config)` — rule authority. Provides sizing,
 *     placement-policy queries, text measurement.
 *   - `autoLayoutFlatTree(graph, engine, options)` — the
 *     flat-tree auto-placement algorithm. Most callers go
 *     through `computeNetworkLayout` (below), which sets up
 *     a default engine + edge routing.
 *   - `computeNetworkLayout(graph)` — convenience entry that
 *     internally calls `autoLayoutFlatTree` and routes edges.
 *   - `resolveNodeSize(node)` — returns `node.size` if set,
 *     otherwise asks an engine for the body size.
 *
 * Manual placement uses the same engine via `engine.tryPlace`
 * so layout and drag-snap stay consistent.
 */

// Auto-placement
export {
  type AutoLayoutOptions,
  type AutoLayoutResult,
  autoLayoutFlatTree,
} from './auto-placement/flat-tree/auto-layout.js'
// Port placement (decides which side, places ports) — lives
// inside the flat-tree algorithm but re-exported here for
// editor consumers that call it directly during link edits.
export { placePorts } from './auto-placement/flat-tree/port-placement.js'
// Bezier edge geometry (shared by interactive renderer + SSR renderer-svg)
export { bezierEdgePath, bezierOffsetPath, type PortSide } from './bezier-path.js'
// Composite zone layout (v3 engine) + octilinear channel router.
export {
  type CompositeLayoutOptions,
  type CompositeLayoutResult,
  layoutComposite,
  shouldUseComposite,
  ZONE_SUBGRAPH_PREFIX,
} from './composite/index.js'
export { alignPortsToPeers, applyOctilinearRoutes, chamferCorners } from './composite/router.js'
export {
  type CompositeSearchOptions,
  type CompositeSearchResult,
  type RoutedScore,
  scoreRoutedEdges,
  searchCompositeLayout,
} from './composite/search.js'
export type {
  LayoutEngine as ShumokuLayoutEngine,
  PortsBySide as EnginePortsBySide,
} from './engine/index.js'
// Engine — rule authority + placement policy. Conflicting names
// (LayoutEngine, Size, Position) are NOT re-exported here —
// import from `@shumoku/core/layout/engine` deeply if you need
// them, or alias on import.
export {
  createEngine,
  type EngineConfig,
  type LayoutMetrics,
  type LayoutRules,
  type NodeWithPosition,
  type PlacementConflict,
  type PlacementPolicy,
  type PlacementResult,
  type PortInfo,
  type Rect,
  resolveNodeSize,
  type Side,
  type TextMeasurer,
} from './engine/index.js'
// Interactive operations (node move, collision detection)
export {
  addLink,
  addPort,
  collectObstacles,
  detectClickSide,
  isPortLinked,
  linkExists,
  moveNode,
  movePort,
  moveSubgraph,
  nodesOverlap,
  placeNode,
  rebalanceSubgraphs,
  removePort,
  resolveNodePosition,
  resolvePosition,
} from './interaction.js'
// Layout invariant checks (containment / overlap / collinear tracks) —
// standing verification fixture for every placement/routing pass.
export {
  type BoxSpec,
  type CollinearOverlap,
  type ContainerSpec,
  type ContainmentViolation,
  checkLayoutInvariants,
  findCollinearOverlaps,
  findContainmentViolations,
  findNodeOverlaps,
  findPortClutter,
  type LayoutInvariantOptions,
  type LayoutInvariantReport,
  type NodeOverlap,
  type PolylineSpec,
  type PortClutter,
} from './invariants.js'
export {
  bpsToLinkWidth,
  bpsToLinkWidthMode,
  getBandwidthWidth,
  getLinkWidth,
  getLinkWidthForMode,
  type LinkWidthMode,
  linkSpeedBps,
  resolveBandwidthBps,
} from './link-utils.js'
// Port / port-label geometry — single source of truth shared by the
// renderer, the invariant checker and the routed score.
export {
  PORT_LABEL_BOX_OFFSET,
  PORT_LABEL_FONT,
  PORT_LABEL_H,
  portBox,
  portLabelBox,
  portLabelLength,
  portLabelReach,
} from './port-geometry.js'
// Conversion utilities (for backward compatibility with legacy LayoutResult)
export { resolveLayout, unresolveLayout } from './resolve.js'
// Resolved layout model (Port/Edge as computed objects, Node/Subgraph used directly)
export type { ResolvedEdge, ResolvedLayout, ResolvedPort } from './resolved-types.js'
export { routeEdges } from './route-edges.js'
// Top-level convenience entry that runs autoLayoutFlatTree +
// edge routing in one call. Used by the editor / server / CLI.
export { computeNetworkLayout, createNetworkLayoutEngine } from './unified-engine.js'
