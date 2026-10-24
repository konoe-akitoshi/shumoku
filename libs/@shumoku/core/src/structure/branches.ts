// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { blockCutTree, blockName } from './block-cut-tree.js'
import { compare, setKey } from './keys.js'
import type { Branch, Decomposition, Trunk, VertexRef } from './stage-types.js'

/**
 * Stage 9. What hangs off the trunk, nested by fork. Away from the trunk is the only direction
 * there is: from a fork, every block that is not the way back (and not in the trunk) is a
 * branch, and the forks among its other vertices carry branches of their own. A branch is named
 * by its fork and the vertices it first reaches. A part without a trunk has no branches.
 * Branches at one fork are listed by those vertices; their order carries no meaning.
 */
export function findBranches(decomposition: Decomposition, trunk: Trunk | undefined): Branch[] {
  if (!trunk) return []
  const tree = blockCutTree(decomposition)
  const inTrunk = new Set(trunk.blocks.map(blockName))

  const leave = (v: VertexRef, arrivedBy: string | undefined): Branch[] => {
    const out: Branch[] = []
    for (const name of tree.incident.get(v) ?? []) {
      if (name === arrivedBy || inTrunk.has(name)) continue
      const via = (tree.blocks.get(name) ?? []).filter((w) => w !== v)
      if (via.length === 0) continue
      out.push({ at: v, via, branches: via.flatMap((w) => leave(w, name)).sort(byFork) })
    }
    return out
  }
  return trunk.vertices.flatMap((v) => leave(v, undefined)).sort(byFork)
}

const byFork = (a: Branch, b: Branch): number =>
  compare(a.at, b.at) || compare(setKey(a.via), setKey(b.via))
