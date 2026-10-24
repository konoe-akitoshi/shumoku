// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The structure the written network implies: what the configuration does not say but follows
 * from it. It refers to the configuration by its ids only (nodes, groups, segments, routing
 * domains, redundancy sets), never to a line, and coins no name of its own. Sets the derivation
 * finds are named by their members, so the same network written in another order, or with one
 * name changed, gives the same structure under the same names.
 */

export type NodeId = string
export type GroupId = string
export type SegmentId = string
export type RedundancyId = string
export type RoutingDomainId = string

/** A unit's id: a redundancy set's, the lowest host's or a single node's. */
export type UnitId = string

/** A vertex of the structure: a unit, or a segment or a routing domain a line ends at. */
export type Vertex =
  | { readonly unit: UnitId }
  | { readonly segment: SegmentId }
  | { readonly routingDomain: RoutingDomainId }

/** One piece of a block of three or more vertices: S goes round, P hangs between poles, R is rigid. */
export type ShapePiece =
  | { readonly S: readonly Vertex[] }
  | { readonly P: readonly [Vertex, Vertex] }
  | { readonly R: readonly Vertex[] }

/** A part that cannot be cut and has three or more vertices: a tangle, with its form. */
export interface Block {
  readonly members: readonly Vertex[]
  readonly shape: readonly ShapePiece[]
}

/** Vertices of one kind that touch the same vertices. */
export interface Twins {
  readonly members: readonly Vertex[]
  /** The neighbours they share, not counting each other. */
  readonly with: readonly Vertex[]
  /** The members touch each other too (same closed neighbourhood), not only the same others. */
  readonly adjacent: boolean
}

export interface Plane {
  /** `default`, or the id of a routing domain. */
  readonly plane: string
  /** Blocks of three or more vertices; a single line or a lone vertex is not listed. */
  readonly blocks: readonly Block[]
  readonly twins: readonly Twins[]
}

/** A place where the network meets what lies outside it, and what it meets. */
export interface Entrance {
  readonly vertex: Vertex
  readonly toward: readonly Vertex[]
}

/** The frame that joins the entrances. */
export interface Trunk {
  readonly vertices: readonly Vertex[]
  /** The blocks of three or more vertices in it, each by its members. */
  readonly blocks: readonly (readonly Vertex[])[]
}

/** A written thing that a branch holds whole. */
export type Destination =
  | { readonly group: GroupId }
  | { readonly segment: SegmentId }
  | { readonly routingDomain: RoutingDomainId }

/**
 * What hangs off a fork (a vertex of the trunk, or of another branch) through one block: `via`
 * are the vertices it first reaches. The order of sibling branches carries no meaning.
 */
export interface Branch {
  readonly at: Vertex
  readonly via: readonly Vertex[]
  /** The Strahler number counted away from the trunk; twins count as one. */
  readonly order: number
  readonly holds: readonly Destination[]
  readonly branches: readonly Branch[]
}

/** A group's edge: a unit inside it with a line leaving it, and what that reaches. */
export interface Edge {
  readonly group: GroupId
  readonly unit: UnitId
  /** The place beside the group that holds the other end, or the other end itself. */
  readonly toward: readonly ({ readonly group: GroupId } | Vertex)[]
  /** Set when the nodes of a folded redundancy set reach different places. */
  readonly members?: readonly {
    readonly node: NodeId
    readonly toward: readonly ({ readonly group: GroupId } | Vertex)[]
  }[]
}

export interface Structure {
  /** Only the nodes that fold into a unit with another id. */
  readonly nodes: Readonly<Record<NodeId, { readonly unit: UnitId }>>
  readonly planes: readonly Plane[]
  /** Sets of two or more written groups whose insides have the same form. */
  readonly same: readonly (readonly GroupId[])[]
  /** The following four are about the default plane. */
  readonly entrances: readonly Entrance[]
  /** Left out when there is none. */
  readonly trunk?: Trunk
  readonly branches: readonly Branch[]
  readonly edges: readonly Edge[]
}
