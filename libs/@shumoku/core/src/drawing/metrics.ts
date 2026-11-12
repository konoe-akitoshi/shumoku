// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link } from '../models/types.js'
import type { GroupId, NodeId, RoutingDomainId, SegmentId } from '../structure/types.js'

/** An edge of a box. */
export type PortSide = 'top' | 'bottom' | 'left' | 'right'

/** How one port's name is shown: the text, the room its chip takes, and the row it stands in. */
export interface PortLabelSpec {
  /** What is written in the chip; `''` for a port with no name. */
  readonly text: string
  readonly width: number
  readonly height: number
  /** On a top or bottom edge, the row a chip stands in: 0 beside the box, 1 beyond it. */
  readonly row: 0 | 1
}

/**
 * What one edge of a box needs for the names of its ports, in the order the ports stand along it.
 * The least distance between two ports' centres is `min`, for the pair `from` and `to` (indices
 * into `labels`, `to - from` 1 or 2).
 */
export interface PortSideLayout {
  readonly labels: readonly PortLabelSpec[]
  /** The shared start of the names, written once at the start of the edge instead of on each chip. */
  readonly caption?: { readonly text: string; readonly width: number }
  readonly gaps: readonly { readonly from: number; readonly to: number; readonly min: number }[]
  /** The least from the first port's centre to the start of the edge, and from the last to the end. */
  readonly leadMargin: number
  readonly trailMargin: number
  /** How far the names reach out from the edge. */
  readonly depth: number
}

/** A box and the names of the ports on each of its edges, in the order along the edge. */
export interface PortBox {
  readonly bodyWidth: number
  readonly bodyHeight: number
  readonly sides: Readonly<Record<PortSide, readonly { readonly name?: string }[]>>
}

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
  /** The width a link's line is drawn at, which is also the room it takes across: what its neighbours keep off. */
  line(link: Link): number
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
   * How the names of a box's ports are shown and what room they take along each edge, from the
   * ports the layout has put on it. The edge is lengthened to hold what this asks; the layout
   * decides nothing about the text.
   */
  portSides(box: PortBox): Record<PortSide, PortSideLayout>
}
