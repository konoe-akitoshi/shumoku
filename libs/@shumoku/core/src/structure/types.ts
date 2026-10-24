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

/** A part that cannot be cut: a lone vertex, the only way between two vertices, or a tangle. */
export interface Block {
  readonly members: readonly Vertex[]
  /** Left out when the block has fewer than three members. */
  readonly shape?: readonly ShapePiece[]
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
  /** The vertices that split the plane's graph when taken out. */
  readonly cuts: readonly Vertex[]
  readonly blocks: readonly Block[]
  readonly twins: readonly Twins[]
}

export interface Structure {
  /** Only the nodes that fold into a unit with another id. */
  readonly nodes: Readonly<Record<NodeId, { readonly unit: UnitId }>>
  readonly planes: readonly Plane[]
  /** Sets of two or more written groups whose insides have the same form. */
  readonly same: readonly (readonly GroupId[])[]
}
