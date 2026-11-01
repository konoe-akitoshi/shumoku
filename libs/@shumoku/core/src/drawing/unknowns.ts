// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { joinKey } from '../structure/keys.js'
import { solveAxis } from './axis.js'
import type { Demand } from './problem.js'
import { meet, type Room } from './rooms.js'
import type { Wall } from './space.js'
import { EPS } from './tolerance.js'

/**
 * The unknowns of one axis, each a coordinate across a run (or a port along its edge), and what is
 * asked of them: the room each may lie in, which must come before which with how much between,
 * and where each is pulled to.
 */
export class Unknowns {
  lo: number[] = []
  hi: number[] = []
  /** The items that make each end of a room, and where their edges are, for a request for more room. */
  loBy: (Room['loBy'] | undefined)[] = []
  hiBy: (Room['hiBy'] | undefined)[] = []
  /** What each unknown is, for the report of where the room falls short. */
  names: string[] = []
  targets: { i: number; t: number }[] = []
  pairs: { i: number; j: number }[] = []
  sep: { i: number; j: number; d: number }[] = []
  rejected = 0
  laneLost = 0
  apart = 0
  private parent: number[] = []
  private out: number[][] = []

  add(name: string, room: Room, target?: number): number {
    const i = this.parent.length
    this.names.push(name)
    this.parent.push(i)
    this.lo.push(room.lo)
    this.hi.push(room.hi)
    this.loBy.push(room.loBy)
    this.hiBy.push(room.hiBy)
    this.out.push([])
    if (target !== undefined) this.targets.push({ i, t: target })
    return i
  }

  find(i: number): number {
    let r = i
    while ((this.parent[r] ?? r) !== r) r = this.parent[r] ?? r
    let c = i
    while (c !== r) {
      const next = this.parent[c] ?? r
      this.parent[c] = r
      c = next
    }
    return r
  }

  /** Makes two unknowns one. Done before anything is asked of them. */
  join(i: number, j: number) {
    const a = this.find(i)
    const b = this.find(j)
    if (a === b) return
    this.parent[b] = a
    this.limit(a, this.roomOf(b))
  }

  private roomOf(r: number): Room {
    const loBy = this.loBy[r]
    const hiBy = this.hiBy[r]
    return {
      lo: this.lo[r] ?? 0,
      hi: this.hi[r] ?? 0,
      ...(loBy && { loBy }),
      ...(hiBy && { hiBy }),
    }
  }

  limit(i: number, room: Room) {
    const r = this.find(i)
    const met = meet(this.roomOf(r), room)
    this.lo[r] = met.lo
    this.hi[r] = met.hi
    this.loBy[r] = met.loBy
    this.hiBy[r] = met.hiBy
  }

