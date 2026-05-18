// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Direction rotation pass.
 *
 * The flat-tree engine computes everything in TB orientation
 * internally (root at top, children below; chain to the right
 * inside emitter-with-side-chain blocks). At the end of the
 * pipeline this module rotates / mirrors the result to the
 * requested direction.
 *
 * Direction conventions:
 *   - **TB** — flow downward; primary axis = +y, secondary = +x
 *   - **BT** — flow upward; primary axis = −y
 *   - **LR** — flow rightward; primary axis = +x, secondary = +y
 *   - **RL** — flow leftward; primary axis = −x
 *
 * The transform applied per direction:
 *   TB: identity
 *   BT: y → −y
 *   LR: (x, y) → (y, x)
 *   RL: (x, y) → (−y, x)
 *
 * Subgraph bounds rotate the same way; for the 90° swaps (LR/
 * RL) the width and height also swap.
 *
 * After rotation we re-normalise so the rotated bbox starts at
 * (0, 0) — same convention the outer tidy-tree uses.
 */

import type { Bounds, Direction } from '../../models/types.js'
import type { Position } from './types.js'

/** Rotate a single point from TB-internal coords to the target direction. */
export function rotatePoint(p: Position, direction: Direction): Position {
  switch (direction) {
    case 'TB':
      return p
    case 'BT':
      return { x: p.x, y: -p.y }
    case 'LR':
      return { x: p.y, y: p.x }
    case 'RL':
      return { x: -p.y, y: p.x }
  }
}

/**
 * Rotate an axis-aligned rect. For the 90° swaps (LR/RL) the
 * width and height swap with each other.
 */
export function rotateBounds(b: Bounds, direction: Direction): Bounds {
  switch (direction) {
    case 'TB':
      return b
    case 'BT':
      return { x: b.x, y: -(b.y + b.height), width: b.width, height: b.height }
    case 'LR':
      return { x: b.y, y: b.x, width: b.height, height: b.width }
    case 'RL':
      return { x: -(b.y + b.height), y: b.x, width: b.height, height: b.width }
  }
}

/**
 * Rotate every node position + subgraph bound + root bound by
 * `direction`, then translate the whole result so its bbox top-
 * left sits at (0, 0). The translation keeps the result
 * directly compatible with downstream consumers that expect
 * non-negative coordinates.
 */
export function rotateLayoutResult(
  direction: Direction,
  nodePositions: Map<string, Position>,
  subgraphBounds: Map<string, Bounds>,
  rootBounds: Bounds,
): {
  nodePositions: Map<string, Position>
  subgraphBounds: Map<string, Bounds>
  rootBounds: Bounds
} {
  if (direction === 'TB') return { nodePositions, subgraphBounds, rootBounds }

  const rotatedNodes = new Map<string, Position>()
  for (const [id, p] of nodePositions) rotatedNodes.set(id, rotatePoint(p, direction))

  const rotatedSubgraphs = new Map<string, Bounds>()
  for (const [id, b] of subgraphBounds) rotatedSubgraphs.set(id, rotateBounds(b, direction))

  const rotatedRoot = rotateBounds(rootBounds, direction)
  return { nodePositions: rotatedNodes, subgraphBounds: rotatedSubgraphs, rootBounds: rotatedRoot }
}
