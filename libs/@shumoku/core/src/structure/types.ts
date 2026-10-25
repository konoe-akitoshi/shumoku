// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The structure the written network implies: what the configuration does not say but follows
 * from it. It refers to the configuration by its ids only (nodes, groups, segments, routing
 * domains, redundancy sets), never to a line, and coins no name of its own, so the same network
 * written in another order, or with one name changed, gives the same structure under the same
 * names.
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

export interface Plane {
  /** `default`, or the id of a routing domain. */
  readonly plane: string
  /** The lines with a cable of their own (`physical`), or the virtual ones. */
  readonly side: 'physical' | 'virtual'
  /**
   * The lines as [nearer, farther]: the end nearer a given boundary point first. Each side is
   * measured by its own lines, of every plane together; a virtual line laid over the network's
   * own cables is on neither. Empty when no boundary is given. Where a line is drawn is the
   * reader's choice.
   */
  readonly flows: readonly (readonly [Vertex, Vertex])[]
  /** The lines whose ends are as near the boundary points as each other. */
  readonly even: readonly (readonly [Vertex, Vertex])[]
}

export interface Structure {
  /** Only the nodes that fold into a unit with another id. */
  readonly nodes: Readonly<Record<NodeId, { readonly unit: UnitId }>>
  /** Where the physical may meet the virtual: the vertices with lines on both sides. */
  readonly candidates: readonly Vertex[]
  /** The boundary points that were given, which `flows` and `even` are measured from. */
  readonly boundary: readonly Vertex[]
  readonly planes: readonly Plane[]
}
