// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Layer assignment for Sugiyama-style layered layout.
 *
 * Two modes:
 *
 *  - **ASAP** ("As Soon As Possible") — `layer(v) = max(layer(u)) + 1`
 *    over predecessors. Each node sits at the *shallowest* layer
 *    compatible with the DAG. Leaves end up at varying depths
 *    depending on how long their longest path from a root is.
 *    Standard Sugiyama default.
 *
 *  - **ALAP** ("As Late As Possible") — each node sits at the
 *    *deepest* layer compatible with the DAG, computed as
 *    `layer(v) = totalDepth - longestPathToLeaf(v)`. Every leaf
 *    lands on the bottom row regardless of how it got there, which
 *    matches what network-engineer users expect from a topology
 *    diagram (APs at the bottom, ONU at the top, etc.). One
 *    drawback: edges crossing many ranks become longer; with no
 *    dummy-node insertion they remain direct straight bends.
 *
 * The longest-path implementations are O(V + E); the choice is a
 * single boolean knob, so we pay nothing for keeping both around.
 */

import type { Edge, LayerAssignment, NodeId } from './types.js'

export interface AssignLayersOptions {
  /** 'asap' = leaves spread by depth; 'alap' = all leaves at the
   *  bottom. Default 'alap' — better suited to network diagrams. */
  mode?: 'asap' | 'alap'
}

export function assignLayers(
  nodes: NodeId[],
  dag: Edge[],
  options: AssignLayersOptions = {},
): LayerAssignment {
  const mode = options.mode ?? 'alap'
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

  // Forward longest path from any root (ASAP layer).
  const asap = new Map<NodeId, number>()
  for (const u of topo) {
    let maxPred = -1
    for (const p of preds.get(u) ?? []) {
      const lp = asap.get(p)
      if (lp !== undefined && lp > maxPred) maxPred = lp
    }
    asap.set(u, maxPred + 1)
  }
  for (const n of nodes) {
    if (!asap.has(n)) asap.set(n, 0)
  }

  let layerOf: Map<NodeId, number>
  if (mode === 'alap') {
    // Reverse longest path: distance from each node to its furthest
    // leaf. Walk topo in reverse so successors are resolved first.
    const reverseDepth = new Map<NodeId, number>()
    for (let i = topo.length - 1; i >= 0; i--) {
      const u = topo[i]
      if (u === undefined) continue
      let maxSucc = -1
      for (const v of succ.get(u) ?? []) {
        const lv = reverseDepth.get(v)
        if (lv !== undefined && lv > maxSucc) maxSucc = lv
      }
      reverseDepth.set(u, maxSucc + 1)
    }
    for (const n of nodes) {
      if (!reverseDepth.has(n)) reverseDepth.set(n, 0)
    }
    let totalDepth = 0
    for (const n of nodes) {
      const d = (asap.get(n) ?? 0) + (reverseDepth.get(n) ?? 0)
      if (d > totalDepth) totalDepth = d
    }
    layerOf = new Map<NodeId, number>()
    for (const n of nodes) {
      const layer = totalDepth - (reverseDepth.get(n) ?? 0)
      layerOf.set(n, layer)
    }
  } else {
    layerOf = asap
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
