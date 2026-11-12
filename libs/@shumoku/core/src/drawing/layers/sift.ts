// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey } from '../../structure/keys.js'
import { dummyIn, dummyKey, frameIn, frameKey, hasDummy } from '../keys.js'
import type { FrameId } from '../problem.js'
import type { Judge } from './cost.js'
import { spanOfKey, total } from './cost.js'
import { type FlattenIn, flatten } from './flatten.js'
import { median, range } from './median.js'
import { endsOf, portsOf } from './ports.js'
import { columnKeys } from './start.js'
import type { Cluster, Costs, Flat, Lookup, PortGroup, Row, State } from './types.js'

interface Stretch {
  node: string
  lo: number
  hi: number
}

/**
 * What sifting learns about the problem once and asks again and again: the trail of a child's
 * lines, the nodes an element stands in, and the stretches of a frame in the order in hand.
 */
interface Memo {
  trails: Map<string, string[]>
  /** The nodes an element stands in, innermost first, each with the frame it is a child of. */
  chains: Map<string, { node: string; parent: FrameId }[]>
  /** The child of a frame an element stands in, by frame. */
  kids: Map<FrameId, Map<string, string | null>>
  /** The children of a frame in each row of the order in hand, by frame and rank. */
  stretches: Map<string, Stretch[]>
}

/** The rows a trial changes, laid over the rows it started from. */
interface Overlay {
  base: Flat
  fresh: Map<number, string[]>
  over: Map<string, number>
}

const spanOf = (lookup: Pick<Lookup, 'dummies' | 'ranks'>, key: string): number[] => {
  const d = dummyIn(lookup.dummies, key)
  const s = d ? [d.rank, d.rank] : lookup.ranks.span.get(key)
  return s ? range(s[0], s[1]) : []
}

const ownerFrame = (lookup: Pick<Lookup, 'dummies' | 'items'>, key: string): FrameId | undefined =>
  dummyIn(lookup.dummies, key)?.frame ?? lookup.items.get(key)?.frame

/**
 * The lines that end in the given children, each from its end outwards, nearer ranks first:
 * the keys of the dummies on them and of the box at the far end.
 */
const trailOf = (
  lookup: Pick<Lookup, 'problem' | 'tree' | 'frameOfKey' | 'rankOf' | 'dummies' | 'items'>,
  memo: Memo,
  mine: readonly string[],
): string[] => {
  const id = joinKey(mine)
  const known = memo.trails.get(id)
  if (known) return known
  const inside = new Set(
    mine.flatMap((key) => {
      const f = frameIn(lookup.frameOfKey, key)
      return f === undefined ? [key] : (lookup.tree.within.get(f) ?? []).map((i) => i.id)
    }),
  )
  const found: { key: string; dist: number; line: string }[] = []
  for (const line of lookup.problem.lines) {
    if (line.role === 'inside' || line.a.item === line.b.item) continue
    const [ina, inb] = [inside.has(line.a.item), inside.has(line.b.item)]
    if (ina === inb) continue
    const [mineEnd, other] = ina ? [line.a, line.b] : [line.b, line.a]
    const [from, to] = [lookup.rankOf(mineEnd.item), lookup.rankOf(other.item)]
    const step = to > from ? 1 : -1
    for (let r = from + step; r !== to && to !== from; r += step)
      found.push({ key: dummyKey(line.family, r), dist: Math.abs(r - from), line: line.id })
    found.push({ key: other.item, dist: Math.abs(to - from), line: line.id })
  }
  found.sort((p, q) => p.dist - q.dist || compare(p.line, q.line) || compare(p.key, q.key))
  const out = [...new Set(found.map((f) => f.key))].filter(
    (key) => hasDummy(lookup.dummies, key) || lookup.items.has(key),
  )
  memo.trails.set(id, out)
  return out
}

type Chains = Pick<Lookup, 'dummies' | 'ownerOf' | 'items' | 'parentFrame'>

const chainOfElement = (lookup: Chains, memo: Memo, k: string) => {
  const known = memo.chains.get(k)
  if (known) return known
  const d = dummyIn(lookup.dummies, k)
  const owner = d ? k : (lookup.ownerOf.get(k) ?? k)
  const out = [{ node: owner, parent: d ? d.frame : (lookup.items.get(owner)?.frame ?? '') }]
  for (let f = out[0]?.parent; f !== undefined && f !== ''; f = lookup.parentFrame.get(f))
    out.push({ node: frameKey(f), parent: lookup.parentFrame.get(f) ?? '' })
  memo.chains.set(k, out)
  return out
}

