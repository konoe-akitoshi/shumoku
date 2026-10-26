// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

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
 * What a platform (hosts and the nodes that run on them) is drawn as. The positions are from the
 * platform's top-left corner.
 */
export interface PlatformLayout {
  /** Everything it takes up: the card or frame, and the outlines stacked behind it. */
  readonly size: Size
  /** The card or frame the wires end at. */
  readonly card: Box
  /** Outlines behind the card that say "several hosts", farthest first; none for one host. */
  readonly stack: readonly Box[]
  /** Where the nodes that run on the hosts are drawn inside the frame, in the order given. */
  readonly nested: readonly Box[]
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
  /**
   * A platform: a card for its hosts, with what runs on them counted or nested inside, given
   * how many lines end at it (each ends at a port named by its host, which needs room).
   */
  platform(
    label: string,
    hosts: readonly NodeId[],
    workloads: readonly NodeId[],
    lines: number,
  ): PlatformLayout
  /** What a group's frame keeps clear around its contents; the label band is in `top`. */
  group(group: GroupId): Insets
  /** The least space between two neighbouring elements in a rank. */
  gap: number
  /** The space between two members of one redundancy set, which is less than `gap`. */
  memberGap: number
  /** The space between two sibling groups' frames, which is more than `gap`. */
  groupGap: number
  /** Room around the members of a redundancy set inside their outline. */
  hullPad: number
  /** The distance between two lines that run side by side. */
  pitch: number
  /** How far a line leaves a card straight before it may turn. */
  leadOut: number
}
