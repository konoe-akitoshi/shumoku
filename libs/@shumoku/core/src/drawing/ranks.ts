// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { NodeId } from '../structure/types.js'
import { frameIn, frameKey } from './keys.js'
import { must } from './must.js'
import { type FrameId, type ItemId, type Problem, ROOT } from './problem.js'
import { type Tree, treeOf } from './tree.js'

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
   * other whatever their x: a flow runs from one to the other by some way, through whatever other
   * frames, and not back. The ranks keep it: all of the downstream one lies below all of the
   * upstream one.
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
 * is a floor the flows may raise. Siblings that one flow orders are kept apart in rank too.
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
  const downstream = new Map<ItemId, Set<ItemId>>()
  for (const { upper, lower } of problem.above) {
    const [u, l] = [find(upper), find(lower)]
    if (u === l) continue
    const set = upstream.get(l) ?? new Set<ItemId>()
    set.add(u)
    upstream.set(l, set)
    const out = downstream.get(u) ?? new Set<ItemId>()
    out.add(l)
    downstream.set(u, out)
  }
  const floor = new Map<ItemId, number>()
  for (const [id, r] of hints.rank ?? []) {
    if (!parent.has(id)) continue
    const root = find(id)
    floor.set(root, Math.max(floor.get(root) ?? 0, r))
  }

  const tree = treeOf(problem)
  const free = new Set(problem.free)
  const stacked = stackedSiblings(problem, tree, free, find, downstream)

  const known = new Map<ItemId, number>()
  const walking = new Set<ItemId>()
  const lowest = new Map<string, number>()
  /** The last rank among what a sibling holds. */
  const lastOf = (key: string): number => {
    const got = lowest.get(key)
    if (got !== undefined) return got
    let hi = -1
    for (const id of stacked.items.get(key) ?? []) hi = Math.max(hi, rankOfRoot(find(id)))
    lowest.set(key, hi)
    return hi
  }
  const rankOfRoot = (root: ItemId): number => {
    const done = known.get(root)
    if (done !== undefined) return done
    // A chain that comes back on itself has no top; the step that closes it is not counted.
    if (walking.has(root)) return 0
    walking.add(root)
    let rank = floor.get(root) ?? 0
    for (const u of upstream.get(root) ?? []) rank = Math.max(rank, rankOfRoot(u) + 1)
    // what is downstream of a sibling lies below all of it, whatever way the flow gets there
    for (const id of stacked.members.get(root) ?? []) {
      for (const u of stacked.above.get(id) ?? []) rank = Math.max(rank, lastOf(u) + 1)
    }
    walking.delete(root)
    known.set(root, rank)
    return rank
  }
  const rank = new Map(problem.items.map((i) => [i.id, rankOfRoot(find(i.id))]))

  // The top row of a frame is that of the items the flows place in it; a frame with none of its
  // own takes the top row of the frame it is in, so a free item stays within its frames' rows.
  const topRowOf = (frame: FrameId): number => {
    const row = (tree.within.get(frame) ?? [])
      .filter((i) => !free.has(i.id))
      .map((i) => must(rank, i.id, 'rank of item'))
    if (row.length > 0) return Math.min(...row)
    const up = problem.frames.find((f) => f.id === frame)?.parent
    return up === undefined || frame === ROOT ? 0 : topRowOf(up)
  }
  for (const id of problem.free) {
    const own = problem.items.find((i) => i.id === id)
    if (own) rank.set(id, topRowOf(own.frame))
  }

  const lifted = [...(hints.rank ?? [])]
    .filter(([id, r]) => rank.has(id) && (rank.get(id) ?? 0) !== r)
    .map(([id]) => id)
    .sort()

  const span = new Map<string, readonly [number, number]>()
  for (const item of problem.items)
    span.set(item.id, [must(rank, item.id, 'rank of item'), must(rank, item.id, 'rank of item')])
  const frameSpan = (id: FrameId): readonly [number, number] => {
    const known = span.get(frameKey(id))
    if (known) return known
    const inside = (tree.within.get(id) ?? []).map((i) => must(rank, i.id, 'rank of item'))
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

  return {
    rank,
    max,
    span,
    ordered: (u, l) =>
      stacked.ordered.get(u)?.has(l) === true || stacked.ordered.get(l)?.has(u) === true,
    lifted,
  }
}

const meets = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
  for (const x of a) if (b.has(x)) return true
  return false
}

interface Stacked {
  /** The items (the free ones aside) that each sibling holds, by item id or `frameKey`. */
  items: Map<string, ItemId[]>
  /** The items of each class, by the root of the class. */
  members: Map<ItemId, ItemId[]>
  /** For each item, the siblings (at any level) that lie upstream of the sibling it is in. */
  above: Map<ItemId, string[]>
  /** For each sibling, the siblings of its frame that lie downstream of it. */
  ordered: Map<string, Set<string>>
}