/** The child of a frame an element stands in, if it stands in the frame. */
const nodeIn = (lookup: Chains, memo: Memo, frame: FrameId, k: string): string | undefined => {
  let m = memo.kids.get(frame)
  if (!m) {
    m = new Map()
    memo.kids.set(frame, m)
  }
  let node = m.get(k)
  if (node === undefined) {
    node = chainOfElement(lookup, memo, k).find((c) => c.parent === frame)?.node ?? null
    m.set(k, node)
  }
  return node ?? undefined
}

const nodesAt = (list: readonly Cluster[]) => {
  const order = new Map<string, number>()
  const cluster = new Map<string, number>()
  let i = 0
  for (const [j, c] of list.entries())
    for (const n of [c.anchor, ...c.satellites]) {
      order.set(n, i++)
      cluster.set(n, j)
    }
  return { order, cluster }
}

const rowAt = (overlay: Overlay, r: number) => overlay.fresh.get(r) ?? overlay.base.seq[r] ?? []
const posAt = (overlay: Overlay, k: string) => overlay.over.get(k) ?? overlay.base.pos.get(k)
const edit = (overlay: Overlay, r: number): string[] => {
  let copy = overlay.fresh.get(r)
  if (!copy) {
    copy = [...(overlay.base.seq[r] ?? [])]
    overlay.fresh.set(r, copy)
  }
  return copy
}
const reindex = (overlay: Overlay, r: number, lo: number, hi: number) => {
  const row = overlay.fresh.get(r) ?? []
  for (let i = lo; i <= hi; i++) overlay.over.set(row[i] ?? '', i)
}

/** The frame's children in a row, left to right, each with the stretch it fills. */
const stretchesOf = (
  lookup: Chains,
  memo: Memo,
  overlay: Overlay,
  frame: FrameId,
  r: number,
): Stretch[] => {
  const cached = overlay.fresh.has(r) ? undefined : memo.stretches.get(`${frame}|${r}`)
  if (cached) return cached
  const row = rowAt(overlay, r)
  const out: Stretch[] = []
  let started = false
  for (const [i, k] of row.entries()) {
    const node = nodeIn(lookup, memo, frame, k)
    if (node === undefined) {
      if (started) break
      continue
    }
    started = true
    const last = out[out.length - 1]
    if (last && last.node === node) last.hi = i
    else out.push({ node, lo: i, hi: i })
  }
  if (!overlay.fresh.has(r)) memo.stretches.set(`${frame}|${r}`, out)
  return out
}

/**
 * The child at its place: the frame's stretch of each row it fills, in the order of the children.
 * Writes the rows it changes into the overlay `overlay`, nothing else.
 */
const seatChild = (
  lookup: Chains & Pick<Lookup, 'dummies' | 'ranks'>,
  memo: Memo,
  overlay: Overlay,
  frame: FrameId,
  movable: readonly Cluster[],
  mine: readonly string[],
) => {
  const { order } = nodesAt(movable)
  for (const r of new Set(mine.flatMap((key) => spanOf(lookup, key)))) {
    const groups = stretchesOf(lookup, memo, overlay, frame, r)
    const sorted = [...groups].sort(
      (p, q) => (order.get(p.node) ?? 1e9) - (order.get(q.node) ?? 1e9),
    )
    if (sorted.every((g, i) => g === groups[i])) continue
    const row = edit(overlay, r)
    const old = [...row]
    const lo = groups[0]?.lo ?? 0
    const hi = groups[groups.length - 1]?.hi ?? 0
    row.splice(lo, hi - lo + 1, ...sorted.flatMap((g) => old.slice(g.lo, g.hi + 1)))
    reindex(overlay, r, lo, hi)
  }
}

/**
 * Each place on the trail of the child set again: its box or dummy is taken from where it stands
 * and put among the frame's children by the median of where what lies before and after it
 * stands. Returns the children in their new order, and writes the rows it changes into the
 * overlay `overlay`.
 */
