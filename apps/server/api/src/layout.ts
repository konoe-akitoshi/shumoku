import { createNetworkLayoutEngine, type LayoutResult, type NetworkGraph } from '@shumoku/core'

const engine = createNetworkLayoutEngine()

export async function computeLayout(graph: NetworkGraph): Promise<LayoutResult> {
  return engine.layoutAsync(graph)
}

export function getLayoutEngine() {
  return engine
}
