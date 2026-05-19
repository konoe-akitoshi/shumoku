// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Spine alignment.
 *
 * After the outer tidy-tree positions blocks, this pass shifts
 * sibling clusters so that any **same-subgraph parent-child
 * block pair** shares an x column. Visually: a subgraph that
 * spans two stacked emitter blocks (e.g. New Group with
 * eps-sw01 above eps-sw02) reads as a narrow vertical strip
 * instead of a wide L.
 *
 * Algorithm:
 *
 *   - Walk the outer block tree top-down.
 *   - For each block, find a child whose primary node lives in
 *     the same subgraph as the block's primary node — that's
 *     the "spine" child.
 *   - If the spine child's x differs from the parent's x, shift
 *     the whole sibling cluster (spine + non-spine siblings,
 *     and all descendants) by `dx = parentX - spineX`. Whole-
 *     cluster panning preserves tidy-tree's relative spacing
 *     between siblings.
 */

import type { Node } from '../../../models/types.js'
import type { BlockChildren, BlockId, BlockMembers, Position } from './types.js'

/**
 * Mutate `positions` in place so each same-subgraph spine
 * child shares the parent block's x column. Non-spine siblings
 * (and their descendants) pan by the same delta.
 */
export function alignSameSubgraphSpine(
  positions: Map<BlockId, Position>,
  blockChildren: BlockChildren,
  blockMembers: BlockMembers,
  nodesById: Map<string, Node>,
): void {
  const subgraphOf = (block: BlockId): string | null => {
    const primary = blockMembers.get(block)?.[0]
    return primary ? (nodesById.get(primary)?.parent ?? null) : null
  }
  const roots = findOuterRoots(blockMembers, blockChildren)
  const visited = new Set<BlockId>()
  const queue = [...roots]
  while (queue.length > 0) {
    const block = queue.shift()
    if (block === undefined || visited.has(block)) continue
    visited.add(block)
    const parentSg = subgraphOf(block)
    const kids = blockChildren.get(block) ?? []
    const spine = parentSg ? kids.find((c) => subgraphOf(c) === parentSg) : undefined
    if (spine !== undefined) {
      const parentX = positions.get(block)?.x
      const spineX = positions.get(spine)?.x
      if (parentX !== undefined && spineX !== undefined && parentX !== spineX) {
        shiftCluster(kids, blockChildren, positions, parentX - spineX)
      }
    }
    for (const c of kids) queue.push(c)
  }
}

/**
 * Walk `kids` (and all their outer-tree descendants) and shift
 * each block's x by `dx`. Used to pan the whole sibling cluster
 * together so relative spacing is preserved.
 */
function shiftCluster(
  kids: readonly BlockId[],
  blockChildren: BlockChildren,
  positions: Map<BlockId, Position>,
  dx: number,
): void {
  const stack: BlockId[] = [...kids]
  while (stack.length > 0) {
    const cur = stack.pop()
    if (cur === undefined) break
    const p = positions.get(cur)
    if (p) positions.set(cur, { x: p.x + dx, y: p.y })
    for (const cc of blockChildren.get(cur) ?? []) stack.push(cc)
  }
}

/** Blocks that aren't the child of any other block in the outer tree. */
function findOuterRoots(blockMembers: BlockMembers, blockChildren: BlockChildren): BlockId[] {
  const allChildren = new Set<BlockId>()
  for (const kids of blockChildren.values()) {
    for (const k of kids) allChildren.add(k)
  }
  const roots: BlockId[] = []
  for (const b of blockMembers.keys()) {
    if (!allChildren.has(b)) roots.push(b)
  }
  return roots
}
