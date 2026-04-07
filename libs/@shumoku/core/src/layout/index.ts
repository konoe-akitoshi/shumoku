// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku Layout Engines
 */

export type { LibavoidRoutingOptions } from './libavoid-router.js'
export { ensureLibavoidLoaded, routeEdges } from './libavoid-router.js'
export { getLinkWidth } from './link-utils.js'
export type { NetworkLayoutOptions, NetworkLayoutResult } from './network-layout.js'
// Custom network layout + libavoid routing
export { layoutNetwork } from './network-layout.js'
export { placePorts } from './port-placement.js'
// Conversion utilities (for backward compatibility with legacy LayoutResult)
export { resolveLayout, unresolveLayout } from './resolve.js'
// Resolved layout model (Node/Port/Edge as independent objects)
export type {
  ResolvedEdge,
  ResolvedLayout,
  ResolvedNode,
  ResolvedPort,
  ResolvedSubgraph,
} from './resolved-types.js'
// Unified layout engine (wraps network layout + libavoid)
export { computeNetworkLayout, createNetworkLayoutEngine } from './unified-engine.js'
