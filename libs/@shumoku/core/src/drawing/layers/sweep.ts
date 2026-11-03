// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../../structure/keys.js'
import type { Judge } from './cost.js'
import { total } from './cost.js'
import { type FlattenIn, flatten } from './flatten.js'
import { median, range } from './median.js'
import { pinned } from './start.js'
import type { Cluster, Ctx, State } from './types.js'

/** What a sweep reads: the rows, and the places each place has above, below and beside it. */
export type SweepIn = FlattenIn & Pick<Ctx, 'problem' | 'hints' | 'ownerOf' | 'adj'>

/** The elements of a child that stand in rank `r`. */
const elementsAt = (
  cx: Pick<Ctx, 'frameOfKey' | 'dummies' | 'items' | 'rankOf'>,
  s: State,
  key: string,
  r: number,
): readonly string[] => {
  const inner = cx.frameOfKey.get(key)
  if (inner !== undefined) {
    const row = s.rows.get(inner)
    if (!row) return []
    return [...row.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...row.tail].flatMap((k) =>
      elementsAt(cx, s, k, r),
    )
  }
  const d = cx.dummies.get(key)
  if (d) return d.rank === r ? [key] : []
  const item = cx.items.get(key)
  if (!item || cx.rankOf(key) !== r) return []
  return item.kind === 'unit' ? (s.members.get(key) ?? []) : [key]
}

/**
 * One pass over the ranks, down or up: each child of a frame is moved towards the median place
 * of what its lines lead to in the rank behind, and the members of a unit likewise.
 */
function sweepOnce(cx: SweepIn, start: State, dir: 'down' | 'up'): State {
  const { problem, ranks, items, hints, dummies, ownerOf, rankOf } = cx
  let s = start
  let f = flatten(cx, s)
  const place = (k: string) => {
    const r = rankOf(ownerOf.get(k) ?? k)
    const rr = dummies.get(k)?.rank ?? r
    return ((f.pos.get(k) ?? 0) + 0.5) / Math.max(1, f.seq[rr]?.length ?? 1)
  }
  const around = (k: string): number[] => {
    const a = cx.adj.get(k)
    if (!a) return []
    return [...(dir === 'down' ? a.up : a.down), ...a.level].map(place)
  }
  const order = dir === 'down' ? range(1, ranks.max) : range(0, ranks.max - 1).reverse()
  for (const r of order) {
    const members = new Map(s.members)
    for (const [unit, list] of s.members) {
      const item = items.get(unit)
      if (!item || rankOf(unit) !== r || hints.members?.has(unit)) continue
      const keyed = list.map((m, i) => {
        const xs = around(m)
        return { m, i, at: xs.length > 0 ? median(xs) : undefined }
      })
      keyed.sort((p, q) =>
        p.at === undefined || q.at === undefined ? p.i - q.i : p.at - q.at || compare(p.m, q.m),
      )
      members.set(
        unit,
        keyed.map((k) => k.m),
      )
    }
    const rowsNow = new Map(s.rows)
    for (const frame of problem.frames) {
      const row = rowsNow.get(frame.id)
      if (!row) continue
      const present: { c: Cluster; at: number; slot: number }[] = []
      for (const [slot, c] of row.movable.entries()) {
        const els = [c.anchor, ...c.satellites].flatMap((k) =>
          elementsAt(cx, { rows: s.rows, members }, k, r),
        )
        if (els.length === 0) continue
        const xs = els.flatMap(around)
        const own = els.map(place)
        present.push({ c, slot, at: median(xs.length > 0 ? xs : own) })
      }
      const sorted = [...present].sort((p, q) => p.at - q.at || p.slot - q.slot)
      const movable = [...row.movable]
      for (const [i, p] of present.entries()) {
        const put = sorted[i]
        if (put) movable[p.slot] = put.c
      }
      rowsNow.set(frame.id, { ...row, movable: pinned(cx, frame.id, movable) })
    }
    s = { rows: rowsNow, members }
    f = flatten(cx, s)
  }
  return s
}

/** What an order is called, to tell when the sweeps have come back to one they have seen. */
const name = (s: State) =>
  JSON.stringify([
    [...s.rows].map(([f, r]) => [f, r.movable.map((c) => [c.anchor, c.satellites]), r.tail]),
    [...s.members],
  ])

/**
 * The median sweeps, down then up, from an order. They stop when an order comes back with the
 * sweep that follows it, and the best order met on the way is returned.
 */
export function sweepFrom(cx: SweepIn, judge: Judge, start: State): State {
  let current = start
  let best = current
  let bestCost = total(judge.costs(flatten(cx, current)))
  const seen = new Set<string>()
  for (let dir: 'down' | 'up' = 'down'; ; dir = dir === 'down' ? 'up' : 'down') {
    const turn = `${dir} ${name(current)}`
    if (seen.has(turn)) break
    seen.add(turn)
    current = sweepOnce(cx, current, dir)
    const c = total(judge.costs(flatten(cx, current)))
    if (judge.better(c, current, bestCost, best)) {
      bestCost = c
      best = current
    }
  }
  return best
}
