// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { Position } from '@xyflow/svelte'

export type TerminationRole = 'outlet' | 'eps' | 'panel'
export type WithTermination = { termination?: { role: TerminationRole } }

/**
 * Pixel dimensions of a SceneNode for its role. Devices are larger
 * pins; termination points (outlet / EPS / panel) are role-specific
 * smaller glyphs. Returned width/height match what `SceneNode.svelte`
 * actually renders, so callers can compute correct centers, hit
 * areas, and wire endpoint anchors without re-deriving sizes.
 */
export function sceneNodeSize(node: WithTermination | undefined): { w: number; h: number } {
  const role = node?.termination?.role
  if (role === 'outlet') return { w: 20, h: 20 }
  if (role === 'eps') return { w: 16, h: 24 }
  if (role === 'panel') return { w: 32, h: 16 }
  return { w: 36, h: 36 }
}

/**
 * Turn a direction vector (from a node toward its peer) into the
 * side of the node a wire should exit through. Whichever axis
 * dominates wins, so wires come out of the side that faces the
 * peer instead of always exiting the top.
 *
 * The return value is a Svelte Flow `Position` — it doubles as both
 * a `sourceHandle` / `targetHandle` id (since our SceneNode handle
 * ids match the Position values) and a `sourcePosition` /
 * `targetPosition` for `getSmoothStepPath`.
 */
export function pickSideForDirection(dx: number, dy: number): Position {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left
  return dy >= 0 ? Position.Bottom : Position.Top
}
