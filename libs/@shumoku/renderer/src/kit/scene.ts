// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What the layout hands to drawing: absolute coordinates only. Sizes come from `measure.ts`
 * on the way in; nothing here is computed.
 */

import type { Link, Node, Subgraph } from '@shumoku/core'

// Core has no point type of its own (it uses `Position`); this one is the drawing's.
export interface Point {
  x: number
  y: number
}

/** Top-left corner and size. */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export type Side = 'top' | 'bottom' | 'left' | 'right'

export interface Scene {
  nodes: { node: Node; box: Box }[]
  /**
   * Drawn in order, so outer groups come before the groups inside them. A group is drawn as its
   * `outline`, a rectilinear polygon (clockwise, starting at the top-left corner of its first
   * band) that follows where it stands in each rank; `box` is the box around it, and what is
   * drawn when there is no outline.
   */
  groups: { group: Subgraph; box: Box; outline?: Point[] }[]
  /**
   * A polyline in drawing order, drawn exactly as given. `captionAt` is where the layout put
   * the caption; without it the caption sits at the middle of the line.
   */
  wires: { link: Link; points: Point[]; captionAt?: Point }[]
  ports?: { id: string; nodeId: string; label?: string; at: Point; side: Side }[]
  /** Node ids drawn inside one outline; `kind` (HA, VPC ...) is written on it. */
  hulls?: { members: string[]; kind?: string }[]
  bounds: Box
}
