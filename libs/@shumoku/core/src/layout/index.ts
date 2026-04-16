// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku Layout Engines
 */

// Interactive operations (node move, collision detection)
export {
  addLink,
  addPort,
  collectObstacles,
  detectClickSide,
  generatePortName,
  linkExists,
  moveNode,
  movePort,
  moveSubgraph,
  nodesOverlap,
  rebalanceSubgraphs,
  removePort,
  resolveNodePosition,
  resolvePosition,
} from './interaction.js'
export type { LibavoidRoutingOptions } from './libavoid-router.js'
export { ensureLibavoidLoaded, routeEdges } from './libavoid-router.js'
export { getLinkWidth } from './link-utils.js'
export type { NetworkLayoutOptions, NetworkLayoutResult } from './network-layout.js'
// Custom network layout + libavoid routing
export { computeNodeSize, layoutNetwork } from './network-layout.js'
export { placePorts } from './port-placement.js'
// Remote client (browser → server API, avoids WASM in browser)
export {
  computeNetworkLayoutRemote,
  getLayoutApiUrl,
  routeEdgesRemote,
  setLayoutApiUrl,
} from './remote-client.js'
// Conversion utilities (for backward compatibility with legacy LayoutResult)
export { resolveLayout, unresolveLayout } from './resolve.js'
// Resolved layout model (Port/Edge as computed objects, Node/Subgraph used directly)
export type { ResolvedEdge, ResolvedLayout, ResolvedPort } from './resolved-types.js'
// Unified layout engine (wraps network layout + libavoid)
export { computeNetworkLayout, createNetworkLayoutEngine } from './unified-engine.js'
