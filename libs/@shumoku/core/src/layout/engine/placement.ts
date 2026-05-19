// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * `PlacementPolicy` — manual-placement policy.
 *
 * The editor calls `tryPlace` while the user drags a node:
 * "would this position be valid given the current occupants?"
 * The result is structured so the editor can surface conflicts
 * (which node would collide, by how much) and offer a snapped
 * alternative.
 */

import type { LayoutRules } from './rules.js'
import type {
  Node,
  NodeWithPosition,
  PlacementConflict,
  PlacementResult,
  PortsBySide,
  Position,
  Rect,
} from './types.js'

/**
 * Manual-placement policy. The editor calls these during drag
 * / drop to validate user-chosen positions against the rules.
 */
export interface PlacementPolicy {
  /**
   * Try to place `node` at `pos` given the current occupants.
   * The result is structured so the editor can show why
   * placement is invalid and offer the snapped alternative.
   */
  tryPlace(
    node: Node,
    pos: Position,
    occupants: Iterable<NodeWithPosition>,
    ctx?: { portsBySide?: PortsBySide },
  ): PlacementResult

  /**
   * Snap a position to the policy's grid / alignment. Default
   * is identity (no grid). Editors may install a stricter
   * policy via future config.
   */
  snapTo(pos: Position): Position
}

export function createPlacementPolicy(rules: LayoutRules): PlacementPolicy {
  return {
    tryPlace(node, requested, occupants, ctx) {
      const snapped = this.snapTo(requested)
      const footprint = rules.nodeObstacle(node, snapped, ctx)
      const conflicts: PlacementConflict[] = []
      for (const occ of occupants) {
        const overlap = rectOverlap(footprint, occ.footprint)
        if (overlap) conflicts.push({ withNodeId: occ.id, overlap })
      }
      return {
        valid: conflicts.length === 0,
        requested,
        snapped,
        footprint,
        conflicts,
      }
    },
    snapTo(pos) {
      // Identity for now. Grid / alignment policy can be
      // added when the editor asks for it.
      return { x: pos.x, y: pos.y }
    },
  }
}

/**
 * Axis-aligned-rect overlap region, or null when the two
 * rects don't intersect at all. A zero-area overlap (rects
 * touch but don't cross) returns null — touching is allowed.
 */
function rectOverlap(a: Rect, b: Rect): Rect | null {
  const xMin = Math.max(a.x, b.x)
  const yMin = Math.max(a.y, b.y)
  const xMax = Math.min(a.x + a.width, b.x + b.width)
  const yMax = Math.min(a.y + a.height, b.y + b.height)
  if (xMax <= xMin || yMax <= yMin) return null
  return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin }
}
