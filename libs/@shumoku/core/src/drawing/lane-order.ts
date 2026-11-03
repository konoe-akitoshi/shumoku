// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Corridors } from './corridors.js'
import { laneOrder } from './crossing.js'
import { cornerOf, pitchOf } from './kin.js'
import { linesById, type Problem } from './problem.js'
import type { Tracks, Var } from './tracks.js'

/**
 * The runs across the rows, ordered once the widths are known. Which of two runs in a row lies
 * above the other, and which pairs have to keep apart at all, depend on where their ends stand
 * along the row, and that is a result of the widths, not a thing the indices of the stages before
 * could say across a gap. It is the last discrete decision; nothing that went before depends on it.
 */
export interface Lanes {
  /** The runs of each row, top to bottom (by `varKey` of the lane). */
  order: ReadonlyMap<number, readonly string[]>
  /** Pairs of runs (a above b) that must keep `d` apart: they run side by side, or a corner needs room. */
  apart: readonly { a: string; b: string; d: number }[]
  /** The extent of each run along the row. */
  interval: ReadonlyMap<string, readonly [number, number]>
  /** Runs whose two ends stand at one place: nothing is drawn along them. */
  dropped: ReadonlySet<string>
  /** What the orders chosen cost in crossings. */
  crossings: number
  /** By gap: what the orders chosen cost, and the least any order of each pair could cost. */
  byGap: ReadonlyMap<number, { chosen: number; least: number }>
}