/**
 * The flows read at the level where siblings are told apart. The classes (what the structure
 * holds level, or beside a host) and the flows between them are a graph; one sibling is upstream
 * of another when a class inside the first reaches a class inside the second, by any path at all.
 * Siblings that reach each other are one component and stand in no order; of the rest, those one
 * component reaches are ordered.
 */
function stackedSiblings(
  problem: Problem,
  tree: Tree,
  free: ReadonlySet<ItemId>,
  find: (id: ItemId) => ItemId,
  downstream: ReadonlyMap<ItemId, ReadonlySet<ItemId>>,
): Stacked {
  const below = new Map<ItemId, Set<ItemId>>()
  const reachOf = (c: ItemId, trail: Set<ItemId>): Set<ItemId> => {
    const got = below.get(c)
    if (got) return got
    const out = new Set<ItemId>()
    if (trail.has(c)) return out
    trail.add(c)
    for (const n of downstream.get(c) ?? []) {
      out.add(n)
      for (const m of reachOf(n, trail)) out.add(m)
    }
    trail.delete(c)
    below.set(c, out)
    return out
  }
  const frameOfKey = new Map(problem.frames.map((f) => [frameKey(f.id), f.id]))
  const items = new Map<string, ItemId[]>()
  const members = new Map<ItemId, ItemId[]>()
  for (const item of problem.items) {
    if (free.has(item.id)) continue
    items.set(item.id, [item.id])
    const root = find(item.id)
    members.set(root, [...(members.get(root) ?? []), item.id])
  }
  const above = new Map<ItemId, string[]>()
  const ordered = new Map<string, Set<string>>()
  for (const f of problem.frames) {
    const kids = [
      ...(tree.itemsIn.get(f.id) ?? []).filter((i) => !free.has(i.id)).map((i) => i.id),
      ...(tree.framesIn.get(f.id) ?? []).map((g) => frameKey(g.id)),
    ].sort(compare)
    const classes = new Map<string, Set<ItemId>>()
    const reach = new Map<string, Set<ItemId>>()
    for (const k of kids) {
      const inner = frameIn(frameOfKey, k)
      const ids =
        inner === undefined
          ? [k]
          : (tree.within.get(inner) ?? []).filter((i) => !free.has(i.id)).map((i) => i.id)
      items.set(k, ids)
      const cls = new Set(ids.map(find))
      classes.set(k, cls)
      const r = new Set<ItemId>()
      for (const c of cls) for (const d of reachOf(c, new Set())) r.add(d)
      reach.set(k, r)
    }
    const out = new Map<string, Set<string>>(kids.map((k) => [k, new Set()]))
    for (const u of kids) {
      const r = reach.get(u)
      if (!r || r.size === 0) continue
      for (const l of kids) {
        if (u === l) continue
        const cls = classes.get(l)
        // siblings that hold a class between them stand at one height there: not stacked
        if (cls && meets(cls, r) && !meets(cls, classes.get(u) ?? new Set())) out.get(u)?.add(l)
      }
    }

    // components (Tarjan): siblings that reach each other cannot be stacked either way
    const index = new Map<string, number>()
    const low = new Map<string, number>()
    const stack: string[] = []
    const onStack = new Set<string>()
    const comp = new Map<string, number>()
    let counter = 0
    let comps = 0
    const visit = (v: string) => {
      index.set(v, counter)
      low.set(v, counter)
      counter++
      stack.push(v)
      onStack.add(v)
      for (const w of [...(out.get(v) ?? [])].sort(compare)) {
        if (!index.has(w)) {
          visit(w)
          low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0))
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0))
        }
      }
      if (low.get(v) === index.get(v)) {
        for (;;) {
          const w = stack.pop()
          if (w === undefined) break
          onStack.delete(w)
          comp.set(w, comps)
          if (w === v) break
        }
        comps++
      }
    }
    for (const k of kids) if (!index.has(k)) visit(k)

    // the components form a DAG, the downstream ones numbered first
    const next: Set<number>[] = Array.from({ length: comps }, () => new Set())
    for (const [v, ws] of out) {
      for (const w of ws) {
        const a = comp.get(v)
        const b = comp.get(w)
        if (a !== undefined && b !== undefined && a !== b) next[a]?.add(b)
      }
    }
    const reaches: Set<number>[] = Array.from({ length: comps }, () => new Set())
    for (let c = 0; c < comps; c++) {
      const r = reaches[c]
      for (const d of next[c] ?? []) {
        r?.add(d)
        for (const e of reaches[d] ?? []) r?.add(e)
      }
    }
    for (const u of kids) {
      const a = comp.get(u)
      if (a === undefined) continue
      for (const l of kids) {
        const b = comp.get(l)
        if (b === undefined || a === b || !reaches[a]?.has(b)) continue
        const set = ordered.get(u) ?? new Set<string>()
        set.add(l)
        ordered.set(u, set)
        for (const id of items.get(l) ?? []) above.set(id, [...(above.get(id) ?? []), u])
      }
    }
  }
  return { items, members, above, ordered }
}
