// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Overlay-aware sibling reorder.
 *
 * Primary edges drive the tree-tidy layout via
 * {@link ./sort.ts | sortBlocksBySourcePort}. *Overlay* edges
 * (redundancy / HA peering / multi-parent) aren't part of the
 * tree — they're drawn on top. If two overlay-connected blocks
 * sit far apart in their parent's child sequence, the overlay
 * edge has to traverse over their separating siblings, creating
 * crossings in the rendered diagram.
 *
 * This module re-orders sibling blocks within each parent's
 * child list to minimise overlay-edge crossings between
 * siblings, using a single deterministic barycenter pass:
 *
 *   1. Build a *peer-overlay* map: for each block, the set of
 *      sibling-or-sibling-subtree blocks reachable via at least
 *      one overlay edge.
 *   2. For each parent, compute each child's barycenter as the
 *      mean ordinal of its overlay-peers in the current sibling
 *      order.
 *   3. Sort children by barycenter, falling back to the prior
 *      ordinal when no overlay peers exist, then to id. Stable.
 *
 * Determinism: the pass is one fixed iteration (no annealing,
 * no random restart). Same input → same output. Disabled by
 * default — gated behind `options.overlayReorder` so callers
 * opt in only after validating against the quality harness.
 *
 * Limitation: barycenter only considers *direct sibling*
 * overlay connectivity. Deeply-nested overlay edges (subtree
 * member to subtree member, multiple layers deep) require
 * walking subtree membership; that's handled via the
 * `descendantsOf` parameter the caller supplies.
 */

import type { Link } from '../../models/types.js'
import { type Diagnostic, siblingOrderDiagnostic } from './diagnostics.js'
import type { BlockChildren, BlockId, BlockOfNode } from './types.js'

/**
 * Re-order each parent's children to reduce overlay-edge
 * crossings between siblings. Mutates `blockChildren` in place.
 *
 * @param blockChildren  current parent → ordered children map
 *                       (typically from {@link ./outer.ts |
 *                       buildBlockChildren} after the primary
 *                       source-port sort)
 * @param overlayLinks   links with `redundancy` set (or anything
 *                       else the caller treats as overlay)
 * @param blockOfNode    node-id → block-id reverse lookup
 * @param diagnostics    optional sink for `sibling-order`
 *                       diagnostics with reason
 *                       `overlay-barycenter`
 */
export function reorderForOverlay(
  blockChildren: BlockChildren,
  overlayLinks: readonly Link[],
  blockOfNode: BlockOfNode,
  diagnostics?: Diagnostic[],
): void {
  if (overlayLinks.length === 0) return

  const descendants = buildDescendantsMap(blockChildren)

  // Overlay-peer set per block: blocks reachable via an overlay
  // edge from any node in this block's subtree.
  const overlayPeers = new Map<BlockId, Set<BlockId>>()
  for (const link of overlayLinks) {
    const a = blockOfNode.get(link.from.node)
    const b = blockOfNode.get(link.to.node)
    if (!a || !b || a === b) continue
    addPeer(overlayPeers, a, b)
    addPeer(overlayPeers, b, a)
  }
  if (overlayPeers.size === 0) return

  for (const [parent, kids] of blockChildren) {
    if (kids.length < 3) continue // adjacent-swap can't improve < 3 siblings
    const reordered = greedyAdjacentSwap(kids, overlayPeers, descendants)
    if (!arraysEqual(kids, reordered)) {
      blockChildren.set(parent, reordered)
      diagnostics?.push(siblingOrderDiagnostic(parent, 'overlay-barycenter', reordered))
    }
  }
}

/**
 * Greedy adjacent-swap minimisation of total overlay span.
 *
 * Iterates left-to-right repeatedly, swapping each adjacent
 * pair when the swap strictly reduces the sum of ordinal
 * distances between overlay-connected sibling pairs. Stops
 * when a full pass makes no swap. Deterministic; same input →
 * same output.
 *
 * Worst case O(K³) per parent, but K ("number of sibling
 * blocks") is small in practice (single-digit to low double
 * digit). The pre-filter in {@link reorderForOverlay} skips
 * parents whose siblings have no overlay connectivity at all.
 */
function greedyAdjacentSwap(
  kids: readonly BlockId[],
  overlayPeers: ReadonlyMap<BlockId, ReadonlySet<BlockId>>,
  descendants: ReadonlyMap<BlockId, ReadonlySet<BlockId>>,
): BlockId[] {
  const current = [...kids]
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < current.length - 1; i++) {
      const before = totalOverlaySpan(current, overlayPeers, descendants)
      ;[current[i], current[i + 1]] = [current[i + 1] as BlockId, current[i] as BlockId]
      const after = totalOverlaySpan(current, overlayPeers, descendants)
      if (after < before) {
        improved = true
      } else {
        // Swap back.
        ;[current[i], current[i + 1]] = [current[i + 1] as BlockId, current[i] as BlockId]
      }
    }
  }
  return current
}

/**
 * Sum of ordinal distances between overlay-connected sibling
 * pairs. A smaller value means overlay peers sit closer
 * together in the sibling row — fewer crossings drawn over
 * unrelated siblings, and shorter visible overlay edges.
 */
function totalOverlaySpan(
  kids: readonly BlockId[],
  overlayPeers: ReadonlyMap<BlockId, ReadonlySet<BlockId>>,
  descendants: ReadonlyMap<BlockId, ReadonlySet<BlockId>>,
): number {
  let span = 0
  for (let i = 0; i < kids.length; i++) {
    const a = kids[i]
    if (a === undefined) continue
    const aSub = descendants.get(a) ?? new Set([a])
    for (let j = i + 1; j < kids.length; j++) {
      const b = kids[j]
      if (b === undefined) continue
      const bSub = descendants.get(b) ?? new Set([b])
      let connected = false
      for (const x of aSub) {
        const peers = overlayPeers.get(x)
        if (!peers) continue
        for (const y of bSub) {
          if (peers.has(y)) {
            connected = true
            break
          }
        }
        if (connected) break
      }
      if (connected) span += j - i
    }
  }
  return span
}

function addPeer(map: Map<BlockId, Set<BlockId>>, a: BlockId, b: BlockId): void {
  let s = map.get(a)
  if (!s) {
    s = new Set()
    map.set(a, s)
  }
  s.add(b)
}

/**
 * For each parent block, build the transitive set of descendant
 * block ids (including the parent itself). Used so an overlay
 * edge from a deeply-nested node still influences the top-level
 * sibling reorder.
 */
function buildDescendantsMap(blockChildren: BlockChildren): Map<BlockId, Set<BlockId>> {
  const out = new Map<BlockId, Set<BlockId>>()
  // Topo doesn't matter — we memoise.
  const memo = new Map<BlockId, Set<BlockId>>()
  const visit = (id: BlockId): Set<BlockId> => {
    const cached = memo.get(id)
    if (cached) return cached
    const s = new Set<BlockId>([id])
    for (const c of blockChildren.get(id) ?? []) {
      for (const d of visit(c)) s.add(d)
    }
    memo.set(id, s)
    return s
  }
  // Visit every block we know about (as parent or child).
  const all = new Set<BlockId>()
  for (const [parent, kids] of blockChildren) {
    all.add(parent)
    for (const k of kids) all.add(k)
  }
  for (const b of all) out.set(b, visit(b))
  return out
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
