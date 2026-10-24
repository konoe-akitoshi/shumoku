// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import {
  blockCutTree,
  nodeKey,
  nodeVertices,
  type TreeNode,
  treeComponents,
  treeNeighbours,
} from './block-cut-tree.js'
import { compare, sorted } from './keys.js'
import type { Decomposition, Entrance, Trunk, VertexRef } from './stage-types.js'

/**
 * Stage 8. The frame that joins the entrances, on the block-cut tree of the default plane, one
 * connected piece at a time:
 * - with two or more entrances: the smallest subtree holding every entrance (a tree has only
 *   one), with all the vertices of its blocks;
 * - with one entrance: that vertex alone;
 * - with none: the smallest subtree holding every block of three or more vertices (a ring);
 * - with none and no ring: no trunk.
 * The trunk of the plane is the union of those. `blocks` holds every block in it, small ones
 * too; the output drops the blocks of two vertices.
 */
export function findTrunk(
  decomposition: Decomposition,
  entrances: readonly Entrance[],
): Trunk | undefined {
  const tree = blockCutTree(decomposition)
  const entranceSet = new Set(entrances.map((e) => e.vertex))

  const vertices = new Set<VertexRef>()
  const blocks = new Map<string, readonly VertexRef[]>()
  for (const component of treeComponents(tree)) {
    const here = sorted(
      [...entranceSet].filter((v) => component.some((n) => nodeVertices(tree, n).includes(v))),
    )
    const [only] = here
    if (here.length === 1 && only !== undefined) {
      vertices.add(only)
      continue
    }
    const terminals: TreeNode[] =
      here.length >= 2
        ? here.map((v): TreeNode => {
            if (tree.cuts.has(v)) return { cut: v }
            return { block: (tree.incident.get(v) ?? [])[0] ?? '' }
          })
        : component.filter((n) => 'block' in n && nodeVertices(tree, n).length >= 3)
    if (terminals.length === 0) continue
    for (const n of smallestSubtree(tree, component, terminals)) {
      for (const v of nodeVertices(tree, n)) vertices.add(v)
      if ('block' in n) blocks.set(n.block, nodeVertices(tree, n))
    }
  }
  if (vertices.size === 0) return undefined
  return {
    vertices: sorted(vertices),
    blocks: [...blocks.entries()].sort(([a], [b]) => compare(a, b)).map(([, vs]) => vs),
  }
}

/** The smallest subtree that holds the terminals: leaves that are not terminals are dropped. */
function smallestSubtree(
  tree: Parameters<typeof treeNeighbours>[0],
  component: readonly TreeNode[],
  terminals: readonly TreeNode[],
): TreeNode[] {
  const keep = new Map(component.map((n) => [nodeKey(n), n]))
  const marked = new Set(terminals.map(nodeKey))
  let pruned = true
  while (pruned) {
    pruned = false
    for (const [k, n] of [...keep]) {
      if (marked.has(k) || keep.size <= 1) continue
      if (treeNeighbours(tree, n).filter((m) => keep.has(nodeKey(m))).length <= 1) {
        keep.delete(k)
        pruned = true
      }
    }
  }
  return [...keep.values()]
}
