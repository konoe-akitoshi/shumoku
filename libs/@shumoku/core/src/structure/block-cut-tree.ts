// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, setKey, sorted } from './keys.js'
import type { Decomposition, VertexRef } from './stage-types.js'

/**
 * The block-cut tree of a decomposition, as the stages that read it need it: its nodes are the
 * blocks (named by their vertices) and the cut vertices, a block joined to each cut vertex it
 * holds. A vertex that is not a cut vertex belongs to exactly one block.
 */
export interface BlockCutTree {
  /** The vertices of each block, by the block's name. */
  readonly blocks: ReadonlyMap<string, readonly VertexRef[]>
  /** The names of the blocks each vertex belongs to, sorted. */
  readonly incident: ReadonlyMap<VertexRef, readonly string[]>
  readonly cuts: ReadonlySet<VertexRef>
}

export const blockName = (vertices: readonly VertexRef[]): string => setKey(vertices)

export function blockCutTree(decomposition: Decomposition): BlockCutTree {
  const blocks = new Map<string, readonly VertexRef[]>()
  const incident = new Map<VertexRef, string[]>()
  for (const block of decomposition.blocks) {
    const name = blockName(block.vertices)
    blocks.set(name, block.vertices)
    for (const v of block.vertices) incident.set(v, [...(incident.get(v) ?? []), name])
  }
  const cuts = new Set<VertexRef>()
  for (const [v, names] of incident) {
    names.sort(compare)
    if (names.length >= 2) cuts.add(v)
  }
  return { blocks, incident, cuts }
}

/** A node of the tree: a block by its name, or a cut vertex. */
export type TreeNode = { readonly block: string } | { readonly cut: VertexRef }

export const nodeKey = (n: TreeNode): string => ('block' in n ? `b\0${n.block}` : `c\0${n.cut}`)

/** The vertices a tree node stands for. */
export function nodeVertices(tree: BlockCutTree, n: TreeNode): readonly VertexRef[] {
  return 'block' in n ? (tree.blocks.get(n.block) ?? []) : [n.cut]
}

/** The nodes joined to a node: a block to its cut vertices, a cut vertex to its blocks. */
export function treeNeighbours(tree: BlockCutTree, n: TreeNode): TreeNode[] {
  if ('block' in n) {
    return (tree.blocks.get(n.block) ?? []).filter((v) => tree.cuts.has(v)).map((cut) => ({ cut }))
  }
  return (tree.incident.get(n.cut) ?? []).map((block) => ({ block }))
}

/** The tree's nodes grouped into connected components, each sorted. */
export function treeComponents(tree: BlockCutTree): TreeNode[][] {
  const all: TreeNode[] = [
    ...[...tree.blocks.keys()].sort(compare).map((block) => ({ block })),
    ...sorted(tree.cuts).map((cut) => ({ cut })),
  ]
  const seen = new Set<string>()
  const components: TreeNode[][] = []
  for (const start of all) {
    if (seen.has(nodeKey(start))) continue
    const component: TreeNode[] = []
    const queue = [start]
    seen.add(nodeKey(start))
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
      component.push(n)
      for (const m of treeNeighbours(tree, n)) {
        if (seen.has(nodeKey(m))) continue
        seen.add(nodeKey(m))
        queue.push(m)
      }
    }
    components.push(component.sort((x, y) => compare(nodeKey(x), nodeKey(y))))
  }
  return components
}
