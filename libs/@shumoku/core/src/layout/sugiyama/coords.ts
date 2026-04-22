// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Coordinate assignment for Sugiyama-style layered layout.
 *
 * Given ordered layers (after crossing reduction) and per-node sizes,
 * compute an absolute (x, y) for each node. We use a simple
 * center-of-layer approach:
 *
 *   - Stack layers along the secondary axis (y for TB/BT, x for LR/RL),
 *     spaced by `layerGap`. Each layer's thickness matches its tallest
 *     (or widest, for LR/RL) node.
 *   - Within each layer, place nodes left-to-right using each node's own
 *     width + `nodeGap` gaps, then shift the whole layer so it's centred
 *     around 0 on the primary axis.
 *
 * This is cruder than Brandes-Köpf's four-alignment averaging but
 * produces readable layouts for sparse network topologies and is
 * O(V + E). Brandes-Köpf can be dropped in later without touching the
 * callers.
 *
 * Direction handling rotates the output after the TB computation —
 * keeps the core layout code simple and gives identical crossing
 * metrics across directions.
 */

import type { LayerAssignment, NodeId } from './types.js'

export type Direction = 'TB' | 'BT' | 'LR' | 'RL'

export interface NodeSize {
  width: number
  height: number
}

export interface AssignCoordinatesOptions {
  /** Gap between adjacent layers. */
  layerGap?: number
  /** Gap between sibling nodes in the same layer. */
  nodeGap?: number
  /** Per-node sizes. Missing entries fall back to `defaultSize`. */
  sizes?: Map<NodeId, NodeSize>
  /** Fallback size when `sizes` is absent or lacks an entry. */
  defaultSize?: NodeSize
  /** Which way the edges flow. Defaults to TB. */
  direction?: Direction
}

export interface Position {
  x: number
  y: number
}

/**
 * Compute absolute centre positions for every node in the layer
 * assignment. The returned map is keyed by NodeId and independent of
 * the input (safe to mutate).
 */
export function assignCoordinates(
  layerAssignment: LayerAssignment,
  options: AssignCoordinatesOptions = {},
): Map<NodeId, Position> {
  const layerGap = options.layerGap ?? 60
  const nodeGap = options.nodeGap ?? 40
  const sizes = options.sizes ?? new Map<NodeId, NodeSize>()
  const defaultSize = options.defaultSize ?? { width: 160, height: 60 }
  const direction: Direction = options.direction ?? 'TB'

  const sizeOf = (n: NodeId) => sizes.get(n) ?? defaultSize

  // First compute TB-style coords (layers stacked top-to-bottom,
  // nodes within a layer left-to-right). Rotate at the end for other
  // directions so we keep a single layout path.
  const tbPositions = new Map<NodeId, Position>()

  let yCursor = 0
  for (const layer of layerAssignment.layers) {
    // Lay out nodes in the layer left-to-right, accumulating widths.
    const xs: number[] = []
    let xCursor = 0
    for (const n of layer) {
      const { width } = sizeOf(n)
      xs.push(xCursor + width / 2)
      xCursor += width + nodeGap
    }
    // Total span (minus the trailing gap) → shift to centre at 0.
    const span = layer.length === 0 ? 0 : xCursor - nodeGap
    const shiftX = -span / 2
    // Layer thickness = tallest node in the layer.
    const layerHeight = layer.reduce((h, n) => Math.max(h, sizeOf(n).height), 0)

    for (const [i, n] of layer.entries()) {
      const x = (xs[i] ?? 0) + shiftX
      const y = yCursor + layerHeight / 2
      tbPositions.set(n, { x, y })
    }

    yCursor += layerHeight + layerGap
  }

  if (direction === 'TB') return tbPositions

  // Rotate / flip.
  const result = new Map<NodeId, Position>()
  for (const [id, { x, y }] of tbPositions) {
    switch (direction) {
      case 'BT':
        result.set(id, { x, y: -y })
        break
      case 'LR':
        result.set(id, { x: y, y: x })
        break
      case 'RL':
        result.set(id, { x: -y, y: x })
        break
    }
  }
  return result
}
