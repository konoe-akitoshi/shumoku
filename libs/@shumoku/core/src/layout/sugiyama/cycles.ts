// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Cycle removal for Sugiyama-style layered layout.
 *
 * Layered layout needs a DAG: every edge must go from a lower layer to a
 * higher one. Real graphs have cycles (e.g. redundant links between two
 * routers), so we reverse a minimal set of edges before layer assignment
 * and mark them `reversed` so downstream code can still draw them with
 * the original direction.
 *
 * We use a DFS-based heuristic (not Greedy FAS): pick back edges —
 * edges whose target is an ancestor of the source in the current DFS
 * tree — and reverse them. This is O(V + E) and produces a close-to-
 * optimal feedback arc set for sparse graphs, which is the common case.
 */

import type { CycleRemovalResult, Edge, EdgeId, NodeId } from './types.js'

/**
 * Remove cycles by reversing back edges discovered during DFS. The
 * returned `dag` has the same edges (with the reversed ones flipped and
 * marked); the caller decides how to present reversed edges in output
 * (renderers usually draw them the original way).
 */
export function removeCycles(nodes: NodeId[], edges: Edge[]): CycleRemovalResult {
  // Build adjacency. A single node can appear multiple times in
  // `nodes`; dedupe via the map keys.
  const outgoing = new Map<NodeId, { edgeId: EdgeId; target: NodeId }[]>()
  for (const n of nodes) {
    if (!outgoing.has(n)) outgoing.set(n, [])
  }
  for (const e of edges) {
    // Self loops can never be drawn as DAG edges; just drop them from
    // the adjacency and keep them in the output unchanged.
    if (e.source === e.target) continue
    outgoing.get(e.source)?.push({ edgeId: e.id, target: e.target })
  }

  // DFS state
  const WHITE = 0
  const GRAY = 1 // on the current DFS stack
  const BLACK = 2 // fully explored
  const color = new Map<NodeId, number>()
  for (const n of outgoing.keys()) color.set(n, WHITE)

  const reversed = new Set<EdgeId>()

  function visit(start: NodeId) {
    // Iterative DFS so deep graphs don't blow the call stack. We keep a
    // stack of (node, outgoingIndex) frames; incrementing the index
    // before visiting mirrors the recursive "visit next child, then
    // backtrack" pattern.
    const stack: { node: NodeId; idx: number }[] = [{ node: start, idx: 0 }]
    color.set(start, GRAY)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      if (!frame) break
      const adj = outgoing.get(frame.node) ?? []
      if (frame.idx >= adj.length) {
        color.set(frame.node, BLACK)
        stack.pop()
        continue
      }
      const next = adj[frame.idx++]
      if (!next) continue
      const c = color.get(next.target) ?? WHITE
      if (c === WHITE) {
        color.set(next.target, GRAY)
        stack.push({ node: next.target, idx: 0 })
      } else if (c === GRAY) {
        // Back edge: reverses the current DFS stack direction, so flip it.
        reversed.add(next.edgeId)
      }
      // c === BLACK → forward/cross edge, leave alone.
    }
  }

  for (const n of outgoing.keys()) {
    if (color.get(n) === WHITE) visit(n)
  }

  const dag: Edge[] = edges.map((e) => {
    if (!reversed.has(e.id)) return e
    return { id: e.id, source: e.target, target: e.source, reversed: true }
  })

  return { dag, reversed }
}
