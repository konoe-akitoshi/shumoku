// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Crossing reduction for Sugiyama-style layered layout.
 *
 * Given a layer assignment, reorder nodes *within* each layer so edges
 * between adjacent layers cross as little as possible. We use the
 * **barycenter heuristic** (Sugiyama 1981, Gansner 1993): for each
 * node, compute the average index of its neighbours in the previous
 * layer, then sort the current layer by those averages.
 *
 * A single downward sweep greatly reduces crossings; alternating with
 * an upward sweep (and iterating a handful of times) tightens the
 * result further without getting stuck in cycles. We don't do proper
 * median or weighted-median sorts — barycenter with ~4 iterations is
 * good enough for the small-to-medium graphs typical of network
 * topologies, and keeps the phase readable.
 *
 * Nodes with no neighbours in the reference layer keep their current
 * position (they "float"). Stable sort semantics ensure deterministic
 * output when multiple nodes share the same barycenter value.
 */

import type { Edge, LayerAssignment, NodeId } from './types.js'

export interface ReduceCrossingsOptions {
  /** Down+Up passes to run. 4 converges on most graphs. */
  iterations?: number
}

export function reduceCrossings(
  layerAssignment: LayerAssignment,
  edges: Edge[],
  options: ReduceCrossingsOptions = {},
): LayerAssignment {
  const iters = options.iterations ?? 4
  // Work on a copy so we don't mutate the caller's arrays.
  const layers = layerAssignment.layers.map((l) => [...l])

  // Pre-index adjacency: for each (node, neighbourLayerDirection), the
  // neighbours. Built once; indices into layers[] are recomputed each
  // sweep because positions change as we go.
  const outgoing = new Map<NodeId, NodeId[]>()
  const incoming = new Map<NodeId, NodeId[]>()
  for (const layer of layers) {
    for (const n of layer) {
      outgoing.set(n, [])
      incoming.set(n, [])
    }
  }
  for (const e of edges) {
    if (e.source === e.target) continue
    outgoing.get(e.source)?.push(e.target)
    incoming.get(e.target)?.push(e.source)
  }

  for (let iter = 0; iter < iters; iter++) {
    // Downward sweep: reorder layer L by barycenter of neighbours in L-1
    for (let i = 1; i < layers.length; i++) {
      const above = layers[i - 1]
      const current = layers[i]
      if (!above || !current) continue
      layers[i] = sortByBarycenter(current, above, incoming)
    }
    // Upward sweep: reorder layer L by barycenter of neighbours in L+1
    for (let i = layers.length - 2; i >= 0; i--) {
      const below = layers[i + 1]
      const current = layers[i]
      if (!below || !current) continue
      layers[i] = sortByBarycenter(current, below, outgoing)
    }
  }

  // Rebuild layerOf from the reordered layers so the output is consistent.
  const layerOf = new Map<NodeId, number>()
  for (const [i, layer] of layers.entries()) {
    for (const n of layer) layerOf.set(n, i)
  }
  return { layers, layerOf }
}

/**
 * Sort `current` by the average index of each node's neighbours in
 * `reference`, falling back to the node's current position when it has
 * no neighbours there (keeps floating nodes stable).
 */
function sortByBarycenter(
  current: NodeId[],
  reference: NodeId[],
  neighbours: Map<NodeId, NodeId[]>,
): NodeId[] {
  const refIndex = new Map<NodeId, number>()
  for (const [i, n] of reference.entries()) refIndex.set(n, i)

  const originalIndex = new Map<NodeId, number>()
  for (const [i, n] of current.entries()) originalIndex.set(n, i)

  const bary = new Map<NodeId, number>()
  for (const n of current) {
    const ns = neighbours.get(n) ?? []
    let sum = 0
    let count = 0
    for (const m of ns) {
      const idx = refIndex.get(m)
      if (idx === undefined) continue
      sum += idx
      count++
    }
    // No neighbours in reference layer → keep current index so the node
    // doesn't jump around arbitrarily between sweeps.
    bary.set(n, count === 0 ? (originalIndex.get(n) ?? 0) : sum / count)
  }

  // Stable sort: when barycenters tie, preserve original order. JS's
  // Array.prototype.sort is stable per spec as of ES2019.
  return [...current].sort((a, b) => {
    const ba = bary.get(a) ?? 0
    const bb = bary.get(b) ?? 0
    if (ba === bb) return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0)
    return ba - bb
  })
}
