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
  /** A polyline in drawing order, drawn exactly as given at `stroke`, which is also the room it takes across; `label` is where its caption sits. */
  wires: { link: Link; points: Point[]; radii: number[]; stroke: number; label: Point }[]
  /** The ports drawn on the cards' edges, with the side each faces. */
  ports?: { id: string; nodeId: string; label?: string; at: Point; side: Side }[]
  /**
   * Node ids drawn inside one outline, left to right; `kind` (HA, VPC ...) is written on it. `box` is
   * the outline, `boxes` the members' cards and `seams` the heights at which the wires between
   * neighbours cross, which the outline is shaped round.
   */
  hulls?: { members: string[]; kind?: string; box?: Box; boxes: Box[]; seams: number[] }[]
  bounds: Box
}