  /**
   * Where the orders asked for cannot be kept in the rooms. The lowest each can lie at follows from
   * its own room and what must come before it, a gap or more each, and the highest in the same way
   * from what must come after; where the one passes the other the line of orders does not fit, by
   * the difference. The two ends of what does not fit are the rooms that began and ended it, and the
   * items that make those are what to ask room of. Where there is none to ask, it is counted as it is.
   */
  shortages(
    /** Whether room may be asked between two boxes that make the ends of a chain: not where the layout could not keep them in that order. */
    allowed: (before: Wall, after: Wall) => boolean = () => true,
    /** What falls short by less than this is not short: it is within what the solve keeps to. */
    slack = EPS,
  ): {
    asks: Omit<Demand, 'axis'>[]
    unfixed: number
    /** Where the shortage is, counted once for each connected set of orders: a chain is one place, however many of its values stand short. */
    places: number
    /** Each place: the value the chain's low end comes from and the one its high end comes from, and by how much it falls short. */
    where: {
      low: string
      high: string
      short: number
      asked: boolean
      chain: string[]
      asks: Omit<Demand, 'axis'>[]
      /** The values of the chain, the one that falls shortest first. */
      members: number[]
    }[]
  } {
    const roots = [...this.parent.keys()].filter((i) => this.find(i) === i)
    const into = new Map<number, number>()
    const next = new Map<number, { j: number; d: number }[]>()
    for (const { i, j, d } of this.sep) {
      into.set(j, (into.get(j) ?? 0) + 1)
      next.set(i, [...(next.get(i) ?? []), { j, d }])
    }
    const topo = roots.filter((i) => !into.has(i))
    for (const i of topo) {
      for (const { j } of next.get(i) ?? []) {
        into.set(j, (into.get(j) ?? 1) - 1)
        if (into.get(j) === 0) topo.push(j)
      }
    }
    const low = new Map<number, { at: number; from: number; via?: number }>(
      roots.map((i) => [i, { at: this.lo[i] ?? 0, from: i }]),
    )
    const high = new Map<number, { at: number; from: number; via?: number }>(
      roots.map((i) => [i, { at: this.hi[i] ?? 0, from: i }]),
    )
    for (const i of topo) {
      const here = low.get(i)
      if (!here) continue
      for (const { j, d } of next.get(i) ?? []) {
        const there = low.get(j)
        if (there && here.at + d > there.at) {
          low.set(j, { at: here.at + d, from: here.from, via: i })
        }
      }
    }
    for (const i of [...topo].reverse()) {
      const here = high.get(i)
      if (!here) continue
      for (const { j, d } of next.get(i) ?? []) {
        const there = high.get(j)
        if (there && there.at - d < here.at) {
          high.set(i, { at: there.at - d, from: there.from, via: j })
        }
      }
    }
    const asks = new Map<string, Omit<Demand, 'axis'>>()
    let unfixed = 0
    const set = new Map<number, number>(roots.map((i) => [i, i]))
    const head = (i: number): number => {
      const up = set.get(i) ?? i
      if (up === i) return i
      const r = head(up)
      set.set(i, r)
      return r
    }
    for (const { i, j } of this.sep) set.set(head(j), head(i))
    const short = new Set<number>()
    const where = new Map<
      number,
      {
        low: string
        high: string
        short: number
        asked: boolean
        chain: string[]
        asks: Omit<Demand, 'axis'>[]
        members: number[]
      }
    >()
    const shortBy = (k: number) => (low.get(k)?.at ?? 0) - (high.get(k)?.at ?? 0)
    const width = (k: number) => (this.hi[k] ?? 0) - (this.lo[k] ?? 0)
    for (const i of roots) {
      const l = low.get(i)
      const h = high.get(i)
      if (!l || !h || l.at <= h.at + slack) continue
      short.add(head(i))
      const label = (k: number) =>
        `${this.names[k] ?? ''} [${Math.round(this.lo[k] ?? 0)}${(this.loBy[k] ?? []).map((w) => ` ${w.item}`).join('')}, ${Math.round(this.hi[k] ?? 0)}${(this.hiBy[k] ?? []).map((w) => ` ${w.item}`).join('')}]`
      const ids: number[] = []
      for (let k: number | undefined = i; k !== undefined; k = low.get(k)?.via) ids.unshift(k)
      for (let k = high.get(i)?.via; k !== undefined; k = high.get(k)?.via) ids.push(k)
      const place = {
        low: this.names[l.from] ?? '',
        high: this.names[h.from] ?? '',
        short: l.at - h.at,
        asked: false,
        chain: ids.map(label),
        asks: [] as Omit<Demand, 'axis'>[],
        members: [...ids].sort((p, q) => shortBy(q) - shortBy(p) || width(p) - width(q) || p - q),
      }
      const known = where.get(head(i))
      if (!known || known.short < place.short) where.set(head(i), place)
      // The shortage is asked of every box that makes either end: moving one of several that make
      // the same wall changes nothing, since the next of them is then the end.
      const before = this.loBy[l.from] ?? []
      const after = this.hiBy[h.from] ?? []
      let asked = false
      for (const x of before) {
        for (const y of after) {
          if (x.item === y.item || !allowed(x, y)) continue
          asked = true
          const key = joinKey([x.item, x.at, y.item, y.at])
          const min = y.edge - x.edge + (l.at - h.at)
          const known = asks.get(key)
          if (!known || known.min < min) {
            asks.set(key, { before: x.item, after: y.item, min, beforeAt: x.at, afterAt: y.at })
          }
        }
      }
      if (!asked) unfixed++
      const found = where.get(head(i))
      if (found && asked) {
        found.asked = true
        for (const x of before) {
          for (const y of after) {
            if (x.item === y.item || !allowed(x, y)) continue
            const key = joinKey([x.item, x.at, y.item, y.at])
            const ask = asks.get(key)
            if (ask && !found.asks.some((o) => o.before === x.item && o.after === y.item)) {
              found.asks.push(ask)
            }
          }
        }
      }
    }
    return { asks: [...asks.values()], unfixed, places: short.size, where: [...where.values()] }
  }

