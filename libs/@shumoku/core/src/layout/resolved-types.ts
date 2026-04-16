// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Resolved layout model — absolute coordinates for rendering.
 *
 * Design principles:
 * - Node and Subgraph are used directly (with position/bounds set)
 * - Port and Edge are computed types with absolute coordinates
 * - libavoid, SVG renderer, and any other consumer use the same coordinates
 *
 * Processing pipeline:
 * 1. Node placement → Node[] with position set
 * 2. Port placement → ResolvedPort[] (absolute position, using node position + link info)
 * 3. Edge routing  → ResolvedEdge[] (routed through port absolute positions)
 * 4. Rendering     → draw each object using absolute coordinates
 */

import type { Bounds, Link, LinkEndpoint, Node, Position, Size, Subgraph } from '../models/types.js'

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
// Complete Resolved Layout
// ============================================================================

/**
 * Complete resolved layout — all objects with absolute coordinates.
 * This is the output of the full layout pipeline and the input to rendering.
 *
 * Node and Subgraph are the core model types with position/bounds set.
 * ResolvedPort and ResolvedEdge are computed types for rendering.
 */
export interface ResolvedLayout {
  nodes: Map<string, Node>
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  subgraphs: Map<string, Subgraph>
  bounds: Bounds
  metadata?: {
    algorithm: string
    duration: number
    [key: string]: unknown
  }
}
