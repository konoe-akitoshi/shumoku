// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type AxisInput, solveAxis } from '../axis.js'
import { frameIn, frameKey, hasFrame, splitSide, varKey } from '../keys.js'
import { must } from '../must.js'
import { type FrameId, ROOT } from '../problem.js'
import type { Var } from '../tracks.js'
import type { Plan } from './plan.js'

/** axis place on an axis: a variable and a fixed offset from it. */
export interface Ref {
  v: number
  off: number
}
export interface Sep {
  i: number
  j: number
  d: number
}

/** `later` at least `gap` after `earlier`. */
export const after = (earlier: Ref, later: Ref, gap: number): Sep => ({
  i: earlier.v,
  j: later.v,
  d: gap + earlier.off - later.off,
})
/** Two places that are one. */
export const same = (a: Ref, b: Ref): Sep => ({ i: a.v, j: b.v, d: a.off - b.off })

/**
 * What a stage asks of an axis, as a value: separations, equalities and pulls. Stages return
 * theirs and the caller joins them, in the order the solver should see them (it may break a tie
 * by index), so no stage writes into a system shared with the others.
 */
export interface Constraints {
  sep: Sep[]
  equal: Sep[]
  pair: AxisInput['pair']
}
/** Nothing asked. Shared, so it is only ever read or joined, never pushed to. */
export const none: Constraints = { sep: [], equal: [], pair: [] }
/** All of `parts` in one, each kept in its own order after the one before. */
export const join = (...parts: Constraints[]): Constraints => ({
  sep: parts.flatMap((c) => c.sep),
  equal: parts.flatMap((c) => c.equal),
  pair: parts.flatMap((c) => c.pair),
})

/** The unknowns of an axis and everything asked of them. */
export interface Sys extends Constraints {
  n: number
  names: readonly string[]
}
/** The system of an axis: its unknowns, the axis's own constraints, then those of the stages. */
export const systemOf = (axis: Axis, ...stages: Constraints[]): Sys => ({
  n: axis.n,
  names: axis.names,
  ...join(axis.base, ...stages),
})

/** The top and bottom of each rank's band, by rank. */
export interface Bands {
  readonly top: readonly Ref[]
  readonly bottom: readonly Ref[]
}

/**
 * One axis: the unknowns of items, frames, lanes, ports and rank bands, all numbered before any
 * stage lays a constraint, and the places they make. `base` is what the frames and their members
 * ask of it; the stages return the rest.
 */
export interface Axis {
  readonly n: number
  readonly names: readonly string[]
  readonly base: Constraints
  /** The bands of the ranks, where this axis has them (the heights do). */
  readonly bands: Bands
  lowRef(key: string): Ref
  highRef(key: string): Ref
  midRef(key: string): Ref
  /** The unknown of a coordinate in a line's chain, shared by those that are one. */
  at(v: Var): Ref
  sizeOf(key: string): number
}

/**
 * An axis with every unknown numbered, in this order: items, frames, the lanes and ports that run
 * along it, then `bands` pairs of rank band edges. Nothing is numbered afterwards.
 */
export function axisOf(
  plan: Pick<Plan, 'problem' | 'frameOfKey' | 'boxes' | 'frames' | 'find' | 'tracks'>,
  axis: 'x' | 'y',
  bands: number,
): Axis {
  const { problem, frameOfKey, boxes, frames, tracks } = plan
  const names: string[] = []
  const lo = new Map<string, number>()
  const hi = new Map<string, number>()
  const coord = new Map<string, number>()
  let sealed = false
  const alloc = (name: string) => {
    if (sealed)
      throw new Error(`the ${axis} axis was asked for an unknown it has not numbered: ${name}`)
    names.push(name)
    return names.length - 1
  }
  for (const item of problem.items) lo.set(item.id, alloc(`${axis} lo ${item.id}`))
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    lo.set(frameKey(f.id), alloc(`${axis} lo frame ${f.id}`))
    hi.set(frameKey(f.id), alloc(`${axis} hi frame ${f.id}`))
  }
  const lowRef = (key: string): Ref => {
    const f = frameIn(frameOfKey, key)
    if (f !== undefined) return { v: must(lo, key, `${axis} low of frame`), off: 0 }
    const b = boxes.get(key)
    return {
      v: must(lo, b?.item.id ?? key, `${axis} low of box`),
      off: axis === 'x' ? (b?.ox ?? 0) : (b?.oy ?? 0),
    }
  }
  const sizeOf = (key: string) => {
    const b = boxes.get(key)
    return axis === 'x' ? (b?.w ?? 0) : (b?.h ?? 0)
  }
  const highRef = (key: string): Ref => {
    if (hasFrame(frameOfKey, key)) return { v: must(hi, key, `${axis} high of frame`), off: 0 }
    const l = lowRef(key)
    return { v: l.v, off: l.off + sizeOf(key) }
  }
  const midRef = (key: string): Ref => {
    const l = lowRef(key)
    return { v: l.v, off: l.off + sizeOf(key) / 2 }
  }
  const at = (v: Var): Ref => {
    const root = plan.find(varKey(v))
    let c = coord.get(root)
    if (c === undefined) {
      c = alloc(`${axis} ${varKey(v)}`)
      coord.set(root, c)
    }
    return { v: c, off: 0 }
  }
  for (const lane of tracks.lanes.values()) {
    if (lane.used && lane.axis === axis) at({ kind: 'lane', key: lane.key })
  }
  for (const ent of tracks.entities.values())
    if (ent.axis === axis) at({ kind: 'port', id: ent.id })
  const top: Ref[] = []
  const bottom: Ref[] = []
  for (let r = 0; r < bands; r++) {
    top.push({ v: alloc(`${axis} band top ${r}`), off: 0 })
    bottom.push({ v: alloc(`${axis} band bottom ${r}`), off: 0 })
  }
  sealed = true
  const inset = (f: FrameId) => {
    const i = frames.get(f)?.insets
    return axis === 'x'
      ? { lo: i?.left ?? 0, hi: i?.right ?? 0 }
      : { lo: i?.top ?? 0, hi: i?.bottom ?? 0 }
  }
  // frames hold what is in them
  const sep: Sep[] = []
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    sep.push(
      after(
        lowRef(key),
        highRef(key),
        f.insets[axis === 'x' ? 'left' : 'top'] + f.insets[axis === 'x' ? 'right' : 'bottom'],
      ),
    )
    if (f.parent === undefined || f.parent === ROOT) continue
    const up = frameKey(f.parent)
    sep.push(after(lowRef(up), lowRef(key), inset(f.id).lo))
    sep.push(after(highRef(key), highRef(up), inset(f.id).hi))
  }
  for (const item of problem.items) {
    if (item.frame === ROOT) continue
    const f = frameKey(item.frame)
    sep.push(after(lowRef(f), lowRef(item.id), inset(item.frame).lo))
    sep.push(after(highRef(item.id), highRef(f), inset(item.frame).hi))
  }
  return {
    n: names.length,
    names,
    base: { sep, equal: [], pair: [] },
    bands: { top, bottom },
    lowRef,
    highRef,
    midRef,
    at,
    sizeOf,
  }
}

