// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { ItemId, Problem } from './problem.js'

/**
 * Each item's rank: how many flows lie above it along the longest chain, with items the
 * structure holds level, or beside a host, sharing one. A count of steps and nothing else, so
 * it is the same whatever the items measure; what the flows do not reach is at rank 0.
 */
export function ranksOf(problem: Problem): Map<ItemId, number> {
  const parent = new Map<ItemId, ItemId>(problem.items.map((i) => [i.id, i.id]))
  const find = (id: ItemId): ItemId => {
    const up = parent.get(id) ?? id
    if (up === id) return id
    const root = find(up)
    parent.set(id, root)
    return root
  }
  const join = (a: ItemId, b: ItemId) => {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb)
  }
  for (const { a, b } of problem.level) join(a, b)
  for (const s of problem.satellites) join(s.item, s.partner)

  const upstream = new Map<ItemId, Set<ItemId>>()
  for (const { upper, lower } of problem.above) {
    const [u, l] = [find(upper), find(lower)]
    if (u === l) continue
    const set = upstream.get(l) ?? new Set<ItemId>()
    set.add(u)
    upstream.set(l, set)
  }

  const known = new Map<ItemId, number>()
  const walking = new Set<ItemId>()
  const rankOfRoot = (root: ItemId): number => {
    const done = known.get(root)
    if (done !== undefined) return done
    // A chain that comes back on itself has no top; the step that closes it is not counted.
    if (walking.has(root)) return 0
    walking.add(root)
    let rank = 0
    for (const u of upstream.get(root) ?? []) rank = Math.max(rank, rankOfRoot(u) + 1)
    walking.delete(root)
    known.set(root, rank)
    return rank
  }
  return new Map(problem.items.map((i) => [i.id, rankOfRoot(find(i.id))]))
}
