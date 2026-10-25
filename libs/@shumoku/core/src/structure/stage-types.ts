// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { GroupId, NodeId, RedundancyId, RoutingDomainId, SegmentId, UnitId } from './types.js'

/**
 * What the stages hand each other. These are the derivation's working data and not part of the
 * structure it returns: vertices are named `node:<id>`, `unit:<id>`, `segment:<id>` or
 * `routingDomain:<id>`, so the kinds cannot be mistaken for one another.
 */

export type VertexRef = string

/** One end of a line: a node and its port when known, a segment or a routing domain. */
export type End =
  | { readonly node: NodeId; readonly port?: string }
  | { readonly segment: SegmentId }
  | { readonly routingDomain: RoutingDomainId }

// ---- 1. Analysis graph ----------------------------------------------------------------------

export interface AnalysisVertex {
  readonly ref: VertexRef
  /** A routing domain is a network whose inside is not written, joined as one vertex. */
  readonly kind: 'node' | 'segment' | 'routingDomain'
  readonly id: string
  /** A node's or a segment's own group. */
  readonly group?: GroupId
}

/**
 * A line of the analysis graph: a written link, virtual or not, or a node's membership of a
 * segment that is a vertex. Lines with the same ends and ports cannot be told apart and count
 * as one with a multiplicity.
 */
export interface AnalysisEdge {
  readonly kind: 'link' | 'member'
  /** The lines have no cable of their own, such as a tunnel or a session. */
  readonly virtual: boolean
  /** The two ends in a fixed order. */
  readonly ends: readonly [End, End]
  readonly multiplicity: number
  /** The segments the lines carry. */
  readonly carries: readonly SegmentId[]
}

export interface AnalysisGraph {
  readonly vertices: readonly AnalysisVertex[]
  readonly edges: readonly AnalysisEdge[]
}

// ---- 2. Units -------------------------------------------------------------------------------

export interface Unit {
  readonly id: UnitId
  /** `redundancy`: a folded redundancy set; `host`: nodes folded into their host; `node`: alone. */
  readonly kind: 'redundancy' | 'host' | 'node'
  readonly members: readonly NodeId[]
  /** The smallest group holding every member, when there is one. */
  readonly place?: GroupId
}

export interface Units {
  readonly units: readonly Unit[]
  /** Redundancy sets that were not folded, and why. */
  readonly kept: readonly {
    readonly redundancy: RedundancyId
    readonly why: 'places' | 'overlap'
  }[]
}

// ---- 3. Planes ------------------------------------------------------------------------------

/** A line between two vertices of a plane's graph, all the lines between the two together. */
export interface UnitEdge {
  /** The ends, `a` before `b`. */
  readonly a: VertexRef
  readonly b: VertexRef
  readonly multiplicity: number
  readonly lines: readonly AnalysisEdge[]
}

/**
 * Which lines of a plane a graph holds: those with a cable of their own (`physical`), or the
 * virtual ones (tunnels, sessions). A vertex in graphs of both sides is a candidate boundary point.
 */
export type Side = 'physical' | 'virtual'

/** The graph of the units, segments and routing domains joined by the lines of one side of a plane. */
export interface PlaneGraph {
  /** `default`, or a routing domain's id. */
  readonly plane: string
  readonly side: Side
  readonly vertices: readonly VertexRef[]
  readonly edges: readonly UnitEdge[]
}

// ---- 4. Orientation ------------------------------------------------------------------------

/** How near each end of the lines of one side of a plane is to the boundary points. */
export interface Orientation {
  readonly plane: string
  readonly side: Side
  /** Lines as [nearer, farther]: the end nearer a boundary point first. */
  readonly flows: readonly (readonly [VertexRef, VertexRef])[]
  /** Lines whose ends are as near the boundary points as each other. */
  readonly even: readonly (readonly [VertexRef, VertexRef])[]
}

// ---- The whole ------------------------------------------------------------------------------

export interface Stages {
  readonly analysis: AnalysisGraph
  readonly units: Units
  readonly planes: readonly PlaneGraph[]
  /** The vertices with lines on both sides: where the physical may meet the virtual. */
  readonly candidates: readonly VertexRef[]
  /** The boundary points given by the reader, which the orientation is measured from. */
  readonly boundary: readonly VertexRef[]
  /** One for each plane graph, in the order of `planes`. */
  readonly orientations: readonly Orientation[]
}
