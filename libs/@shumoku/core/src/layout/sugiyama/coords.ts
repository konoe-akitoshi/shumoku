// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Coordinate assignment for Sugiyama-style layered layout.
 *
 * Given ordered layers (after crossing reduction) and per-node sizes,
 * compute absolute (x, y) for every node.
 *
 * The y axis is the easy part: stack layers along the secondary axis
 * with `layerGap` spacing, each layer's thickness matching its tallest
 * node.
 *
 * The x axis has two modes:
 *
 *   - **Barycenter-aligned (default when `edges` are supplied).**
 *     Each non-source node's preferred x is the mean x of its
 *     predecessors in the layer above. A single forward (left-
 *     anchored) pack would put the first sibling at its preferred x
 *     and shove later siblings right — so two children of the same
 *     parent end up with one under the parent and one off to the
 *     side. Running both a forward and a backward (right-anchored)
 *     pack and averaging the two produces the visually balanced
 *     "siblings centred around their shared parent" result while
 *     still snapping single-parent children directly under their
 *     parent. This is the same trick Brandes-Köpf uses with four
 *     alignments, reduced to two passes.
 *
 *   - **Centred (fallback when no edges).**
 *     Layer is laid out left-to-right and shifted so its span
 *     straddles x = 0. Used for the top layer (no predecessors) and
 *     when the caller doesn't provide connectivity.
 *
 * Both averaging inputs are individually valid non-overlapping
 * layouts, so their average is too: for adjacent nodes `a`, `b`, the
 * gap constraint holds in each input, and linearity preserves it
 * under averaging.
 *
 * Direction handling rotates the output after the TB computation —
 * keeps the core layout code as a single implementation.
 */

import type { Direction, Position, Size } from '../../models/types.js'
import type { Edge, LayerAssignment, NodeId } from './types.js'

export interface AssignCoordinatesOptions {
  /** Gap between adjacent layers. */
  layerGap?: number
  /** Gap between sibling nodes in the same layer. */
  nodeGap?: number
  /** Per-node sizes. Missing entries fall back to `defaultSize`. */
  sizes?: Map<NodeId, Size>
  /** Fallback size when `sizes` is absent or lacks an entry. */
  defaultSize?: Size
  /** Which way the edges flow. Defaults to TB. */
  direction?: Direction
  /**
   * Edges between nodes in the layered graph. When supplied, each
   * non-source node is placed near the mean x of its predecessors in
   * the layer above (barycenter alignment). Falling back to centred
   * layout when absent keeps unit tests that only care about a single
   * layer unchanged.
   */
  edges?: Edge[]
  /**
   * Soft per-node x hints. When a node has an entry, the forward and
   * backward packs both treat it as the node's preferred x — packed
   * against neighbours in the usual way but anchored at the hint
   * instead of the barycenter of its parents. Hints win over parent-
   * derived preferences when both exist. The `y` field of the hint is
   * **ignored**: layer assignment already owns the secondary axis.
   *
   * Hints are interpreted in whatever coordinate system the caller
   * supplied; inside `layoutCompound` that's each container's local
   * frame, so global-coord hints for deeply nested nodes won't land
   * where you'd expect. Use hard-pinning (`fixed`) for that case.
   */
  hints?: Map<NodeId, { x: number }>
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
  const sizes = options.sizes ?? new Map<NodeId, Size>()
  const defaultSize = options.defaultSize ?? { width: 160, height: 60 }
  const direction: Direction = options.direction ?? 'TB'
  const sizeOf = (n: NodeId) => sizes.get(n) ?? defaultSize

  // Predecessor lookup for barycenter refinement. Built once.
  const preds = new Map<NodeId, NodeId[]>()
  if (options.edges) {
    for (const e of options.edges) {
      if (e.source === e.target) continue
      const list = preds.get(e.target)
      if (list) list.push(e.source)
      else preds.set(e.target, [e.source])
    }
  }

  // Layer y up front so barycenter doesn't need to recompute it.
  const layerYCenter: number[] = []
  let yCursor = 0
  for (const layer of layerAssignment.layers) {
    const layerHeight = layer.reduce((h, n) => Math.max(h, sizeOf(n).height), 0)
    layerYCenter.push(yCursor + layerHeight / 2)
    yCursor += layerHeight + layerGap
  }

  const tbPositions = new Map<NodeId, Position>()

