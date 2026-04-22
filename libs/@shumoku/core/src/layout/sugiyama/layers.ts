// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Layer assignment for Sugiyama-style layered layout.
 *
 * Given a DAG, assign each node an integer layer index so every edge
 * goes from a lower layer to a higher one. We use the longest-path
 * method: layer(v) = max over all predecessors u of layer(u) + 1.
 *
 * Longest-path is O(V + E), trivially correct, and produces
 * layer-compact layouts for the small-to-medium graphs typical of
 * network topologies. Coffman-Graham or network-simplex would give
 * tighter width bounds but aren't justified here.
 *
 * Disconnected components are all laid out with their longest-path
 * layers starting at 0; the caller can shift or pack them in a later
 * step if needed.
 */

import type { Edge, LayerAssignment, NodeId } from './types.js'

export function assignLayers(nodes: NodeId[], dag: Edge[]): LayerAssignment {
  // Build predecessor list. In a DAG this lets us compute
  // layer(v) = 1 + max(layer(u) for u in preds(v)) via topological order.
  const preds = new Map<NodeId, NodeId[]>()
  for (const n of nodes) preds.set(n, [])
  for (const e of dag) {
    if (e.source === e.target) continue // self loop — skip
    const list = preds.get(e.target)
    if (list) list.push(e.source)
  }

  // Build successor list for topological sort.
  const succ = new Map<NodeId, NodeId[]>()
  const inDegree = new Map<NodeId, number>()
  for (const n of nodes) {
    succ.set(n, [])
    inDegree.set(n, 0)
  }
  for (const e of dag) {
    if (e.source === e.target) continue
    succ.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // Kahn-style topological sort. We iterate nodes in a stable order (the
  // input order of `nodes`) so the output is deterministic for equal
  // graphs — important for testability and diff-friendly output.
  const queue: NodeId[] = []
  for (const n of nodes) {
    if ((inDegree.get(n) ?? 0) === 0) queue.push(n)
  }
  const topo: NodeId[] = []
  const queueHead = { i: 0 }
  while (queueHead.i < queue.length) {
    const u = queue[queueHead.i++]
    if (u === undefined) break
    topo.push(u)
    for (const v of succ.get(u) ?? []) {
      const d = (inDegree.get(v) ?? 0) - 1
      inDegree.set(v, d)
      if (d === 0) queue.push(v)
    }
  }

  // If topo length < nodes length we have a cycle the caller forgot to
  // remove — treat remaining nodes as layer 0 rather than crashing.
  const layerOf = new Map<NodeId, number>()
  for (const u of topo) {
    let maxPred = -1
    for (const p of preds.get(u) ?? []) {
      const lp = layerOf.get(p)
      if (lp !== undefined && lp > maxPred) maxPred = lp
    }
    layerOf.set(u, maxPred + 1)
  }
  for (const n of nodes) {
    if (!layerOf.has(n)) layerOf.set(n, 0)
  }

  // Bucket into layers[i].
  let maxLayer = 0
  for (const l of layerOf.values()) if (l > maxLayer) maxLayer = l
  const layers: NodeId[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const n of nodes) {
    const l = layerOf.get(n) ?? 0
    const bucket = layers[l]
    if (bucket) bucket.push(n)
  }

  return { layers, layerOf }
}