export function lanesOf(
  problem: Problem,
  corridors: Corridors,
  tracks: Tracks,
  xOf: (v: Var) => number,
  tolerance: number,
): Lanes {
  const byLine = linesById(problem)
  const { metrics } = problem
  const isX = (v: Var): boolean =>
    v.kind === 'port'
      ? tracks.entities.get(v.id)?.axis === 'x'
      : tracks.lanes.get(v.key)?.axis === 'x'

  interface Run {
    key: string
    cell: number
    line: string
    lo: number
    hi: number
    /** The x of the ends that stand on the top wall of the row, and on the bottom wall. */
    top: number[]
    bottom: number[]
    ends: { v: Var; wall: 'top' | 'bottom' }[]
  }
  const runs = new Map<string, Run>()
  for (const lane of tracks.lanes.values()) {
    if (!lane.used || lane.axis !== 'y') continue
    const node = corridors.nodes[lane.node]
    if (node?.kind !== 'cell') continue
    const chain = tracks.chains.get(lane.line) ?? []
    const me = chain.findIndex((v) => v.kind === 'lane' && v.key === lane.key)
    if (me < 0) continue
    const reach = (step: 1 | -1): Var | undefined => {
      for (let k = me + step; k >= 0 && k < chain.length; k += step) {
        const v = chain[k]
        if (v && isX(v)) return v
      }
      return undefined
    }
    const before = reach(-1)
    const next = reach(1)
    const xs = [before, next].flatMap((v) => (v ? [xOf(v)] : []))
    const lo = xs.length === 2 ? Math.min(...xs) : Number.NEGATIVE_INFINITY
    const hi = xs.length === 2 ? Math.max(...xs) : Number.POSITIVE_INFINITY
    const top: number[] = []
    const bottom: number[] = []
    const ends: Run['ends'] = []
    for (const [wall, v] of [
      [lane.win, before],
      [lane.wout, next],
    ] as const) {
      if (!v) continue
      if (wall === 'top') top.push(xOf(v))
      if (wall === 'bottom') bottom.push(xOf(v))
      if (wall === 'top' || wall === 'bottom') ends.push({ v, wall })
    }
    runs.set(lane.key, {
      key: lane.key,
      cell: lane.node,
      line: lane.line,
      lo,
      hi,
      top,
      bottom,
      ends,
    })
  }
  // runs carried through several rows are one run: the widest extent counts everywhere
  const dropped = new Set<string>()
  for (const r of runs.values()) if (r.hi - r.lo < tolerance) dropped.add(r.key)

  // A horizontal run is one stretch at one height, however many cells it crosses. The cells that
  // a run passes into through the sides of frames are one channel; the runs of a channel are
  // ordered together, over all of their extent, so that no cell has an order of its own.
  const parent = new Map<number, number>()
  const root = (n: number): number => {
    const p = parent.get(n) ?? n
    if (p === n) return n
    const r = root(p)
    parent.set(n, r)
    return r
  }
  for (const d of corridors.doors) {
    const sideways = (w: string) => w === 'left' || w === 'right'
    if (!sideways(d.wallA) || !sideways(d.wallB)) continue
    if (corridors.nodes[d.a]?.kind !== 'cell' || corridors.nodes[d.b]?.kind !== 'cell') continue
    const [ra, rb] = [root(d.a), root(d.b)]
    if (ra !== rb) parent.set(ra, rb)
  }
  interface Joined {
    id: string
    lanes: string[]
    cells: Set<number>
    lo: number
    hi: number
    top: number[]
    bottom: number[]
    ends: Run['ends']
    line: string
  }
  const joined = new Map<number, Joined>()
  for (const r of [...runs.values()].sort((p, q) => compare(p.key, q.key))) {
    if (dropped.has(r.key)) continue
    const id = tracks.lanes.get(r.key)?.run ?? 0
    const j = joined.get(id)
    if (j) {
      j.lanes.push(r.key)
      j.cells.add(r.cell)
      j.top.push(...r.top)
      j.bottom.push(...r.bottom)
      j.ends.push(...r.ends)
      j.lo = Math.min(j.lo, r.lo)
      j.hi = Math.max(j.hi, r.hi)
    } else {
      joined.set(id, {
        id: r.key,
        lanes: [r.key],
        cells: new Set([r.cell]),
        lo: r.lo,
        hi: r.hi,
        top: [...r.top],
        bottom: [...r.bottom],
        ends: [...r.ends],
        line: r.line,
      })
    }
  }
  const channels = new Map<number, Joined[]>()
  for (const j of joined.values()) {
    const first = Math.min(...j.cells)
    channels.set(root(first), [...(channels.get(root(first)) ?? []), j])
  }

  const inside = (x: number, lo: number, hi: number) => x > lo + tolerance && x < hi - tolerance
  const order = new Map<number, string[]>()
  const apart: { a: string; b: string; d: number }[] = []
  const interval = new Map<string, readonly [number, number]>()
  for (const j of joined.values()) for (const k of j.lanes) interval.set(k, [j.lo, j.hi])
  let crossings = 0
  const byGap = new Map<number, { chosen: number; least: number }>()
  for (const [, list] of [...channels].sort((p, q) => p[0] - q[0])) {
    list.sort((p, q) => compare(p.id, q.id))
    const by = new Map(list.map((j) => [j.id, j]))
    const cost = (ka: string, kb: string): number => {
      const [a, b] = [by.get(ka), by.get(kb)]
      if (!a || !b) return 0
      let c = 0
      if (b.top.some((x) => inside(x, a.lo, a.hi))) c++
      if (a.bottom.some((x) => inside(x, b.lo, b.hi))) c++
      return c
    }
    const { order: keys } = laneOrder(
      list.map((j) => j.id),
      cost,
    )
    const firstCell = list[0] ? Math.min(...list[0].cells) : undefined
    const cellNode = firstCell === undefined ? undefined : corridors.nodes[firstCell]
    const here = { chosen: 0, least: 0 }
    for (const [i, ka] of keys.entries()) {
      for (const kb of keys.slice(i + 1)) {
        crossings += cost(ka, kb)
        here.chosen += cost(ka, kb)
      }
    }
    for (const [i, ka] of list.entries())
      for (const b of list.slice(i + 1))
        here.least += Math.min(cost(ka.id, b.id), cost(b.id, ka.id))
    if (cellNode?.kind === 'cell') {
      const was = byGap.get(cellNode.gap) ?? { chosen: 0, least: 0 }
      byGap.set(cellNode.gap, { chosen: was.chosen + here.chosen, least: was.least + here.least })
    }
    // each cell lists its lanes in the order of the channel
    for (const key of keys) {
      const j = by.get(key)
      if (!j) continue
      for (const lane of j.lanes) {
        const cell = runs.get(lane)?.cell
        if (cell !== undefined) order.set(cell, [...(order.get(cell) ?? []), lane])
      }
    }
    for (const [i, ka] of keys.entries()) {
      const a = by.get(ka)
      const la = a ? byLine.get(a.line) : undefined
      if (!a || !la) continue
      for (const kb of keys.slice(i + 1)) {
        const b = by.get(kb)
        const lb = b ? byLine.get(b.line) : undefined
        if (!b || !lb) continue
        const pitch = pitchOf(metrics, la, lb)
        // side by side: the extents are closer than the pitch along the row
        if (a.lo < b.hi + pitch && b.lo < a.hi + pitch) {
          apart.push({ a: a.id, b: b.id, d: pitch })
        }
      }
    }
    // a corner of a run has room to turn between its end and the run next to it: a run that the
    // lead-out of an end crosses on its way is a pitch and a corner from the run it leads to
    for (const [i, kb] of keys.entries()) {
      const h = by.get(kb)
      const line = h ? byLine.get(h.line) : undefined
      if (!h || !line) continue
      const corner = cornerOf(metrics, line)
      for (const e of h.ends) {
        const x = xOf(e.v)
        const between = e.wall === 'top' ? keys.slice(0, i) : keys.slice(i + 1)
        for (const ko of between) {
          const o = by.get(ko)
          const lo = o ? byLine.get(o.line) : undefined
          if (!o || !lo || !inside(x, o.lo, o.hi)) continue
          const d = corner + pitchOf(metrics, lo, line)
          apart.push(e.wall === 'top' ? { a: o.id, b: h.id, d } : { a: h.id, b: o.id, d })
        }
      }
    }
  }
  return { order, apart, interval, dropped, crossings, byGap }
}
