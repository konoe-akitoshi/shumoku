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
  /**
   * The lines that run from one end to the other, counted from the plane's outside (its
   * vertices with no place, and the vertices it shares with another plane, from as far as they
   * are from that plane's outside), as [nearer, farther].
   * A virtual line counts as longer than any way over cables.
   */
  readonly above: readonly (readonly [Vertex, Vertex])[]
  /** The lines whose ends are as far from the outside as each other. */
  readonly beside: readonly (readonly [Vertex, Vertex])[]
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
  /** About the default plane. */
  readonly edges: readonly Edge[]
}
