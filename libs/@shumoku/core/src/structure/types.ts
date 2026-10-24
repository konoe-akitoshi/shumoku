// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The structure the written network implies, referring to the network by its written ids. Each
 * stage reads only the stage before it and the written network. Sets the derivation finds
 * (blocks, twins, sides, parts) are named by their members, never by a number handed out in some
 * order, so the same network written in another order, or with one name changed, gives the same
 * structure under the same names.
 */

export type NodeId = string
export type GroupId = string
export type SegmentId = string
export type RedundancyId = string
export type RoutingDomainId = string

/** A unit's id: a redundancy set's, the lowest host's or a single node's. */
export type UnitId = string

/**
 * A vertex of the analysis graph as the later stages name it: `node:<id>` for a node (a unit
 * after stage 2 folds it, `unit:<id>`), `segment:<id>` or `routingDomain:<id>`. The kind keeps
 * a segment or a routing domain from being taken for a node of the same id.
 */
export type VertexRef = string

/** One end of a line: a node and its port when known, or a segment. */
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
  /** The link between its ends, or the membership of a node in a segment. */
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

// ---- 3. Decomposition -----------------------------------------------------------------------

/** A line between two vertices of the unit graph, all the lines between the two together. */
export interface UnitEdge {
  /** The ends, `a` before `b`. */
  readonly a: VertexRef
  readonly b: VertexRef
  /** How many lines there are between them. */
  readonly multiplicity: number
  readonly lines: readonly AnalysisEdge[]
}

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
  /** S goes round a cycle, P hangs between two poles, R is triconnected. */
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
  readonly vertices: readonly VertexRef[]
  readonly edges: readonly UnitEdge[]
  readonly blocks: readonly Block[]
  readonly cutVertices: readonly CutVertex[]
}

// ---- 4. Twins -------------------------------------------------------------------------------

/** Vertices of one kind that have the same neighbours. */
export interface Twins {
  readonly members: readonly VertexRef[]
  readonly neighbours: readonly VertexRef[]
}

// ---- 5. Parts -------------------------------------------------------------------------------

/** Where a candidate for a part came from. */
export type Origin = { readonly kind: 'twins' } | { readonly kind: 'side'; readonly cut: VertexRef }

export interface Candidate {
  readonly members: readonly VertexRef[]
  readonly origins: readonly Origin[]
}

/** A candidate that crosses a group or another candidate, so it is no part. */
export interface Spanning extends Candidate {
  readonly crosses: readonly {
    readonly kind: 'group' | 'candidate'
    /** The group's id, or the other candidate's members. */
    readonly of: GroupId | readonly VertexRef[]
  }[]
}

export interface Part {
  /** Every vertex inside, with those in the parts below. Names the part. */
  readonly members: readonly VertexRef[]
  /** The written groups that hold exactly these members. */
  readonly groups: readonly GroupId[]
  /** The derived candidates that are exactly these members. */
  readonly origins: readonly Origin[]
  /** The vertices inside that no part below holds. */
  readonly own: readonly VertexRef[]
  /** The parts directly below, each by its members. */
  readonly children: readonly (readonly VertexRef[])[]
}

export interface Parts {
  /** Every part but the whole network, which is the root: `root`. */
  readonly parts: readonly Part[]
  /** The vertices and parts at the top level. */
  readonly root: Pick<Part, 'members' | 'own' | 'children'>
  readonly spanning: readonly Spanning[]
}

// ---- 6. Same shape --------------------------------------------------------------------------

/** A part's form: exact, or not made because the part is too large to try them all. */
export type Form =
  | { readonly kind: 'exact'; readonly canonical: string }
  | { readonly kind: 'too-large'; readonly size: number }

export interface PartShape {
  /** The part, by its members. */
  readonly part: readonly VertexRef[]
  readonly form: Form
}

export interface ShapeClass {
  readonly canonical: string
  /** Two or more parts, each by its members. */
  readonly parts: readonly (readonly VertexRef[])[]
}

export interface Shapes {
  /** The largest part whose form is made. */
  readonly limit: number
  readonly shapes: readonly PartShape[]
  /** The exact forms that more than one part has. */
  readonly same: readonly ShapeClass[]
}

// ---- The whole ------------------------------------------------------------------------------

export interface Structure {
  readonly analysis: AnalysisGraph
  readonly units: Units
  readonly decomposition: Decomposition
  readonly twins: readonly Twins[]
  readonly parts: Parts
  readonly shapes: Shapes
}