const pullTrail = (
  lookup: Chains & Pick<Lookup, 'rankOf' | 'adj'>,
  memo: Memo,
  overlay: Overlay,
  frame: FrameId,
  start: readonly Cluster[],
  trail: readonly string[],
): readonly Cluster[] => {
  let movable = start
  let nodes = nodesAt(movable)
  const placeAt = (k: string) => {
    const rr = dummyIn(lookup.dummies, k)?.rank ?? lookup.rankOf(lookup.ownerOf.get(k) ?? k)
    return ((posAt(overlay, k) ?? 0) + 0.5) / Math.max(1, rowAt(overlay, rr).length)
  }
  for (const key of trail) {
    const rank = dummyIn(lookup.dummies, key)?.rank ?? lookup.rankOf(key)
    const { cluster } = nodes
    const at = cluster.get(key)
    if (at === undefined || movable[at]?.anchor !== key) continue
    const row = rowAt(overlay, rank)
    // the stretch of the child with its satellites, and of each other child
    const span = new Map<number, [number, number]>()
    for (const g of stretchesOf(lookup, memo, overlay, frame, rank)) {
      const j = cluster.get(g.node)
      if (j === undefined) continue
      const known = span.get(j)
      if (known) span.set(j, [Math.min(known[0], g.lo), Math.max(known[1], g.hi)])
      else span.set(j, [g.lo, g.hi])
    }
    const own = span.get(at)
    if (!own) continue
    const near = row
      .slice(own[0], own[1] + 1)
      .flatMap((k) => [
        ...(lookup.adj.get(k)?.up ?? []),
        ...(lookup.adj.get(k)?.down ?? []),
        ...(lookup.adj.get(k)?.level ?? []),
      ])
      .map(placeAt)
    if (near.length === 0) continue
    const want = median(near)
    // the first child to the right of the wanted place, else after the last
    let before = -1
    let beforeFrom = 0
    let last = -1
    let lastTo = 0
    for (const j of [...span.keys()].sort((p, q) => p - q)) {
      const s = span.get(j)
      if (j === at || !s) continue
      last = j
      lastTo = s[1]
      if (before < 0 && ((s[0] + s[1]) / 2 + 0.5) / row.length > want) {
        before = j
        beforeFrom = s[0]
      }
    }
    if (last < 0) continue
    const [slot, p] = before >= 0 ? [before, beforeFrom] : [last + 1, lastTo + 1]
    const len = own[1] - own[0] + 1
    const to = p > own[0] ? p - len : p
    if (to === own[0]) continue
    const edited = edit(overlay, rank)
    const block = edited.splice(own[0], len)
    edited.splice(to, 0, ...block)
    reindex(overlay, rank, Math.min(own[0], to), Math.max(own[0], to) + len - 1)
    const others = movable.filter((_, j) => j !== at)
    const cut = slot > at ? slot - 1 : slot
    const cl = movable[at]
    if (cl) movable = [...others.slice(0, cut), cl, ...others.slice(cut)]
    nodes = nodesAt(movable)
  }
  return movable
}

/** Where the ports beside the changed rows stand again. */
const portsAgain = (lookup: Pick<Lookup, 'groupsAt'>, overlay: Overlay): Map<string, number> => {
  const ends = new Map<string, number>()
  const stood = new Set<PortGroup>()
  for (const r of overlay.fresh.keys()) {
    for (const g of lookup.groupsAt[r] ?? []) stood.add(g)
    for (const g of lookup.groupsAt[r - 1] ?? []) if (g.side === 'bottom') stood.add(g)
    for (const g of lookup.groupsAt[r + 1] ?? []) if (g.side === 'top') stood.add(g)
  }
  for (const g of stood)
    for (const [id, at] of endsOf(
      g,
      portsOf(g, (k) => posAt(overlay, k)),
      (k) => posAt(overlay, k),
    ))
      ends.set(id, at)
  return ends
}

type SettleIn = Chains & Pick<Lookup, 'dummies' | 'ranks' | 'rankOf' | 'adj' | 'groupsAt'>

/**
 * The rows after a child is put at a place of its frame, and what its lines lead to set
 * again: each is taken from its place in its own rank's row and put among the frame's
 * children by the median of where what lies before and after it stands. Only the rows that
 * change are copied; `same(r)` tells of the rows that did not.
 */