  private guesses = new Map<number, number>()
  /** Where an unknown is likely to end up: where it is pulled to, as far as its room allows. */
  guess(i: number): number {
    const r = this.find(i)
    const known = this.guesses.get(r)
    if (known !== undefined) return known
    const t = this.targets.filter((x) => this.find(x.i) === r).map((x) => x.t)
    const want = t.length > 0 ? t.reduce((a, b) => a + b, 0) / t.length : 0
    const lo = this.lo[r] ?? Number.NEGATIVE_INFINITY
    const hi = this.hi[r] ?? Number.POSITIVE_INFINITY
    const v = Math.min(Math.max(want, lo), Math.max(lo, hi))
    this.guesses.set(r, v)
    return v
  }

  room(i: number): [number, number] {
    const r = this.find(i)
    return [this.lo[r] ?? 0, this.hi[r] ?? 0]
  }

  /**
   * `j` lies at least `d` after `i`, unless that would make a ring of orders, which none can keep.
   * An order that the order layer gave and that makes a ring is its fault and is counted; one of
   * the lanes in a cell (`lane`) is counted apart.
   */
  before(i: number, j: number, d: number, lane = false) {
    const a = this.find(i)
    const b = this.find(j)
    if (a === b) return
    // An order is kept whether or not the rooms of the two can keep it: where they cannot, that
    // is a want of room, which is asked of the layout (`shortages`), not a reason to give the order
    // up. Only a ring of orders, which no position satisfies, is left out and counted.
    if (this.reaches(b, a)) {
      if (lane) this.laneLost++
      else this.rejected++
      return
    }
    this.out[a]?.push(b)
    this.sep.push({ i: a, j: b, d })
  }

