// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type AxisInput, solveAxis } from './axis.js'
import {
  type Demand,
  type FrameId,
  frameKey,
  type ItemId,
  type Problem,
  ROOT,
  type YLayout,
} from './problem.js'
import { type Tree, treeOf } from './tree.js'

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
 * Two siblings are stacked, one above the other, only when what they hold is already apart
 * vertically: a stack made to avoid overlap would add depth the structure does not have, so
 * siblings that overlap are left for the horizontal layer to put side by side.
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
  const room = 2 * metrics.leadOut + metrics.pitch

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
  for (const d of demands) {
    if (d.axis === 'y') base.push(after(bottom(d.before), top(d.after), d.min))
  }

  const tolerance = metrics.pitch / 4
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

  const stacked: [string, string][] = []
  const reach = (y: Float64Array) => {
    const t = (key: string) => y[topVar.get(key) ?? 0] ?? 0
    const b = (key: string) => y[bottomVar.get(key) ?? 0] ?? 0
    return { t, b }
  }

  /** Stacks siblings until every pair that is apart in the solution is held apart. */
  const settle = (levelled: AxisInput['equal']): Float64Array => {
    const hold = () => stacked.map(([a, b]) => after(bottom(a), top(b), metrics.groupGap))
    let y = solve([...base, ...hold()], levelled)
    for (let round = 0; round <= siblingPairs(tree, problem.items.length); round++) {
      const { t } = reach(y)
      const extent = (key: string, frame: FrameId | undefined) => {
        const kids = frame === undefined ? undefined : tree.within.get(frame)
        if (frame === undefined) return { top: t(key), bottom: t(key) + (height.get(key) ?? 0) }
        if (!kids || kids.length === 0) return undefined
        return {
          top: Math.min(...kids.map((i) => t(i.id))),
          bottom: Math.max(...kids.map((i) => t(i.id) + i.size.height)),
        }
      }
      let added = false
      for (const [frame, items] of tree.itemsIn) {
        const frames = tree.framesIn.get(frame) ?? []
        const siblings = [
          ...items.map((i) => ({ key: i.id, frame: undefined as FrameId | undefined })),
          ...frames.map((f) => ({ key: frameKey(f.id), frame: f.id as FrameId | undefined })),
        ]
        for (const a of siblings) {
          for (const b of siblings) {
            if (a === b || (a.frame === undefined && b.frame === undefined)) continue
            if (stacked.some(([u, l]) => u === a.key && l === b.key)) continue
            const ea = extent(a.key, a.frame)
            const eb = extent(b.key, b.frame)
            if (!ea || !eb || ea.bottom > eb.top) continue
            stacked.push([a.key, b.key])
            added = true
          }
        }
      }
      if (!added) break
      y = solve([...base, ...hold()], levelled)
    }
    return y
  }

  let y = settle([])
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
  if (levelled.length > 0) y = settle(levelled)

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
  return { top: tops, bottom: bottoms, stacked }
}

/** An upper bound on the pairs of siblings that could be stacked, to stop the search. */
function siblingPairs(tree: Tree, items: number): number {
  let pairs = 0
  for (const [frame, here] of tree.itemsIn) {
    const m = here.length + (tree.framesIn.get(frame)?.length ?? 0)
    pairs += m * m
  }
  return Math.max(pairs, items)
}