  if (!options.edges) {
    // No connectivity → centred layout per layer (the original simple
    // algorithm). Used by unit tests that exercise `assignCoordinates`
    // in isolation and by layers that happen to be edgeless.
    for (const [i, layer] of layerAssignment.layers.entries()) {
      const y = layerYCenter[i] ?? 0
      const xs = centredLayer(layer, sizeOf, nodeGap)
      for (const [j, n] of layer.entries()) {
        tbPositions.set(n, { x: xs[j] ?? 0, y })
      }
    }
  } else {
    // Two passes: forward (left-anchored) and backward (right-anchored),
    // then average. Layer 0 is centred in both passes (no predecessors),
    // so it stays centred after averaging.
    const forwardByLayer: Map<NodeId, number>[] = []
    const backwardByLayer: Map<NodeId, number>[] = []

    for (const [i, layer] of layerAssignment.layers.entries()) {
      const y = layerYCenter[i] ?? 0
      if (i === 0) {
        const xs = centredLayer(layer, sizeOf, nodeGap)
        const m = new Map<NodeId, number>()
        for (const [j, n] of layer.entries()) m.set(n, xs[j] ?? 0)
        forwardByLayer.push(m)
        backwardByLayer.push(new Map(m))
        for (const n of layer) tbPositions.set(n, { x: m.get(n) ?? 0, y })
        continue
      }

      const forwardX = forwardPack(layer, preds, forwardByLayer, sizeOf, nodeGap, options.hints)
      const backwardX = backwardPack(layer, preds, backwardByLayer, sizeOf, nodeGap, options.hints)
      forwardByLayer.push(forwardX)
      backwardByLayer.push(backwardX)
      for (const n of layer) {
        const fx = forwardX.get(n) ?? 0
        const bx = backwardX.get(n) ?? 0
        tbPositions.set(n, { x: (fx + bx) / 2, y })
      }
    }
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

/**
 * Lay out a single layer left-to-right and shift so its span is
 * centred on x = 0. Returns the per-node centre x, in the same order
 * as `layer`.
 */
function centredLayer(layer: NodeId[], sizeOf: (n: NodeId) => Size, nodeGap: number): number[] {
  const xs: number[] = []
  let xCursor = 0
  for (const n of layer) {
    const { width } = sizeOf(n)
    xs.push(xCursor + width / 2)
    xCursor += width + nodeGap
  }
  const span = layer.length === 0 ? 0 : xCursor - nodeGap
  const shiftX = -span / 2
  return xs.map((x) => x + shiftX)
}

/**
 * Preferred x for a node, priority:
 *   1. Hint (explicit caller override)
 *   2. Barycenter of its predecessors in the layers above
 *   3. undefined (packing fallback takes over)
 */
function preferredX(
  node: NodeId,
  preds: Map<NodeId, NodeId[]>,
  layerX: Map<NodeId, number>[],
  hints: Map<NodeId, { x: number }> | undefined,
): number | undefined {
  const hint = hints?.get(node)
  if (hint !== undefined) return hint.x

  const parents = preds.get(node) ?? []
  if (parents.length === 0) return undefined
  let sum = 0
  let count = 0
  for (const p of parents) {
    // Walk layers from most recent back to find the predecessor. In
    // a proper Sugiyama DAG, preds live in the immediately-preceding
    // layer, but walking lets us tolerate skipped layers if they show
    // up later.
    for (let li = layerX.length - 1; li >= 0; li--) {
      const map = layerX[li]
      if (!map) continue
      const x = map.get(p)
      if (x !== undefined) {
        sum += x
        count++
        break
      }
    }
  }
  if (count === 0) return undefined
  return sum / count
}

/**
 * Forward (left-anchored) pack. Each node's x is the max of its
 * preferred x and the leftmost it can sit without overlapping the
 * previous node's right edge + nodeGap.
 */
function forwardPack(
  layer: NodeId[],
  preds: Map<NodeId, NodeId[]>,
  previousLayers: Map<NodeId, number>[],
  sizeOf: (n: NodeId) => Size,
  nodeGap: number,
  hints: Map<NodeId, { x: number }> | undefined,
): Map<NodeId, number> {
  const out = new Map<NodeId, number>()
  let prevRight = Number.NEGATIVE_INFINITY
  for (const [j, n] of layer.entries()) {
    const { width } = sizeOf(n)
    const pref = preferredX(n, preds, previousLayers, hints)
    const minX = j === 0 ? Number.NEGATIVE_INFINITY : prevRight + nodeGap + width / 2
    const desired = pref ?? minX
    const x = desired < minX ? minX : desired
    out.set(n, x)
    prevRight = x + width / 2
  }
  return out
}

/**
 * Backward (right-anchored) pack. Mirror of forwardPack: we traverse
 * right-to-left, each node's x is the min of its preferred x and the
 * rightmost it can sit without overlapping the next node's left edge
 * minus nodeGap.
 */
function backwardPack(
  layer: NodeId[],
  preds: Map<NodeId, NodeId[]>,
  previousLayers: Map<NodeId, number>[],
  sizeOf: (n: NodeId) => Size,
  nodeGap: number,
  hints: Map<NodeId, { x: number }> | undefined,
): Map<NodeId, number> {
  const out = new Map<NodeId, number>()
  let nextLeft = Number.POSITIVE_INFINITY
  for (let j = layer.length - 1; j >= 0; j--) {
    const n = layer[j]
    if (n === undefined) continue
    const { width } = sizeOf(n)
    const pref = preferredX(n, preds, previousLayers, hints)
    const maxX = j === layer.length - 1 ? Number.POSITIVE_INFINITY : nextLeft - nodeGap - width / 2
    const desired = pref ?? maxX
    const x = desired > maxX ? maxX : desired
    out.set(n, x)
    nextLeft = x - width / 2
  }
  return out
}
