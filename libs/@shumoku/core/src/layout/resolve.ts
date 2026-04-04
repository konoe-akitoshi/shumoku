// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Convert between LayoutResult (legacy) and ResolvedLayout (new model).
 *
 * These functions enable gradual migration: existing code can continue
 * using LayoutResult while new code uses ResolvedLayout.
 */

import type {
  LayoutLink,
  LayoutNode,
  LayoutPort,
  LayoutResult,
  LayoutSubgraph,
  LinkEndpoint,
} from '../models/types.js'
import { getLinkWidth } from './resolved-types.js'
import type {
  ResolvedEdge,
  ResolvedLayout,
  ResolvedNode,
  ResolvedPort,
  ResolvedSubgraph,
} from './resolved-types.js'

// ============================================================================
// LayoutResult → ResolvedLayout
// ============================================================================

/**
 * Convert a legacy LayoutResult to a ResolvedLayout.
 * Port positions are converted from center-relative to absolute.
 */
export function resolveLayout(result: LayoutResult): ResolvedLayout {
  const nodes = new Map<string, ResolvedNode>()
  const ports = new Map<string, ResolvedPort>()
  const edges = new Map<string, ResolvedEdge>()
  const subgraphs = new Map<string, ResolvedSubgraph>()

  // Resolve nodes
  for (const [id, ln] of result.nodes) {
    nodes.set(id, {
      id,
      position: ln.position,
      size: ln.size,
      node: ln.node,
    })

    // Resolve ports — convert center-relative to absolute
    if (ln.ports) {
      for (const [portId, lp] of ln.ports) {
        ports.set(portId, {
          id: portId,
          nodeId: id,
          label: lp.label,
          absolutePosition: {
            x: ln.position.x + lp.position.x,
            y: ln.position.y + lp.position.y,
          },
          side: lp.side,
          size: lp.size,
        })
      }
    }
  }

  // Resolve edges
  for (const [id, ll] of result.links) {
    const fromPortId = resolvePortId(ll.fromEndpoint, result.nodes)
    const toPortId = resolvePortId(ll.toEndpoint, result.nodes)

    edges.set(id, {
      id,
      fromPortId,
      toPortId,
      fromNodeId: ll.from,
      toNodeId: ll.to,
      fromEndpoint: ll.fromEndpoint,
      toEndpoint: ll.toEndpoint,
      points: ll.points,
      width: getLinkWidth(ll.link),
      link: ll.link,
    })
  }

  // Resolve subgraphs
  for (const [id, ls] of result.subgraphs) {
    const resolvedPorts: ResolvedPort[] = []
    if (ls.ports) {
      for (const [portId, lp] of ls.ports) {
        const rp: ResolvedPort = {
          id: portId,
          nodeId: id,
          label: lp.label,
          absolutePosition: {
            x: ls.bounds.x + ls.bounds.width / 2 + lp.position.x,
            y: ls.bounds.y + ls.bounds.height / 2 + lp.position.y,
          },
          side: lp.side,
          size: lp.size,
        }
        resolvedPorts.push(rp)
        ports.set(portId, rp)
      }
    }

    subgraphs.set(id, {
      id,
      bounds: ls.bounds,
      subgraph: ls.subgraph,
      ports: resolvedPorts.length > 0 ? resolvedPorts : undefined,
    })
  }

  return {
    nodes,
    ports,
    edges,
    subgraphs,
    bounds: result.bounds,
    metadata: result.metadata,
  }
}

/**
 * Find the port ID for a link endpoint, if the port exists in the layout.
 */
function resolvePortId(
  endpoint: LinkEndpoint,
  nodes: Map<string, LayoutNode>,
): string | null {
  if (!endpoint.port) return null
  const node = nodes.get(endpoint.node)
  if (!node?.ports) return null
  // Port map key is typically "nodeId:portName"
  const portId = `${endpoint.node}:${endpoint.port}`
  return node.ports.has(portId) ? portId : null
}

// ============================================================================
// ResolvedLayout → LayoutResult
// ============================================================================

/**
 * Convert a ResolvedLayout back to a legacy LayoutResult.
 * Used for backward compatibility with existing renderers.
 */
export function unresolveLayout(resolved: ResolvedLayout): LayoutResult {
  const nodes = new Map<string, LayoutNode>()
  const links = new Map<string, LayoutLink>()
  const subgraphs = new Map<string, LayoutSubgraph>()

  // Convert nodes — collect ports back into center-relative format
  for (const [id, rn] of resolved.nodes) {
    const nodePorts = new Map<string, LayoutPort>()
    for (const [portId, rp] of resolved.ports) {
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

    nodes.set(id, {
      id,
      position: rn.position,
      size: rn.size,
      node: rn.node,
      ports: nodePorts.size > 0 ? nodePorts : undefined,
    })
  }

  // Convert edges
  for (const [id, re] of resolved.edges) {
    links.set(id, {
      id,
      from: re.fromNodeId,
      to: re.toNodeId,
      fromEndpoint: re.fromEndpoint,
      toEndpoint: re.toEndpoint,
      points: re.points,
      link: re.link,
    })
  }

  // Convert subgraphs
  for (const [id, rs] of resolved.subgraphs) {
    const sgPorts = new Map<string, LayoutPort>()
    if (rs.ports) {
      for (const rp of rs.ports) {
        sgPorts.set(rp.id, {
          id: rp.id,
          label: rp.label,
          position: {
            x: rp.absolutePosition.x - (rs.bounds.x + rs.bounds.width / 2),
            y: rp.absolutePosition.y - (rs.bounds.y + rs.bounds.height / 2),
          },
          size: rp.size,
          side: rp.side,
        })
      }
    }

    subgraphs.set(id, {
      id,
      bounds: rs.bounds,
      subgraph: rs.subgraph,
      ports: sgPorts.size > 0 ? sgPorts : undefined,
    })
  }

  return {
    nodes,
    links,
    subgraphs,
    bounds: resolved.bounds,
    metadata: resolved.metadata,
  }
}
