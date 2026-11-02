// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NodeId } from '../structure/types.js'
import { liftFlows } from './lift.js'
import { type FrameId, frameKey, type ItemId, type Problem, ROOT } from './problem.js'
import { treeOf } from './tree.js'

/**
 * What the editor's hand may say of a drawing: which frame an item is in, the least rank it is
 * given, the order of the children of a frame, the order of the members of a unit. Each is a
 * hint: what the flows say wins over a rank, and an order only fixes the children it names.
 */
export interface Hints {
  frame?: ReadonlyMap<ItemId, FrameId>
  rank?: ReadonlyMap<ItemId, number>
  order?: ReadonlyMap<FrameId, readonly string[]>
  members?: ReadonlyMap<ItemId, readonly NodeId[]>
}

export interface Ranks {
  /** Each item's rank, 0 at the head of the flow. */
  rank: ReadonlyMap<ItemId, number>
  max: number
  /** The first and last rank of an item (one rank) or, by `frameKey`, of what a frame holds. */
  span: ReadonlyMap<string, readonly [lo: number, hi: number]>
  /**
   * Whether two siblings (children of one frame: an item id or a `frameKey`) stand one above the
   * other whatever their x: their ranks are apart, and the flows put one upstream of the other.
   */
  ordered(u: string, l: string): boolean
  /** The items whose hinted rank the flows pushed further down. */
  lifted: ItemId[]
}

/**
 * Each item's rank: how many flows lie above it along the longest chain, with items the
 * structure holds level, or beside a host, sharing one. A count of steps and nothing else, so
 * it is the same whatever the items measure; what the flows do not reach is at rank 0, and an
 * item that has no place in the flow is at the rank of the top row of its frame. A hinted rank
 * is a floor the flows may raise.
 */
export function ranksOf(problem: Problem, hints: Pick<Hints, 'rank'> = {}): Ranks {
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
  const floor = new Map<ItemId, number>()
  for (const [id, r] of hints.rank ?? []) {
    if (!parent.has(id)) continue
    const root = find(id)
    floor.set(root, Math.max(floor.get(root) ?? 0, r))
  }

  const known = new Map<ItemId, number>()
  const walking = new Set<ItemId>()
  const rankOfRoot = (root: ItemId): number => {
    const done = known.get(root)
    if (done !== undefined) return done
    // A chain that comes back on itself has no top; the step that closes it is not counted.
    if (walking.has(root)) return 0
    walking.add(root)
    let rank = floor.get(root) ?? 0
    for (const u of upstream.get(root) ?? []) rank = Math.max(rank, rankOfRoot(u) + 1)
    walking.delete(root)
    known.set(root, rank)
    return rank
  }
  const rank = new Map(problem.items.map((i) => [i.id, rankOfRoot(find(i.id))]))

  const tree = treeOf(problem)
  const free = new Set(problem.free)
  for (const id of problem.free) {
    const own = problem.items.find((i) => i.id === id)
    if (!own) continue
    const row = (tree.within.get(own.frame) ?? [])
      .filter((i) => !free.has(i.id))
      .map((i) => rank.get(i.id) ?? 0)
    rank.set(id, row.length === 0 ? 0 : Math.min(...row))
  }

  const lifted = [...(hints.rank ?? [])]
    .filter(([id, r]) => rank.has(id) && (rank.get(id) ?? 0) !== r)
    .map(([id]) => id)
    .sort()

  const span = new Map<string, readonly [number, number]>()
  for (const item of problem.items)
    span.set(item.id, [rank.get(item.id) ?? 0, rank.get(item.id) ?? 0])
  const frameSpan = (id: FrameId): readonly [number, number] => {
    const known = span.get(frameKey(id))
    if (known) return known
    const inside = (tree.within.get(id) ?? []).map((i) => rank.get(i.id) ?? 0)
    let found: readonly [number, number]
    if (inside.length > 0) found = [Math.min(...inside), Math.max(...inside)]
    else {
      const up = problem.frames.find((f) => f.id === id)?.parent
      const top = up === undefined || id === ROOT ? 0 : frameSpan(up)[0]
      found = [top, top]
    }
    span.set(frameKey(id), found)
    return found
  }
  for (const f of problem.frames) frameSpan(f.id)
  const max = Math.max(0, ...rank.values())

  const stack = new Map<string, Set<string>>()
  for (const s of liftFlows(problem)) {
    for (const { upper, lower } of s.pairs) {
      const [a, b] = [span.get(upper), span.get(lower)]
      if (!a || !b || (a[1] >= b[0] && b[1] >= a[0])) continue
      const set = stack.get(upper) ?? new Set<string>()
      set.add(lower)
      stack.set(upper, set)
    }
  }
  return {
    rank,
    max,
    span,
    ordered: (u, l) => stack.get(u)?.has(l) === true || stack.get(l)?.has(u) === true,
    lifted,
  }
}
