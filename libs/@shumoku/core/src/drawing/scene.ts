// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link, Node, Subgraph } from '../models/types.js'
import type { Box, Point } from './metrics.js'

export type Side = 'top' | 'bottom' | 'left' | 'right'

/**
 * What the layout hands to drawing: absolute coordinates only. It has the same shape as the
 * renderer kit's scene; core cannot depend on the renderer, so the shape is stated here too.
 */
export interface Scene {
  nodes: { node: Node; box: Box }[]
  /** Drawn in order, so outer groups come before the groups inside them. */
  groups: { group: Subgraph; box: Box; outline?: Point[] }[]
  /**
   * A polyline in drawing order, drawn exactly as given. `captionAt` is where the layout put
   * the caption; without it the caption sits at the middle of the line.
   */
  wires: { link: Link; points: Point[]; captionAt?: Point; width?: number }[]
  ports?: { id: string; nodeId: string; label?: string; at: Point; side: Side }[]
  /** Node ids drawn inside one outline; `kind` (HA, VPC ...) is written on it; `box` is the outline. */
  hulls?: { members: string[]; kind?: string; box?: Box }[]
  bounds: Box
}
