// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku Layout Engines
 *
 * Public surface:
 *
 *   - `createEngine(config)` — rule authority. Provides sizing,
 *     placement-policy queries, text measurement.
 *   - `autoLayoutFlatTree(graph, engine, options)` — the flat-
 *     tree auto-placement algorithm wrapped behind an engine.
 *
 * The legacy `layoutNetwork(graph, options)` entry is kept for
 * callers that haven't migrated yet; new code should construct
 * an engine and call `autoLayoutFlatTree`.
 */

export {
  type AutoLayoutOptions,
  type AutoLayoutResult,
  autoLayoutFlatTree,
} from './auto-placement/flat-tree/auto-layout.js'
// Bezier edge geometry (shared by interactive renderer + SSR renderer-svg)
export { bezierEdgePath, bezierOffsetPath, type PortSide } from './bezier-path.js'
export type {
  LayoutEngine as ShumokuLayoutEngine,
  PortsBySide as EnginePortsBySide,
} from './engine/index.js'
// New engine + auto-placement surface. Conflicting names
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
export {
  bpsToLinkWidth,
  getBandwidthWidth,
  getLinkWidth,
  linkSpeedBps,
  resolveBandwidthBps,
} from './link-utils.js'
// Custom network layout (Sugiyama 4-alignment) + bezier edge wrapping
export type { NetworkLayoutOptions, NetworkLayoutResult, PortsBySide } from './network-layout.js'
export {
  computeNodeBodySize,
  computeNodeFootprint,
  computeNodeSize,
  layoutNetwork,
  resolveNodeSize,
} from './network-layout.js'
export { placePorts } from './port-placement.js'
// Conversion utilities (for backward compatibility with legacy LayoutResult)
export { resolveLayout, unresolveLayout } from './resolve.js'
// Resolved layout model (Port/Edge as computed objects, Node/Subgraph used directly)
export type { ResolvedEdge, ResolvedLayout, ResolvedPort } from './resolved-types.js'
export { routeEdges } from './route-edges.js'
// Unified layout engine (wraps network layout + bezier edge wrapping)
export { computeNetworkLayout, createNetworkLayoutEngine } from './unified-engine.js'
