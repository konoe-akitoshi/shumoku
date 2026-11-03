// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type FrameId, frameKey, type ItemId, type Problem } from '../problem.js'
import type { Hints, Ranks } from '../ranks.js'
import { anchorsOf, treeOf } from '../tree.js'
import type { Basis } from './types.js'

/** The problem and the ranks, looked up the ways the later stages ask for them. */
export function basisOf(
  problem: Problem,
  ranks: Ranks,
  hints: Pick<Hints, 'order' | 'members'>,
): Basis {
  const tree = treeOf(problem)
  const anchors = anchorsOf(problem, tree)
  const ownerOf = new Map<string, ItemId>()
  for (const item of problem.items) {
    ownerOf.set(item.id, item.id)
    for (const m of item.members ?? []) ownerOf.set(m.node.id, item.id)
  }
  return {
    problem,
    ranks,
    hints,
    tree,
    anchors,
    items: new Map(problem.items.map((i) => [i.id, i])),
    frameOfKey: new Map(problem.frames.map((f) => [frameKey(f.id), f.id])),
    parentFrame: new Map(problem.frames.map((f) => [f.id, f.parent])),
    ownerOf,
    rankOf: (id) => ranks.rank.get(id) ?? 0,
    reaches: (f: FrameId, r: number) => {
      const s = ranks.span.get(frameKey(f))
      return s !== undefined && s[0] <= r && r <= s[1]
    },
  }
}
