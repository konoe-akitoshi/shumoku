// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Resolved layout model — Node, Port, and Edge as independent objects
 * with absolute coordinates.
 *
 * Design principles:
 * - Each object owns its absolute position (no relative coordinates)
 * - Objects reference each other by ID (no coordinate conversion needed)
 * - libavoid, SVG renderer, and any other consumer use the same coordinates
 * - Single source of truth for port positions
 *
 * Processing pipeline:
 * 1. Node placement → ResolvedNode[] (position + size confirmed)
 * 2. Port placement → ResolvedPort[] (absolute position confirmed, using node position + connection info)
 * 3. Edge routing  → ResolvedEdge[] (routed through port absolute positions)
 * 4. Rendering     → draw each object independently using absolute coordinates
 */

import type { Bounds, Link, LinkEndpoint, Node, Position, Size, Subgraph } from '../models/types.js'

/**
 * Compute the visual line width for a link.
 * Single source of truth — used by layout, routing, and rendering.
 */
export function getLinkWidth(link: Link): number {
  // Explicit style overrides everything
  if (link.style?.strokeWidth) return link.style.strokeWidth

  // Bandwidth determines width
  switch (link.bandwidth) {
    case '100G':
      return 24
    case '40G':
      return 18
    case '25G':
      return 14
    case '10G':
      return 10
    case '1G':
      return 6
  }

  // Link type
  if (link.type === 'thick') return 3

  // Default
  return 2
}

// ============================================================================
// Resolved Node
// ============================================================================

/**
 * A node with confirmed absolute position and size.
 * Position is the center of the node.
 */
export interface ResolvedNode {
  id: string
  /** Absolute center position */
  position: Position
  /** Node dimensions */
  size: Size
  /** Original node data (type, label, vendor, etc.) */
  node: Node
}

// ============================================================================
// Resolved Port
// ============================================================================

/**
 * A port with confirmed absolute position.
 * This is THE single source of truth for where a port is.
 * Both edge routing and rendering use this position directly.
 */
export interface ResolvedPort {
  /** Unique port ID (typically "nodeId:portName") */
  id: string
  /** The node this port belongs to */
  nodeId: string
  /** Port display name (e.g., "eth0", "Gi0/1") */
  label: string
  /** Absolute position — center of the port */
  absolutePosition: Position
  /** Which side of the node this port is on */
  side: 'top' | 'bottom' | 'left' | 'right'
  /** Port visual size */
  size: Size
}

// ============================================================================
// Resolved Edge
// ============================================================================

/**
 * A routed edge connecting two ports (or node centers for portless connections).
 * Points are absolute coordinates — the first point should be at/near the
 * source port, and the last point at/near the destination port.
 */
export interface ResolvedEdge {
  /** Unique edge ID */
  id: string
  /** Source port ID (or node ID for portless connections) */
  fromPortId: string | null
  /** Destination port ID (or node ID for portless connections) */
  toPortId: string | null
  /** Source node ID */
  fromNodeId: string
  /** Destination node ID */
  toNodeId: string
  /** Source endpoint info from original link */
  fromEndpoint: LinkEndpoint
  /** Destination endpoint info from original link */
  toEndpoint: LinkEndpoint
  /** Routed path — absolute coordinates */
  points: Position[]
  /** Line width in pixels (derived from bandwidth/type) */
  width: number
  /** Original link data (bandwidth, redundancy, vlan, etc.) */
  link: Link
}

// ============================================================================
// Resolved Subgraph
// ============================================================================

/**
 * A subgraph/zone with confirmed bounds.
 */
export interface ResolvedSubgraph {
  id: string
  /** Absolute bounds */
  bounds: Bounds
  /** Original subgraph data */
  subgraph: Subgraph
  /** Boundary ports (for hierarchical connections) */
  ports?: ResolvedPort[]
}

// ============================================================================
// Complete Resolved Layout
// ============================================================================

/**
 * Complete resolved layout — all objects with absolute coordinates.
 * This is the output of the full layout pipeline and the input to rendering.
 */
export interface ResolvedLayout {
  nodes: Map<string, ResolvedNode>
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  subgraphs: Map<string, ResolvedSubgraph>
  bounds: Bounds
  metadata?: {
    algorithm: string
    duration: number
    [key: string]: unknown
  }
}
