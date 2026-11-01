// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link } from '../models/types.js'
import type { GroupId, NodeId, RoutingDomainId, SegmentId } from '../structure/types.js'

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

/** Top-left corner and size. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Room a box keeps clear inside its edges. */
export interface Insets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/**
 * Every length the drawing uses, handed in by whoever draws the parts. The drawing names no
 * length of its own: it adds, compares and halves what it is given.
 */
export interface Metrics {
  /** A node's card. */
  card(node: NodeId): Size
  /** A segment's bus, given how many lines end at it. */
  bus(segment: SegmentId, lines: number): Size
  /** A routing domain's cloud. */
  cloud(domain: RoutingDomainId): Size
  /** What a group's frame keeps clear around its contents; the label band is in `top`. */
  group(group: GroupId): Insets
  /** The least space between two neighbouring elements in a layer. */
  gap: number
  /** The space between two members of one redundancy set, which is less than `gap`. */
  memberGap: number
  /** The space between two sibling groups' frames, which is more than `gap`. */
  groupGap: number
  /** Room around the members of a redundancy set inside their outline. */
  hullPad: number
  /**
   * A link's line: the width it is drawn at, and the room it takes across, which is what its
   * neighbours keep off. They differ for a line made of several, such as a double one.
   */
  line(link: Link): { stroke: number; width: number }
  /**
   * The width of the thinnest line there is: the least a width can differ by, and so the least
   * white there is. How near two coordinates must be to count as one place follows from it.
   */
  stroke: number
  /** The white between two lines that part somewhere, and between a line and a box. */
  gapApart: number
  /**
   * The width over the height the whole drawing should come to, a ratio and not a length. The
   * layout narrows the rows that make it too wide only as far as this asks.
   */
  aspect: number
  /** How far a line leaves a card straight before it may turn. */
  leadOut: number
  /**
   * The room one port takes along its card's edge, given the names written beside the ports of
   * the card; a card with more ports than its edge holds at this spacing is widened.
   */
  portSlot(labels: readonly (string | undefined)[]): number
}