  private reaches(from: number, to: number): boolean {
    const seen = new Set<number>([from])
    const stack = [from]
    for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
      if (n === to) return true
      for (const m of this.out[n] ?? []) {
        if (!seen.has(m)) {
          seen.add(m)
          stack.push(m)
        }
      }
    }
    return false
  }

  /** Where everything lies, and how much of what was asked is not kept. */
  solve(tolerance: number): { value: (i: number) => number; squeezed: number; unmet: number[] } {
    const n = this.parent.length
    let squeezed = 0
    // A value with no room, because the doors and boxes round it leave none, takes the middle of
    // what they leave: the shortfall is counted and shown. The rooms themselves are kept as they
    // are, for the shortages to be read from them and for a solve after this one.
    const low = [...this.lo]
    const high = [...this.hi]
    for (let i = 0; i < n; i++) {
      if (this.find(i) !== i) continue
      const lo = low[i] ?? 0
      const hi = high[i] ?? 0
      if (lo > hi + EPS) {
        squeezed++
        const mid = Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : 0
        low[i] = mid
        high[i] = mid
      }
    }
    const pull = new Map<number, number[]>()
    for (const { i, t } of this.targets) {
      const r = this.find(i)
      pull.set(r, [...(pull.get(r) ?? []), t])
    }
    // The start: every value as near its pulls as its own room allows, then pushed along the orders.
    const start = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      if (this.find(i) !== i) continue
      const t = pull.get(i)
      const lo = low[i] ?? Number.NEGATIVE_INFINITY
      const hi = high[i] ?? Number.POSITIVE_INFINITY
      const want = t && t.length > 0 ? t.reduce((s, v) => s + v, 0) / t.length : 0
      start[i] = Math.min(Math.max(want, lo), hi)
    }
    const into = new Map<number, number>()
    const edgesOf = new Map<number, { j: number; d: number }[]>()
    for (const { i, j, d } of this.sep) {
      into.set(j, (into.get(j) ?? 0) + 1)
      edgesOf.set(i, [...(edgesOf.get(i) ?? []), { j, d }])
    }
    const queue: number[] = []
    for (let i = 0; i < n; i++) if (this.find(i) === i && !into.has(i)) queue.push(i)
    for (const i of queue) {
      for (const { j, d } of edgesOf.get(i) ?? []) {
        start[j] = Math.max(start[j] ?? 0, (start[i] ?? 0) + d)
        into.set(j, (into.get(j) ?? 1) - 1)
        if (into.get(j) === 0) queue.push(j)
      }
    }
    // Pulled toward where they are wanted and then pushed along the orders, values can be pushed
    // past the room they have, though the orders and rooms together leave a place for all of
    // them. Then the start is each value as early as its room and the orders before it allow,
    // which is a place for all of them if there is one, and the pulls move them from there.
    const roots = [...start.keys()].filter((r) => this.find(r) === r)
    if (roots.some((r) => (start[r] ?? 0) > (high[r] ?? Number.POSITIVE_INFINITY) + EPS)) {
      const early = new Float64Array(n)
      for (const r of roots) {
        const lo = low[r] ?? Number.NEGATIVE_INFINITY
        early[r] = Number.isFinite(lo) ? lo : Math.min(start[r] ?? 0, high[r] ?? 0)
      }
      const into2 = new Map<number, number>()
      for (const { j } of this.sep) into2.set(j, (into2.get(j) ?? 0) + 1)
      const queue2 = roots.filter((r) => !into2.has(r))
      for (const r of queue2) {
        for (const { j, d } of edgesOf.get(r) ?? []) {
          early[j] = Math.max(early[j] ?? 0, (early[r] ?? 0) + d)
          into2.set(j, (into2.get(j) ?? 1) - 1)
          if (into2.get(j) === 0) queue2.push(j)
        }
      }
      // Taken whenever any start is past its room, not only when every one fits: a chain that does
      // not fit (and is reported) must not leave the other chains starting past their rooms, where
      // the sweeps cannot bring them back.
      for (const r of roots) start[r] = early[r] ?? 0
    }
    const value = solveAxis({
      n,
      sep: this.sep,
      equal: [],
      pull: this.targets.map(({ i, t }) => ({ i: this.find(i), t, w: 1 })),
      pair: this.pairs.flatMap(({ i, j }) => {
        const a = this.find(i)
        const b = this.find(j)
        // Two runs are pulled together only where their rooms meet; where they cannot be one value
        // the pull only drags each to the end of its room.
        const meet =
          Math.min(high[a] ?? Number.POSITIVE_INFINITY, high[b] ?? Number.POSITIVE_INFINITY) -
          Math.max(low[a] ?? Number.NEGATIVE_INFINITY, low[b] ?? Number.NEGATIVE_INFINITY)
        return meet >= -EPS ? [{ i: a, j: b, w: 1, d: 0 }] : []
      }),
      tolerance,
      start,
      lower: low.map((v, i) => (this.find(i) === i ? v : Number.NEGATIVE_INFINITY)),
      upper: high.map((v, i) => (this.find(i) === i ? v : Number.POSITIVE_INFINITY)),
    })
    const at = (i: number) => value[this.find(i)] ?? 0
    const slack = Math.max(tolerance, EPS)
    const unmet = [
      this.sep.filter(({ i, j, d }) => (value[j] ?? 0) - (value[i] ?? 0) < d - slack).length,
      [...value.keys()].filter(
        (i) =>
          this.find(i) === i &&
          ((value[i] ?? 0) < (low[i] ?? 0) - slack || (value[i] ?? 0) > (high[i] ?? 0) + slack),
      ).length,
    ]
    return { value: at, squeezed, unmet }
  }
}
