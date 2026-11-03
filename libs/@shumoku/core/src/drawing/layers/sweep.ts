// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../../structure/keys.js'
import { dummyIn, frameIn } from '../keys.js'
import type { Judge } from './cost.js'
import { total } from './cost.js'
import { type FlattenIn, flatten } from './flatten.js'
import { median, range } from './median.js'
import { pinned } from './start.js'
import { type Cluster, fingerprint, type Lookup, type State } from './types.js'

/** What a sweep reads: the rows, and the places each place has above, below and beside it. */
export type SweepIn = FlattenIn & Pick<Lookup, 'problem' | 'hints' | 'ownerOf' | 'adj'>

/** The elements of a child that stand in rank `r`. */
const elementsAt = (
  lookup: Pick<Lookup, 'frameOfKey' | 'dummies' | 'items' | 'rankOf'>,
  state: State,
  key: string,
  r: number,
): readonly string[] => {
  const inner = frameIn(lookup.frameOfKey, key)
  if (inner !== undefined) {
    const row = state.rows.get(inner)
    if (!row) return []
    return [...row.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...row.tail].flatMap((k) =>
      elementsAt(lookup, state, k, r),
    )
  }
  const d = dummyIn(lookup.dummies, key)
  if (d) return d.rank === r ? [key] : []
  const item = lookup.items.get(key)
  if (!item || lookup.rankOf(key) !== r) return []
  return item.kind === 'unit' ? (state.members.get(key) ?? []) : [key]
}

/**
 * One pass over the ranks, down or up: each child of a frame is moved towards the median place
 * of what its lines lead to in the rank behind, and the members of a unit likewise.
 */
function sweepOnce(lookup: SweepIn, start: State, dir: 'down' | 'up'): State {
  const { problem, ranks, items, hints, dummies, ownerOf, rankOf } = lookup
  let state = start
  let flat = flatten(lookup, state)
  const place = (k: string) => {
    const rr = dummyIn(dummies, k)?.rank ?? rankOf(ownerOf.get(k) ?? k)
    return ((flat.pos.get(k) ?? 0) + 0.5) / Math.max(1, flat.seq[rr]?.length ?? 1)
  }
  const around = (k: string): number[] => {
    const a = lookup.adj.get(k)
    if (!a) return []
    return [...(dir === 'down' ? a.up : a.down), ...a.level].map(place)
  }
  const order = dir === 'down' ? range(1, ranks.max) : range(0, ranks.max - 1).reverse()
  for (const r of order) {
    const members = new Map(state.members)
    for (const [unit, list] of state.members) {
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
    const rowsNow = new Map(state.rows)
    for (const frame of problem.frames) {
      const row = rowsNow.get(frame.id)
      if (!row) continue
      const present: { c: Cluster; at: number; slot: number }[] = []
      for (const [slot, c] of row.movable.entries()) {
        const els = [c.anchor, ...c.satellites].flatMap((k) =>
          elementsAt(lookup, { rows: state.rows, members }, k, r),
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
      rowsNow.set(frame.id, { ...row, movable: pinned(lookup, frame.id, movable) })
    }
    state = { rows: rowsNow, members }
    flat = flatten(lookup, state)
  }
  return state
}

/**
 * The median sweeps, down then up, from an order. They stop when an order comes back with the
 * sweep that follows it, and the best order met on the way is returned.
 */
export function sweepFrom(lookup: SweepIn, judge: Judge, start: State): State {
  let current = start
  let best = current
  let bestCost = total(judge.costs(flatten(lookup, current)))
  const seen = new Set<string>()
  for (let dir: 'down' | 'up' = 'down'; ; dir = dir === 'down' ? 'up' : 'down') {
    const turn = `${dir} ${fingerprint(current)}`
    if (seen.has(turn)) break
    seen.add(turn)
    current = sweepOnce(lookup, current, dir)
    const c = total(judge.costs(flatten(lookup, current)))
    if (judge.better(c, current, bestCost, best)) {
      bestCost = c
      best = current
    }
  }
  return best
}
