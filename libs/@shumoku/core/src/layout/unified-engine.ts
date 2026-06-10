// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Unified layout engine adapter
 *
 * Wraps the engine-driven `autoLayoutFlatTree` plus the trivial
 * `routeEdges` pass that attaches port-anchored `ResolvedEdge`
 * records. Edge geometry is computed in the renderer as cubic
 * Beziers from the port positions, so no routing solver is
 * involved at this layer anymore.
 *
 * Used by server, CLI, renderer-html, and renderer-svg for
 * consistent layout. The `LayoutEngine` interface here is the
 * legacy async wrapper from `hierarchical.ts`; the underlying
 * spatial-rule engine (`@shumoku/core/layout/engine`) is
 * instantiated inside `computeNetworkLayout`.
 */

import type { LayoutEngine } from '../hierarchical.js'
import type { LayoutResult, NetworkGraph } from '../models/types.js'
import { autoLayoutFlatTree } from './auto-placement/flat-tree/auto-layout.js'
import { layoutCompound } from './auto-placement/flat-tree/compound.js'
import { placePorts } from './auto-placement/flat-tree/port-placement.js'
import { layoutComposite, shouldUseComposite } from './composite/index.js'
import { applyOctilinearRoutes } from './composite/router.js'
import { createEngine, resolveNodeSize } from './engine/index.js'
import { getLinkWidth, getLinkWidthForMode } from './link-utils.js'
import type { ResolvedLayout } from './resolved-types.js'
import { routeEdges } from './route-edges.js'

/**
 * Create a LayoutEngine that uses the custom network layout + libavoid routing.
 * Returns LayoutResult for backward compatibility with existing consumers.
 */
export function createNetworkLayoutEngine(): LayoutEngine {
  return {
    async layoutAsync(graph: NetworkGraph): Promise<LayoutResult> {
      const { layout } = await computeNetworkLayout(graph)
      return layout
    },
    async layoutWithResolved(graph: NetworkGraph) {
      return computeNetworkLayout(graph)
    },
  }
}

/**
 * Compute layout and return both ResolvedLayout and legacy LayoutResult.
 * Use this when you need both (e.g., renderer-svg uses ResolvedLayout directly).
 */
export async function computeNetworkLayout(
  graph: NetworkGraph,
  options: { compound?: boolean; composite?: boolean } = {},
): Promise<{
  resolved: ResolvedLayout
  layout: LayoutResult
}> {
  const direction = graph.settings?.direction ?? 'TB'

  // Composite zone layout (v3 engine, #429): zones from location
  // metadata, layered quotient placement, octilinear edge routing.
  // Explicit option wins; otherwise auto-enable for graphs with broad
  // zone metadata (discovered networks), where it reads far better than
  // flat-tree/compound. Hand-drawn diagrams rarely qualify.
  const useComposite = options.composite ?? shouldUseComposite(graph)
  if (useComposite) {
    const comp = layoutComposite(graph)
    const ports = placePorts(comp.nodes, graph.links, direction)
    const edges = await routeEdges(comp.nodes, ports, graph.links, comp.subgraphs)
    // Composite pairs with the LINEAR width mode (v3 decision: width ∝
    // bandwidth, like river width on a map). The legacy log widths
    // (14-34px) are also physically incompatible with channel routing —
    // bundles that wide cannot be separated between ports.
    for (const edge of edges.values()) {
      edge.width = Math.max(1, getLinkWidthForMode(edge.link, 'linear'))
    }
    applyOctilinearRoutes(edges)
    return buildResults({
      nodes: comp.nodes,
      ports,
      edges,
      subgraphs: comp.subgraphs,
      bounds: comp.bounds,
      algorithm: 'composite+octilinear',
    })
  }

  // Create a spatial-rule engine once per layout call. Engines
  // are stateless beyond memoization, so this is cheap; in
  // contexts that lay out repeatedly (drag, animation) the
  // engine instance can be hoisted to caller scope.
  const engine = createEngine()
  // `compound` folds each subgraph into a compact box and arranges
  // the boxes by dependency — the container reading that scales to
  // large grouped (auto-discovered) graphs.
  // Link width is bandwidth-derived and can be tens of px on a fast
  // fabric. The flat-tree gaps are otherwise fixed, so a thick pipe
  // overruns the nodes it runs between. Widen the sibling/layer gaps to
  // clear the thickest link so the wiring has room (thin-link graphs
  // keep the small defaults).
  let maxLinkWidth = 0
  for (const l of graph.links) maxLinkWidth = Math.max(maxLinkWidth, getLinkWidth(l))
  const nodeGap = Math.max(30, Math.round(maxLinkWidth) + 16)
  const layerGap = Math.max(80, Math.round(maxLinkWidth) + 24)

  const layoutFn = options.compound ? layoutCompound : autoLayoutFlatTree
  const { nodes, ports, subgraphs, bounds } = layoutFn(graph, engine, {
    direction,
    nodeGap,
    layerGap,
  })
  const edges = await routeEdges(nodes, ports, graph.links, subgraphs)

  return buildResults({
    nodes,
    ports,
    edges,
    subgraphs,
    bounds,
    algorithm: 'network-layout+bezier',
  })
}

/** Assemble ResolvedLayout + legacy LayoutResult from layout pieces. */
function buildResults(input: {
  nodes: ResolvedLayout['nodes']
  ports: ResolvedLayout['ports']
  edges: ResolvedLayout['edges']
  subgraphs: ResolvedLayout['subgraphs']
  bounds: ResolvedLayout['bounds']
  algorithm: string
}): { resolved: ResolvedLayout; layout: LayoutResult } {
  const { nodes, ports, edges, subgraphs, bounds } = input
  const resolved: ResolvedLayout = {
    nodes,
    ports,
    edges,
    subgraphs,
    bounds,
    metadata: { algorithm: input.algorithm, duration: 0 },
  }

  // Build LayoutResult with ports converted from absolute to center-relative
  const layoutNodes = new Map(
    [...nodes].map(([id, node]) => {
      // Collect ports for this node, convert absolute → center-relative
      const nodePorts = new Map<
        string,
        {
          id: string
          label: string
          position: { x: number; y: number }
          size: { width: number; height: number }
          side: 'top' | 'bottom' | 'left' | 'right'
        }
      >()
      const pos = node.position ?? { x: 0, y: 0 }
      const size = resolveNodeSize(node)
      for (const [portId, rp] of ports) {
        if (rp.nodeId !== id) continue
        nodePorts.set(portId, {
          id: portId,
          label: rp.label,
          position: {
            x: rp.absolutePosition.x - pos.x,
            y: rp.absolutePosition.y - pos.y,
          },
          size: rp.size,
          side: rp.side,
        })
      }
      return [
        id,
        {
          id,
          position: pos,
          size,
          node,
          ...(nodePorts.size > 0 ? { ports: nodePorts } : {}),
        },
      ] as const
    }),
  )

  const layout: LayoutResult = {
    nodes: layoutNodes,
    links: new Map(
      [...edges].map(([id, re]) => [
        id,
        {
          id,
          from: re.fromNodeId,
          to: re.toNodeId,
          fromEndpoint: re.fromEndpoint,
          toEndpoint: re.toEndpoint,
          points: re.points,
          link: re.link,
        },
      ]),
    ),
    subgraphs: new Map(
      [...subgraphs].map(([id, sg]) => [
        id,
        { id, bounds: sg.bounds ?? { x: 0, y: 0, width: 0, height: 0 }, subgraph: sg },
      ]),
    ),
    bounds,
    metadata: resolved.metadata,
  }

  return { resolved, layout }
}
