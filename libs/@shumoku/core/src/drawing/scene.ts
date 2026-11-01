// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link, Node, Subgraph } from '../models/types.js'
import type { Box, Point } from './metrics.js'

export type Side = 'top' | 'bottom' | 'left' | 'right'

/**
 * What the layout hands to drawing: absolute coordinates only. Sizes come from the kit on the way
 * in; nothing here is computed. The renderer's kit draws exactly this.
 */
export interface Scene {
  nodes: { node: Node; box: Box }[]
  /** Drawn in order, so outer groups come before the groups inside them. */
  groups: { group: Subgraph; box: Box }[]
  /**
   * A polyline in drawing order, drawn exactly as given. `stroke` is the width the line is
   * drawn at; `width` is the room it takes across, which is what the layout kept free for it
   * (more than `stroke` for a line made of several, such as a double one).
   */
  wires: { link: Link; points: Point[]; radii: number[]; stroke: number; width: number }[]
  /** Where a line's chamfer meets a straight run it shares with other lines (the mouth of a band). */
  marks: Mark[]
  ports?: { id: string; nodeId: string; label?: string; at: Point; side: Side }[]
  /** Node ids drawn inside one outline; `kind` (HA, VPC ...) is written on it; `box` is the outline. */
  hulls?: { members: string[]; kind?: string; box?: Box }[]
  bounds: Box
}

/**
 * The mouth of a band: the vertex where a line's 45° chamfer meets a straight run that other
 * lines run beside at their pitch. `along` is the run's direction (unit, axis-parallel), `across`
 * its normal; `band.near`/`band.far` are the offsets across (signed, along `across`) of the
 * farthest neighbours; `run` is the stretch of the run the neighbours share; `members` the lines
 * in the band there, this one first. The kit decides how (and whether) to draw it.
 */
export interface Mark {
  line: string
  /** The line's link and the width it is drawn at, for the mark to take its colour and size from. */
  link: Link
  stroke: number
  kind: 'join' | 'leave'
  at: Point
  along: Point
  across: Point
  band: { near: number; far: number }
  run: { from: Point; to: Point }
  members: string[]
}
