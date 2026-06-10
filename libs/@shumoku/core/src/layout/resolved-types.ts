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
  /**
   * Label drawing hint set by the layout (which knows the slot pitch):
   * `vertical` = rotate the label to run along the wire because the
   * face is too dense for horizontal labels to clear each other.
   * Absent = horizontal (today's default).
   */
  labelOrientation?: 'horizontal' | 'vertical'
}

// ============================================================================
// Resolved Edge
// ============================================================================

/**
 * A routed edge connecting two existing ports. Points are absolute coordinates;
 * the first point is at the source port, and the last point at the destination
 * port. Both endpoints always have a port — the model invariant guarantees it.
 */
export interface ResolvedEdge {
  /** Unique edge ID */
  id: string
  /** Source port ID (always set — `${nodeId}:${portId}`) */
  fromPortId: string
  /** Destination port ID (always set — `${nodeId}:${portId}`) */
  toPortId: string
  /** Resolved source port (always present) */
  fromPort: ResolvedPort
  /** Resolved destination port (always present) */
  toPort: ResolvedPort
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
  /**
   * Lateral offset for the source endpoint, in SVG units, perpendicular
   * to the source port's outward normal. Positive = right-hand side of
   * the normal. Used to fan multiple edges sharing one port apart so the
   * curves don't visually stack. `0` / `undefined` = no offset.
   */
  fromLateralOffset?: number
  /** Same for the destination endpoint. */
  toLateralOffset?: number
  /**
   * How the renderer should draw this edge. When absent, the renderer
   * falls back to the standard port-anchored Bezier (today's default).
   *
   * Variants:
   *   - `bus`      — orthogonal T / Christmas-tree polyline sharing
   *                 a horizontal backbone with siblings of the same
   *                 fan-out group. `points` carries the polyline
   *                 (source endpoint → trunk-attach → backbone-leave →
   *                 target endpoint). `busId` ties this edge to the
   *                 sibling set so renderers can draw the backbone
   *                 once and the branches as stubs.
   *   - `polyline` — orthogonal multi-segment path, no shared backbone.
   *                 Used for edges that the router preferred to draw
   *                 with right angles for clarity but didn't qualify
   *                 as a bus.
   *
   * The hit-test geometry continues to live on `points`; `route` is
   * purely a drawing hint and never invalidates the existing 2-point
   * fallback used by labels / hit testing / cable-length / BOM.
   */
  route?:
    | { kind: 'bus'; points: Position[]; busId: string; branchIndex: number; branchCount: number }
    | { kind: 'polyline'; points: Position[] }
  /**
   * Semantic weight for renderers (v3 grammar): `primary` = the edge
   * belongs to the primary dependency tree (each node's strongest
   * uplink) and should read as the structural skeleton; `secondary` =
   * redundancy / peering context, drawn subdued. Absent = no opinion.
   */
  emphasis?: 'primary' | 'secondary'
  /**
   * v3 grammar: this edge is an HA/redundancy heartbeat between the two
   * members of a collapsed pair — a COUPLING, not a wire. Renderers draw
   * it as the "glasses" double bridge; the octilinear router and the
   * routed-geometry score both skip it. Set either from explicit
   * `link.redundancy` or inferred by the composite engine (direct link
   * between detected pair members).
   */
  coupling?: boolean
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
