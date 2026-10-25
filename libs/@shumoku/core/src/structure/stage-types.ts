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

/** The graph of the units, segments and routing domains joined by the lines of one plane. */
export interface PlaneGraph {
  /** `default`, or a routing domain's id. */
  readonly plane: string
  readonly vertices: readonly VertexRef[]
  readonly edges: readonly UnitEdge[]
}

// ---- 4. Decomposition -----------------------------------------------------------------------

/** An edge of a node of the SPQR tree: a line, or a stand-in for the rest of the block. */
export type SpqrEdge =
  | { readonly kind: 'real'; readonly a: VertexRef; readonly b: VertexRef }
  | {
      readonly kind: 'virtual'
      readonly a: VertexRef
      readonly b: VertexRef
      /** The node of the tree on the other side, by its key. */
      readonly to: string
    }

export interface SpqrNode {
  /** `S:` / `P:` / `R:` and the members, which names the node. */
  readonly key: string
  readonly kind: 'S' | 'P' | 'R'
  /** S: in the order round the cycle; P: its two poles; R: sorted. */
  readonly vertices: readonly VertexRef[]
  readonly edges: readonly SpqrEdge[]
}

export interface Block {
  /** Sorted; names the block. */
  readonly vertices: readonly VertexRef[]
  readonly edges: readonly UnitEdge[]
  /** Left out for a block of a single vertex or a single edge. */
  readonly spqr?: { readonly nodes: readonly SpqrNode[] }
}

export interface CutVertex {
  readonly vertex: VertexRef
  /** The blocks that meet there, each by its vertices. */
  readonly blocks: readonly (readonly VertexRef[])[]
}

export interface Decomposition {
  readonly blocks: readonly Block[]
  readonly cutVertices: readonly CutVertex[]
}

// ---- 5. Twins -------------------------------------------------------------------------------

export interface TwinSet {
  readonly members: readonly VertexRef[]
  /** The neighbours they share, not counting each other. */
  readonly neighbours: readonly VertexRef[]
  readonly adjacent: boolean
}

export interface PlaneStage extends PlaneGraph {
  readonly decomposition: Decomposition
  readonly twins: readonly TwinSet[]
}

// ---- 6. Same shape --------------------------------------------------------------------------

/** A group's form: exact, or not made because the group is too large to try them all. */
export type Form =
  | { readonly kind: 'exact'; readonly canonical: string }
  | { readonly kind: 'too-large'; readonly size: number }

export interface GroupShape {
  readonly group: GroupId
  /** The vertices inside. */
  readonly vertices: readonly VertexRef[]
  readonly form: Form
}

export interface ShapeClass {
  readonly canonical: string
  readonly groups: readonly GroupId[]
}

export interface Shapes {
  /** The largest group, in vertices, whose form is made. */
  readonly limit: number
  readonly shapes: readonly GroupShape[]
  /** The exact forms that more than one group has. */
  readonly same: readonly ShapeClass[]
}

// ---- 7. Orientation ------------------------------------------------------------------------

/** Which way the lines of one plane run, by the pairs of vertices they join. */
export interface Orientation {
  readonly plane: string
  /** What the distances are counted from. */
  readonly outside: readonly VertexRef[]
  /** Lines from the end nearer the outside to the farther one, as [nearer, farther]. */
  readonly above: readonly (readonly [VertexRef, VertexRef])[]
  /** Lines whose ends are as far from the outside as each other. */
  readonly beside: readonly (readonly [VertexRef, VertexRef])[]
}

// ---- 8. Edges of a place -------------------------------------------------------------------

/** What a line leaving a group reaches: a place beside the group, or a vertex. */
export type Beyond = { readonly group: GroupId } | { readonly vertex: VertexRef }

export interface GroupEdge {
  readonly group: GroupId
  readonly unit: UnitId
  readonly toward: readonly Beyond[]
  /** For a folded redundancy set whose nodes reach different places: each node's own. */
  readonly members?: readonly { readonly node: NodeId; readonly toward: readonly Beyond[] }[]
}

// ---- The whole ------------------------------------------------------------------------------

export interface Stages {
  readonly analysis: AnalysisGraph
  readonly units: Units
  readonly planes: readonly PlaneStage[]
  readonly shapes: Shapes
  /** One for each plane, in the order of `planes`. */
  readonly orientations: readonly Orientation[]
  /** Read from the default plane only. */
  readonly edges: readonly GroupEdge[]
}
