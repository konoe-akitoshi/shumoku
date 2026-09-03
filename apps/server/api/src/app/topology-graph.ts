import type { MetricsMapping, NetworkGraph } from '@shumoku/core'

export function applyMappingBandwidth(graph: NetworkGraph, mapping?: MetricsMapping): NetworkGraph {
  if (!mapping?.links || Object.keys(mapping.links).length === 0) return graph
  let changed = false
  const links = graph.links.map((link, index) => {
    const linkId = link.id || `link-${index}`
    const override = mapping.links[linkId]?.bandwidth
    if (override === undefined) return link
    changed = true
    return { ...link, bandwidth: override }
  })
  return changed ? { ...graph, links } : graph
}
