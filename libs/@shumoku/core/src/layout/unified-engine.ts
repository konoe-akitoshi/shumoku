// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Unified layout engine adapter
 *
 * Wraps layoutNetwork + routeEdges into a LayoutEngine-compatible interface.
 * Used by server, CLI, renderer-html, and renderer-svg for consistent layout.
 */

import type { LayoutEngine } from '../hierarchical.js'
import type { LayoutResult, NetworkGraph } from '../models/types.js'
import { routeEdges } from './libavoid-router.js'
import { layoutNetwork } from './network-layout.js'
import type { ResolvedLayout } from './resolved-types.js'

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
export async function computeNetworkLayout(graph: NetworkGraph): Promise<{
  resolved: ResolvedLayout
  layout: LayoutResult
}> {
  const direction = graph.settings?.direction ?? 'TB'
  const edgeStyle = graph.settings?.edgeStyle ?? 'orthogonal'

  const { nodes, ports, subgraphs, bounds } = layoutNetwork(graph, { direction })
  const edges = await routeEdges(nodes, ports, graph.links, {
    edgeStyle: edgeStyle === 'splines' ? 'polyline' : edgeStyle,
  })

  const resolved: ResolvedLayout = {
    nodes,
    ports,
    edges,
    subgraphs,
    bounds,
    metadata: { algorithm: 'network-layout+libavoid', duration: 0 },
  }

  // Build LayoutResult with ports converted from absolute to center-relative
  const layoutNodes = new Map(
    [...nodes].map(([id, rn]) => {
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
      for (const [portId, rp] of ports) {
        if (rp.nodeId !== id) continue
        nodePorts.set(portId, {
          id: portId,
          label: rp.label,
          position: {
            x: rp.absolutePosition.x - rn.position.x,
            y: rp.absolutePosition.y - rn.position.y,
          },
          size: rp.size,
          side: rp.side,
        })
      }
      return [
        id,
        {
          id,
          position: rn.position,
          size: rn.size,
          node: rn.node,
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
      [...subgraphs].map(([id, rs]) => [id, { id, bounds: rs.bounds, subgraph: rs.subgraph }]),
    ),
    bounds,
    metadata: resolved.metadata,
  }

  return { resolved, layout }
}
