/**
 * Layout engine for server
 * Uses the unified network layout engine (custom layout + libavoid)
 */

import { createNetworkLayoutEngine, type LayoutResult, type NetworkGraph } from '@shumoku/core'

const engine = createNetworkLayoutEngine()

/**
 * Compute layout asynchronously using the network layout engine.
 */
export async function computeLayout(graph: NetworkGraph): Promise<LayoutResult> {
  return engine.layoutAsync(graph)
}

/**
 * Get the layout engine instance (for buildHierarchicalSheets)
 */
export function getLayoutEngine() {
  return engine
}