/** The ports on the edges: in the order the tracks gave, a slot apart, a half slot from the corners. */
export function portChain(
  plan: Pick<Plan, 'tracks' | 'problem'>,
  axis: Axis,
  along: 'x' | 'y',
): Constraints {
  const sep: Sep[] = []
  for (const [k, list] of plan.tracks.ports) {
    if (list.length === 0) continue
    const { box, side } = splitSide(k)
    const horizontal = side === 'top' || side === 'bottom'
    if (horizontal !== (along === 'x')) continue
    const slot = must(plan.problem.slots, box, 'slot of box')
    const lo = axis.lowRef(box)
    const hi = axis.highRef(box)
    const first = list[0]
    const last = list[list.length - 1]
    if (first === undefined || last === undefined) continue
    sep.push(after(lo, axis.at({ kind: 'port', id: first }), slot / 2))
    for (const [i, id] of list.entries()) {
      const next = list[i + 1]
      if (next !== undefined)
        sep.push(after(axis.at({ kind: 'port', id }), axis.at({ kind: 'port', id: next }), slot))
    }
    sep.push(after(axis.at({ kind: 'port', id: last }), hi, slot / 2))
  }
  return { sep, equal: [], pair: [] }
}

/** The low and high unknown of every frame. */
export const frameSpans = (plan: Pick<Plan, 'problem'>, axis: Axis) =>
  plan.problem.frames
    .filter((f) => f.id !== ROOT)
    .map((f) => ({
      lo: axis.lowRef(frameKey(f.id)).v,
      hi: axis.highRef(frameKey(f.id)).v,
    }))

/**
 * Solves an axis in two passes: packed as tight as the frames allow, then the frames held at
 * those widths while `extra` pulls the rest into line.
 */
export function solveCompact(
  plan: Pick<Plan, 'tolerance'>,
  sys: Sys,
  spans: { lo: number; hi: number }[],
  extra: AxisInput['pair'],
  more: { sep?: Sep[]; equal?: Sep[] } = {},
): Float64Array {
  const sep = [...sys.sep, ...(more.sep ?? [])]
  const equal = [...sys.equal, ...(more.equal ?? [])]
  const compact = solveAxis({
    n: sys.n,
    sep,
    equal,
    pull: [],
    pair: spans.map((s) => ({ i: s.lo, j: s.hi, w: 1, d: 0 })),
    tolerance: plan.tolerance,
  })
  const caps = spans.map((s) => ({
    i: s.hi,
    j: s.lo,
    d: (compact[s.lo] ?? 0) - (compact[s.hi] ?? 0),
  }))
  return solveAxis({
    n: sys.n,
    sep: [...sep, ...caps],
    equal,
    pull: [],
    pair: extra,
    tolerance: plan.tolerance,
    start: compact,
  })
}

/** How many separations a solution leaves short of their distance. */
export const shortOf = (plan: Pick<Plan, 'tolerance'>, sys: Sys, v: Float64Array): number =>
  sys.sep.filter(({ i, j, d }) => (v[j] ?? 0) - (v[i] ?? 0) < d - plan.tolerance).length
