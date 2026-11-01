// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type AxisInput, solveAxis } from './axis.js'
import { liftFlows } from './lift.js'
import { type Demand, frameKey, type ItemId, type Problem, ROOT, type YLayout } from './problem.js'
import { treeOf } from './tree.js'

/** A place on an axis: variable `v` plus a fixed `off`. */
interface Ref {
  v: number
  off: number
}

/**
 * Where each item and frame stands from top to bottom. The only things that fix a height are
 * the flows (a lower item below an upper one), the pairs the structure says are level, the
 * frames around things and the room the wiring asked for; there is no row number to start from.
 *
 * Two siblings are stacked, one above the other, only when the flows already say that one is
 * upstream of the other (`liftFlows`), and then always: a frame's height says upstream or
 * downstream, so it is not given up for the shape of the drawing. A stack
 * made to avoid overlap would add depth the structure does not have, so siblings the flows say
 * nothing about are left for the horizontal layer to put side by side.
 */
export function solveVertical(problem: Problem, demands: readonly Demand[] = []): YLayout {
  const { metrics } = problem
  const tree = treeOf(problem)
  const height = new Map(problem.items.map((i) => [i.id, i.size.height]))

  const topVar = new Map<string, number>()
  const bottomVar = new Map<string, number>()
  for (const item of problem.items) topVar.set(item.id, topVar.size + bottomVar.size)
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    topVar.set(frameKey(f.id), topVar.size + bottomVar.size)
    bottomVar.set(frameKey(f.id), topVar.size + bottomVar.size)
  }
  const n = topVar.size + bottomVar.size
  const top = (key: string): Ref => ({ v: topVar.get(key) ?? 0, off: 0 })
  const bottom = (key: string): Ref => {
    const own = height.get(key)
    return own === undefined
      ? { v: bottomVar.get(key) ?? 0, off: 0 }
      : { v: topVar.get(key) ?? 0, off: own }
  }
  const centre = (id: ItemId): Ref => ({ v: topVar.get(id) ?? 0, off: (height.get(id) ?? 0) / 2 })

  // The room a flow needs between two items: both lines' lead-outs and one line's width.
  const room = 2 * metrics.leadOut + metrics.gapApart

  /** `later` is at least `gap` after `earlier`. */
  const after = (earlier: Ref, later: Ref, gap: number) => ({
    i: earlier.v,
    j: later.v,
    d: gap + earlier.off - later.off,
  })
  const same = (a: Ref, b: Ref) => ({ i: a.v, j: b.v, d: a.off - b.off })

  const base: AxisInput['sep'] = []
  const equal: AxisInput['equal'] = []
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    base.push(after(top(key), bottom(key), f.insets.top + f.insets.bottom))
    if (f.parent === undefined || f.parent === ROOT) continue
    const parent = frameKey(f.parent)
    base.push(after(top(parent), top(key), f.insets.top))
    base.push(after(bottom(key), bottom(parent), f.insets.bottom))
  }
  for (const item of problem.items) {
    if (item.frame === ROOT) continue
    const frame = problem.frames.find((f) => f.id === item.frame)
    if (!frame) continue
    const key = frameKey(frame.id)
    base.push(after(top(key), top(item.id), frame.insets.top))
    base.push(after(bottom(item.id), bottom(key), frame.insets.bottom))
  }
  for (const { upper, lower } of problem.above) {
    base.push(after(bottom(upper), top(lower), room))
  }
  for (const { a, b } of problem.level) equal.push(same(centre(a), centre(b)))
  for (const s of problem.satellites) equal.push(same(centre(s.item), centre(s.partner)))
  /** The constraints the structure gives, before any room the wiring asked for. */
  const structural = [...base]
  for (const d of demands) {
    if (d.axis === 'y') {
      const edge = (key: string, at: 'low' | 'high') => (at === 'high' ? bottom(key) : top(key))
      base.push(
        after(edge(d.before, d.beforeAt ?? 'high'), edge(d.after, d.afterAt ?? 'low'), d.min),
      )
    }
  }

  const tolerance = metrics.gapTwin / 4
  const spread = problem.above.map(({ upper, lower }) => ({
    ...after(bottom(upper), top(lower), room),
  }))

  const solve = (sep: AxisInput['sep'], levelled: AxisInput['equal']): Float64Array => {
    const all = [...equal, ...levelled]
    // First the frames are drawn as small as they can be, then the items with room to spare
    // are moved, without a frame becoming larger than that.
    const frameSpans = problem.frames
      .filter((f) => f.id !== ROOT)
      .map((f) => ({ top: top(frameKey(f.id)).v, bottom: bottom(frameKey(f.id)).v }))
    const compact = solveAxis({
      n,
      sep,
      equal: all,
      pull: [],
      pair: frameSpans.map((s) => ({ i: s.top, j: s.bottom, w: 1, d: 0 })),
      tolerance,
    })
    const caps = frameSpans.map((s) => ({
      i: s.bottom,
      j: s.top,
      d: (compact[s.top] ?? 0) - (compact[s.bottom] ?? 0),
    }))
    return solveAxis({
      n,
      sep: [...sep, ...caps],
      equal: all,
      pull: [],
      pair: spread.map((s) => ({ i: s.i, j: s.j, w: 1, d: s.d })),
      tolerance,
      start: compact,
    })
  }

  const reach = (y: Float64Array) => {
    const t = (key: string) => y[topVar.get(key) ?? 0] ?? 0
    const b = (key: string) => y[bottomVar.get(key) ?? 0] ?? 0
    return { t, b }
  }

  // Siblings the flow puts one upstream of the other always stand one above the other. Two cards
  // need no such line: their flow already holds them apart.
  const isFrame = (key: string) => !height.has(key)
  const stacked: [string, string][] = []
  for (const s of liftFlows(problem)) {
    for (const { upper, lower } of s.pairs) {
      if (isFrame(upper) || isFrame(lower)) stacked.push([upper, lower])
    }
  }
  const hold = stacked.map(([a, b]) => after(bottom(a), top(b), metrics.groupGap))

  let y = solve([...base, ...hold], [])
  // An item without a place in the flow stands level with the top row of its frame: where the
  // frame is already open, so that it never makes the frame taller.
  const { t } = reach(y)
  const levelled: AxisInput['equal'] = []
  for (const id of problem.free) {
    const own = problem.items.find((i) => i.id === id)
    if (!own) continue
    const row = (tree.within.get(own.frame) ?? [])
      .filter((i) => i.id !== id && !problem.free.includes(i.id))
      .sort((p, q) => t(p.id) - t(q.id) || compare(p.id, q.id))[0]
    if (row) levelled.push(same(centre(id), centre(row.id)))
  }
  if (levelled.length > 0) y = solve([...base, ...hold], levelled)

  const result = reach(y)
  const tops = new Map<string, number>()
  const bottoms = new Map<string, number>()
  for (const item of problem.items) {
    tops.set(item.id, result.t(item.id))
    bottoms.set(item.id, result.t(item.id) + item.size.height)
  }
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    tops.set(frameKey(f.id), result.t(frameKey(f.id)))
    bottoms.set(frameKey(f.id), result.b(frameKey(f.id)))
  }
  // What the form of the constraints says of two things' heights: the furthest the top of one can
  // be held below the bottom of the other along chains of them (equal heights are chains of nothing
  // both ways). Room asked for by the wiring is left out, so the answer does not change with it.
  const edges: { to: number; d: number }[][] = Array.from({ length: n }, () => [])
  for (const { i, j, d } of [...structural, ...hold]) edges[i]?.push({ to: j, d })
  for (const { i, j, d } of [...equal, ...levelled]) {
    edges[i]?.push({ to: j, d })
    edges[j]?.push({ to: i, d: -d })
  }
  const furthest = new Map<number, Float64Array>()
  const longest = (from: number): Float64Array => {
    const known = furthest.get(from)
    if (known) return known
    const dist = new Float64Array(n).fill(Number.NEGATIVE_INFINITY)
    dist[from] = 0
    const queue = [from]
    const queued = new Array<boolean>(n).fill(false)
    queued[from] = true
    const links = new Array<number>(n).fill(0)
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head] as number
      queued[v] = false
      for (const e of edges[v] ?? []) {
        const far = (dist[v] ?? 0) + e.d
        if (far <= (dist[e.to] ?? 0) + 1e-9) continue
        dist[e.to] = far
        links[e.to] = (links[v] ?? 0) + 1
        // a chain of as many constraints as there are values comes back to one of them: a ring
        // that grows is one the heights could not have kept, and is left where it reached
        if ((links[e.to] ?? 0) >= n) continue
        if (!queued[e.to]) {
          queued[e.to] = true
          queue.push(e.to)
        }
      }
    }
    furthest.set(from, dist)
    return dist
  }
  const under = (a: string, b: string): boolean => {
    const lowA = bottom(a)
    const topB = top(b)
    const far = longest(lowA.v)[topB.v] ?? Number.NEGATIVE_INFINITY
    return far >= lowA.off - topB.off - 1e-9
  }
  const ordered = (a: string, b: string) => under(a, b) || under(b, a)
  return { top: tops, bottom: bottoms, stacked, ordered }
}
