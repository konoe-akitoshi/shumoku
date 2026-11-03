// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { splitKey } from '../../structure/keys.js'
import { type AxisInput, solveAxis } from '../axis.js'
import { type FrameId, frameKey, ROOT } from '../problem.js'
import { type Var, varKey } from '../tracks.js'
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

export interface Sys {
  n: number
  names: string[]
  sep: Sep[]
  equal: Sep[]
  pair: AxisInput['pair']
}
const newSys = (): Sys => ({ n: 0, names: [], sep: [], equal: [], pair: [] })

/**
 * One axis: the unknowns of items, frames, lanes and ports, and the places they make. The stages
 * lay their separations into `sys`, which is the only part of it they write; `alloc` and `at` add
 * unknowns to it.
 */
export interface Axis {
  readonly sys: Sys
  lowRef(key: string): Ref
  highRef(key: string): Ref
  midRef(key: string): Ref
  /** The unknown of a coordinate in a line's chain, shared by those that are one. */
  at(v: Var): Ref
  sizeOf(key: string): number
  alloc(name: string): number
}

export function axisOf(
  plan: Pick<Plan, 'problem' | 'frameOfKey' | 'boxes' | 'frames' | 'find'>,
  axis: 'x' | 'y',
): Axis {
  const { problem, frameOfKey, boxes, frames } = plan
  const sys = newSys()
  const lo = new Map<string, number>()
  const hi = new Map<string, number>()
  const coord = new Map<string, number>()
  const alloc = (name: string) => {
    sys.names[sys.n] = name
    return sys.n++
  }
  for (const item of problem.items) lo.set(item.id, alloc(`${axis} lo ${item.id}`))
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    lo.set(frameKey(f.id), alloc(`${axis} lo frame ${f.id}`))
    hi.set(frameKey(f.id), alloc(`${axis} hi frame ${f.id}`))
  }
  const lowRef = (key: string): Ref => {
    const f = frameOfKey.get(key)
    if (f !== undefined) return { v: lo.get(key) ?? 0, off: 0 }
    const b = boxes.get(key)
    return {
      v: lo.get(b?.item.id ?? key) ?? 0,
      off: axis === 'x' ? (b?.ox ?? 0) : (b?.oy ?? 0),
    }
  }
  const sizeOf = (key: string) => {
    const b = boxes.get(key)
    return axis === 'x' ? (b?.w ?? 0) : (b?.h ?? 0)
  }
  const highRef = (key: string): Ref => {
    if (frameOfKey.has(key)) return { v: hi.get(key) ?? 0, off: 0 }
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
  const inset = (f: FrameId) => {
    const i = frames.get(f)?.insets
    return axis === 'x'
      ? { lo: i?.left ?? 0, hi: i?.right ?? 0 }
      : { lo: i?.top ?? 0, hi: i?.bottom ?? 0 }
  }
  // frames hold what is in them
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    sys.sep.push(
      after(
        lowRef(key),
        highRef(key),
        f.insets[axis === 'x' ? 'left' : 'top'] + f.insets[axis === 'x' ? 'right' : 'bottom'],
      ),
    )
    if (f.parent === undefined || f.parent === ROOT) continue
    const up = frameKey(f.parent)
    sys.sep.push(after(lowRef(up), lowRef(key), inset(f.id).lo))
    sys.sep.push(after(highRef(key), highRef(up), inset(f.id).hi))
  }
  for (const item of problem.items) {
    if (item.frame === ROOT) continue
    const f = frameKey(item.frame)
    sys.sep.push(after(lowRef(f), lowRef(item.id), inset(item.frame).lo))
    sys.sep.push(after(highRef(item.id), highRef(f), inset(item.frame).hi))
  }
  return { sys, lowRef, highRef, midRef, at, sizeOf, alloc }
}

/** The ports on the edges: in the order the tracks gave, a slot apart, a half slot from the corners. */
export function portChain(
  plan: Pick<Plan, 'tracks' | 'problem'>,
  axis: Axis,
  along: 'x' | 'y',
): void {
  for (const [k, list] of plan.tracks.ports) {
    const [box, side] = splitKey(k)
    if (box === undefined || list.length === 0) continue
    const horizontal = side === 'top' || side === 'bottom'
    if (horizontal !== (along === 'x')) continue
    const slot = plan.problem.slots.get(box) ?? 0
    const lo = axis.lowRef(box)
    const hi = axis.highRef(box)
    const first = list[0]
    const last = list[list.length - 1]
    if (first === undefined || last === undefined) continue
    axis.sys.sep.push(after(lo, axis.at({ kind: 'port', id: first }), slot / 2))
    for (const [i, id] of list.entries()) {
      const next = list[i + 1]
      if (next !== undefined)
        axis.sys.sep.push(
          after(axis.at({ kind: 'port', id }), axis.at({ kind: 'port', id: next }), slot),
        )
    }
    axis.sys.sep.push(after(axis.at({ kind: 'port', id: last }), hi, slot / 2))
  }
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
