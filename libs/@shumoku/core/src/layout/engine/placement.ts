// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * `PlacementPolicy` — manual-placement policy.
 *
 * The editor uses these during drag / drop and add-node flows:
 *   - `tryPlace` validates a candidate position and reports
 *     conflicts.
 *   - `resolvePosition` finds the nearest non-overlapping spot
 *     by sliding the candidate against obstacles. Used during
 *     drag so the dropped node doesn't end up on top of
 *     another.
 *   - `snapTo` aligns to a grid (default identity).
 *
 * All three live on the engine so the editor and the layout
 * algorithm consult the *same* spatial rules.
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

/** Minimum gap (px) between two obstacles after a collision resolve. */
const DEFAULT_GAP = 8

/**
 * Manual-placement policy. The editor calls these during drag
 * / drop to validate user-chosen positions against the rules.
 */
export interface PlacementPolicy {
  /**
   * Try to place `node` at `pos` given the current occupants.
   * Reports validity + conflicts so the editor can surface
   * "would overlap with X" feedback. Does NOT slide the
   * requested position — use `resolvePosition` for that.
   */
  tryPlace(
    node: Node,
    pos: Position,
    occupants: Iterable<NodeWithPosition>,
    ctx?: { portsBySide?: PortsBySide },
  ): PlacementResult

  /**
   * Resolve a requested position to the nearest non-
   * overlapping position by sliding against occupants.
   * Returns the resolved position; the input is returned
   * unchanged when it's already free.
   */
  resolvePosition(
    node: Node,
    requested: Position,
    occupants: Iterable<NodeWithPosition>,
    ctx?: { portsBySide?: PortsBySide; gap?: number },
  ): Position

  /**
   * Pure geometric resolve: given a moving rect and a list of
   * obstacle rects, return the nearest non-overlapping
   * position. Used by callers that have already collected
   * obstacles themselves.
   */
  resolveAgainstObstacles(
    rect: { x: number; y: number; w: number; h: number },
    obstacles: { x: number; y: number; w: number; h: number }[],
    gap?: number,
  ): Position

  /**
   * Pure geometric conflict check: given a candidate rect and
   * a list of obstacles tagged with ids, return the ids of
   * obstacles whose rect overlaps the candidate (with `gap`).
   * Symmetric to `resolveAgainstObstacles` — same predicate,
   * different return shape. Used by drag-time UI to highlight
   * which neighbour is being bumped.
   */
  findConflicts(
    rect: { x: number; y: number; w: number; h: number },
    obstacles: { id: string; rect: { x: number; y: number; w: number; h: number } }[],
    gap?: number,
  ): string[]

  /**
   * Snap a position to the policy's grid / alignment. Default
   * is identity (no grid). Editors may install a stricter
   * policy via future config.
   */
  snapTo(pos: Position): Position
}

/** True iff two centre-based rects overlap with a gap. */
function rectsOverlapCenter(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number,
): boolean {
  return (
    a.x - a.w / 2 - gap < b.x + b.w / 2 &&
    a.x + a.w / 2 + gap > b.x - b.w / 2 &&
    a.y - a.h / 2 - gap < b.y + b.h / 2 &&
    a.y + a.h / 2 + gap > b.y - b.h / 2
  )
}

/**
 * Push `moving` to the nearest of the four escape directions
 * (left/right/up/down of `obstacle`) given a clearance `gap`.
 */
function resolveOne(
  moving: { x: number; y: number; w: number; h: number },
  obstacle: { x: number; y: number; w: number; h: number },
  gap: number,
): { x: number; y: number } {
  const escapes = [
    { x: obstacle.x - obstacle.w / 2 - moving.w / 2 - gap, y: moving.y },
    { x: obstacle.x + obstacle.w / 2 + moving.w / 2 + gap, y: moving.y },
    { x: moving.x, y: obstacle.y - obstacle.h / 2 - moving.h / 2 - gap },
    { x: moving.x, y: obstacle.y + obstacle.h / 2 + moving.h / 2 + gap },
  ]
  let best = escapes[0] ?? { x: moving.x, y: moving.y }
  let bestDist = Number.POSITIVE_INFINITY
  for (const esc of escapes) {
    const dist = Math.hypot(esc.x - moving.x, esc.y - moving.y)
    if (dist < bestDist) {
      bestDist = dist
      best = esc
    }
  }
  return best
}

export function createPlacementPolicy(rules: LayoutRules): PlacementPolicy {
  const self: PlacementPolicy = {
    tryPlace(node, requested, occupants, ctx) {
      const snapped = self.snapTo(requested)
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
    resolvePosition(node, requested, occupants, ctx) {
      const size = rules.nodeFootprint(node, ctx)
      const obstacles: { x: number; y: number; w: number; h: number }[] = []
      for (const occ of occupants) {
        obstacles.push({
          x: occ.position.x,
          y: occ.position.y,
          w: occ.footprint.width,
          h: occ.footprint.height,
        })
      }
      return self.resolveAgainstObstacles(
        { x: requested.x, y: requested.y, w: size.width, h: size.height },
        obstacles,
        ctx?.gap,
      )
    },
    resolveAgainstObstacles(rect, obstacles, gap = DEFAULT_GAP) {
      let fx = rect.x
      let fy = rect.y
      for (const obs of obstacles) {
        const moving = { x: fx, y: fy, w: rect.w, h: rect.h }
        if (rectsOverlapCenter(moving, obs, gap)) {
          const resolved = resolveOne(moving, obs, gap)
          fx = resolved.x
          fy = resolved.y
        }
      }
      return { x: fx, y: fy }
    },
    findConflicts(rect, obstacles, gap = DEFAULT_GAP) {
      const blocked: string[] = []
      for (const obs of obstacles) {
        if (rectsOverlapCenter(rect, obs.rect, gap)) blocked.push(obs.id)
      }
      return blocked
    },
    snapTo(pos) {
      // Identity for now. Grid / alignment policy can be
      // added when the editor asks for it.
      return { x: pos.x, y: pos.y }
    },
  }
  return self
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
