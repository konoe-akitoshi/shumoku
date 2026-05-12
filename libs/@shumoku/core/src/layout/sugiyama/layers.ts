// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Layer assignment for Sugiyama-style layered layout.
 *
 * Three modes:
 *
 *  - **TIERED** (default) — internal nodes use ASAP, leaves use ALAP.
 *    Concretely:
 *      - internal: `layer(v) = max(layer(u)) + 1` over predecessors
 *        (topological depth from root)
 *      - leaf:     `layer(v) = maxLayer` (the deepest layer reached by
 *        any node under ASAP)
 *    This matches what a network engineer hand-draws:
 *      - routers and distribution switches stack by their actual
 *        distance from the WAN edge (ASAP)
 *      - endpoints (APs, servers, single-leaf branches) align on a
 *        common bottom row regardless of how short the chain to them
 *        was (ALAP for leaves only)
 *    The trade-off is that a leaf hanging off a shallow chain
 *    (e.g. `noc-sw01 → noc-ap01`) becomes a *long* edge — its
 *    source is at layer 2, its sink at layer N. With Bezier
 *    rendering this is a single curve, not a problem; with
 *    polyline routing it would need dummy-node insertion (we don't
 *    do that).
 *
 *  - **ASAP** ("As Soon As Possible") — every node at its shallowest
 *    legal layer. Standard Sugiyama default. Used here for tests
 *    and for graphs where leaf alignment isn't useful.
 *
 *  - **ALAP** ("As Late As Possible") — every node at its deepest
 *    legal layer. Was the default before the tiered redesign; one
 *    drawback was that intermediate switches with only-leaf children
 *    (like `noc-sw01`) got pushed all the way down to the leaf row,
 *    out of position with their topological peers (`eps-sw01`).
 *
 * Each variant is O(V + E). The boolean knob is cheap so we keep all
 * three around — pick mode based on the diagram's role.
 */

import type { Edge, LayerAssignment, NodeId } from './types.js'

export type LayerMode = 'asap' | 'alap' | 'tiered'

export interface AssignLayersOptions {
  /**
   * - `'tiered'` (default) — internal nodes at topological depth,
   *   leaves snapped to bottom row. Best for network topology.
   * - `'asap'` — leaves naturally spread at varying depths.
   * - `'alap'` — all nodes pushed as deep as their longest path
   *   to a leaf will allow.
   */
  mode?: LayerMode
}

export function assignLayers(
  nodes: NodeId[],
  dag: Edge[],
  options: AssignLayersOptions = {},
): LayerAssignment {
  const mode: LayerMode = options.mode ?? 'asap'

  // Predecessor / successor lists. In a DAG these let us compute
  //   asap(v)        = max(asap(u) over u ∈ preds(v)) + 1
  //   reverseDepth(v) = max(reverseDepth(w) over w ∈ succs(v)) + 1
  // via a single topological pass.
  const preds = new Map<NodeId, NodeId[]>()
  const succ = new Map<NodeId, NodeId[]>()
  const inDegree = new Map<NodeId, number>()
  for (const n of nodes) {
    preds.set(n, [])
    succ.set(n, [])
    inDegree.set(n, 0)
  }
  for (const e of dag) {
    if (e.source === e.target) continue // self loop — skip
    preds.get(e.target)?.push(e.source)
    succ.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // Kahn-style topological sort. Stable in the input order of `nodes`
  // so equal graphs produce equal outputs — handy for tests and diffs.
  const queue: NodeId[] = []
  for (const n of nodes) {
    if ((inDegree.get(n) ?? 0) === 0) queue.push(n)
  }
  const topo: NodeId[] = []
  let qHead = 0
  while (qHead < queue.length) {
    const u = queue[qHead++]
    if (u === undefined) break
    topo.push(u)
    for (const v of succ.get(u) ?? []) {
      const d = (inDegree.get(v) ?? 0) - 1
      inDegree.set(v, d)
      if (d === 0) queue.push(v)
    }
  }

  // ASAP layer for every node.
  const asap = new Map<NodeId, number>()
  for (const u of topo) {
    let maxPred = -1
    for (const p of preds.get(u) ?? []) {
      const lp = asap.get(p)
      if (lp !== undefined && lp > maxPred) maxPred = lp
    }
    asap.set(u, maxPred + 1)
  }
  // Cycle survivors don't appear in topo; default them to 0.
  for (const n of nodes) {
    if (!asap.has(n)) asap.set(n, 0)
  }

  let layerOf: Map<NodeId, number>
  if (mode === 'asap') {
    layerOf = asap
  } else if (mode === 'alap') {
    layerOf = computeAlap(nodes, topo, asap, succ)
  } else {
    layerOf = computeTiered(nodes, asap, succ)
  }

  // Bucket into layers[i].
  let maxLayer = 0
  for (const l of layerOf.values()) {
    if (l > maxLayer) maxLayer = l
  }
  const layers: NodeId[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const n of nodes) {
    const l = layerOf.get(n) ?? 0
    layers[l]?.push(n)
  }

  return { layers, layerOf }
}

/**
 * **Tiered**: ASAP for internal nodes, leaves pinned to `maxAsap`.
 *
 * "Leaf" here means no outgoing edges in the DAG used for layering
 * (post cycle-removal). Network diagrams have one true leaf class —
 * endpoint devices — and they look better aligned on a single row.
 *
 * Long edges (internal layer to bottom layer) are accepted as a
 * trade-off; Bezier rendering handles them as one curve.
 */
function computeTiered(
  nodes: NodeId[],
  asap: Map<NodeId, number>,
  succ: Map<NodeId, NodeId[]>,
): Map<NodeId, number> {
  let maxAsap = 0
  for (const l of asap.values()) {
    if (l > maxAsap) maxAsap = l
  }
  const out = new Map<NodeId, number>()
  for (const n of nodes) {
    const isLeaf = (succ.get(n)?.length ?? 0) === 0
    out.set(n, isLeaf ? maxAsap : (asap.get(n) ?? 0))
  }
  return out
}

/**
 * **ALAP**: every node sits at the deepest layer compatible with the
 * DAG. Pre-tiered default, retained for explicit opt-in.
 */
function computeAlap(
  nodes: NodeId[],
  topo: NodeId[],
  asap: Map<NodeId, number>,
  succ: Map<NodeId, NodeId[]>,
): Map<NodeId, number> {
  // Reverse longest path: distance from each node to its furthest leaf.
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
  const out = new Map<NodeId, number>()
  for (const n of nodes) {
    out.set(n, totalDepth - (reverseDepth.get(n) ?? 0))
  }
  return out
}
