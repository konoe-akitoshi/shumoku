// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku Layout Engines
 */

// Bezier edge geometry (shared by interactive renderer + SSR renderer-svg)
export { bezierEdgePath, type PortSide } from './bezier-path.js'
// Interactive operations (node move, collision detection)
export {
  addLink,
  addPort,
  collectObstacles,
  detectClickSide,
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
