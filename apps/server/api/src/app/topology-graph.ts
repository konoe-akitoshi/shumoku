import type { DrawingScene, MetricsMapping, NetworkGraph } from '@shumoku/core'

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

/**
 * The same overrides on the links the scene carries, so a viewer that reads a wire's link sees
 * what the graph says. The mapping is not part of the baked artifact (editing it must not draw
 * again), and the drawing sizes lines by the link's speed, which an override does not change.
 */
export function applyMappingBandwidthToScene(
  scene: DrawingScene,
  mapping?: MetricsMapping,
): DrawingScene {
  if (!mapping?.links || Object.keys(mapping.links).length === 0) return scene
  let changed = false
  const wires = scene.wires.map((wire) => {
    const override = wire.link.id === undefined ? undefined : mapping.links[wire.link.id]?.bandwidth
    if (override === undefined) return wire
    changed = true
    return { ...wire, link: { ...wire.link, bandwidth: override } }
  })
  return changed ? { ...scene, wires } : scene
}