const settle = (
  lookup: SettleIn,
  memo: Memo,
  from: State,
  base: Flat,
  frame: FrameId,
  row: Row,
  moved: readonly Cluster[],
  mine: readonly string[],
  trail: readonly string[],
): { trial: State; tf: Flat; same: (r: number) => boolean } => {
  const overlay: Overlay = { base, fresh: new Map(), over: new Map() }
  seatChild(lookup, memo, overlay, frame, moved, mine)
  const movable = pullTrail(lookup, memo, overlay, frame, moved, trail)
  // the rows that came out as they were are not changed rows
  for (const [r, row] of overlay.fresh) {
    const was = base.seq[r] ?? []
    if (row.length === was.length && row.every((k, i) => k === was[i])) overlay.fresh.delete(r)
  }
  const ends = portsAgain(lookup, overlay)
  return {
    trial: { rows: new Map(from.rows).set(frame, { ...row, movable }), members: from.members },
    tf: {
      seq: base.seq.map((cells, r) => overlay.fresh.get(r) ?? cells),
      pos: { get: (k) => posAt(overlay, k) },
      end: { get: (k) => ends.get(k) ?? base.end.get(k) },
    },
    same: (r) => !overlay.fresh.has(r),
  }
}

const agree = (fast: Costs, slow: Costs) => {
  if (JSON.stringify(fast) !== JSON.stringify(slow))
    throw new Error(`incremental costs differ: ${JSON.stringify(fast)} ${JSON.stringify(slow)}`)
}

/** What sifting reads: the rows, the problem as looked up, and the hints that pin a child. */
export type SiftIn = FlattenIn &
  SettleIn &
  Pick<Lookup, 'problem' | 'tree' | 'frameOfKey' | 'rankOf' | 'items' | 'hints' | 'dummies'>

/**
 * Sifting: each child of a frame tried at every place among its siblings, with what its lines
 * lead to set again: the dummies of the frame on them, and the boxes of the frame at their far
 * ends, each by the median of the places on both sides, the nearest first. Goes on until no
 * child can be moved to a better place.
 */
export function siftFrom(
  lookup: SiftIn,
  judge: Judge,
  start: State,
  options: { verify?: boolean } = {},
): State {
  const memo: Memo = { trails: new Map(), chains: new Map(), kids: new Map(), stretches: new Map() }
  let current = start
  let flat = flatten(lookup, current)
  let cost = judge.costs(flat)
  const columns = columnKeys(lookup)
  const hintedKey = (frame: FrameId, a: string) =>
    lookup.hints.order?.get(frame)?.includes(a) === true || columns.has(a)
  for (let changed = true; changed; ) {
    changed = false
    for (const frame of lookup.problem.frames) {
      const n = current.rows.get(frame.id)?.movable.length ?? 0
      for (let k = 0; k < n; k++) {
        const row = current.rows.get(frame.id)
        const c = row?.movable[k]
        if (!row || !c || hintedKey(frame.id, c.anchor)) continue
        const mine = [c.anchor, ...c.satellites]
        const trail = trailOf(lookup, memo, mine).filter(
          (key) => ownerFrame(lookup, key) === frame.id && !hintedKey(frame.id, key),
        )
        const rest = row.movable.filter((x) => x !== c)
        let best: { state: State; cost: Costs } = { state: current, cost }
        // only the siblings it shares a rank with, or must stand beside, tell one place from
        // another: it is tried just after each of them, and first of all
        const places = new Set<number>([0, k])
        for (const [i, other] of rest.entries()) {
          const theirs = [other.anchor, ...other.satellites]
          const meets = mine.some((m) =>
            theirs.some((t) => {
              const [sm, st] = [spanOfKey(lookup, m), spanOfKey(lookup, t)]
              return (
                (sm[0] <= st[1] && st[0] <= sm[1]) || (judge.apartKids.get(m) ?? []).includes(t)
              )
            }),
          )
          if (meets) places.add(i + 1)
        }
        for (const at of [...places].sort((x, y) => x - y)) {
          const moved = [...rest.slice(0, at), c, ...rest.slice(at)]
          const { trial, tf, same } = settle(
            lookup,
            memo,
            current,
            flat,
            frame.id,
            row,
            moved,
            mine,
            trail,
          )
          // only the gaps beside a row that changed are counted again
          const tc: Costs = {
            wall: cost.wall.map((v, g) => (same(g) && same(g + 1) ? v : judge.wallCost(g, tf))),
            gap: cost.gap.map((v, g) => (same(g) && same(g + 1) ? v : judge.gapCost(g, tf))),
            level: cost.level.map((v, r) => (same(r) ? v : judge.levelCost(r, tf))),
          }
          if (options.verify) agree(tc, judge.costs(flatten(lookup, trial)))
          if (judge.better(total(tc), trial, total(best.cost), best.state))
            best = { state: trial, cost: tc }
        }
        if (best.state !== current) {
          current = best.state
          flat = flatten(lookup, current)
          memo.stretches.clear()
          cost = best.cost
          changed = true
        }
      }
    }
  }
  return current
}
