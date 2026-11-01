// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type AxisInput, solveAxis } from './axis.js'
import { snapOf } from './kin.js'
import type { Box, Metrics } from './metrics.js'
import {
  type Demand,
  type End,
  frameKey,
  type Geometry,
  type Item,
  type Order,
  type Problem,
  ROOT,
  type YLayout,
} from './problem.js'

interface Ref {
  v: number
  off: number
}

/** How far a line end's centre is from the left edge of its item. */
export function endOffset(
  metrics: Pick<Metrics, 'hullPad' | 'memberGap'>,
  item: Item,
  end: End,
  members: ReadonlyMap<string, readonly string[]>,
): number {
  if (item.kind !== 'unit' || end.node === undefined) return item.size.width / 2
  const sizes = new Map((item.members ?? []).map((m) => [m.node.id, m.size.width]))
  let at = metrics.hullPad
  for (const id of members.get(item.id) ?? []) {
    const w = sizes.get(id) ?? 0
    if (id === end.node) return at + w / 2
    at += w + metrics.memberGap
  }
  return item.size.width / 2
}

/**
 * Where everything stands from left to right, given the heights and the order of siblings.
 * Siblings are kept apart unless the constraints on the heights put one above the other: two
 * things held at different heights may share a column, which is what lets a frame hold a flow
 * that is deeper than it is wide.
 */
export function solveHorizontal(
  problem: Problem,
  y: YLayout,
  order: Order,
  demands: readonly Demand[] = [],
): Geometry {
  const { metrics } = problem
  const width = new Map(problem.items.map((i) => [i.id, i.size.width]))
  const leftVar = new Map<string, number>()
  const rightVar = new Map<string, number>()
  for (const item of problem.items) leftVar.set(item.id, leftVar.size + rightVar.size)
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    leftVar.set(frameKey(f.id), leftVar.size + rightVar.size)
    rightVar.set(frameKey(f.id), leftVar.size + rightVar.size)
  }
  const n = leftVar.size + rightVar.size
  const left = (key: string): Ref => ({ v: leftVar.get(key) ?? 0, off: 0 })
  const right = (key: string): Ref => {
    const own = width.get(key)
    return own === undefined
      ? { v: rightVar.get(key) ?? 0, off: 0 }
      : { v: leftVar.get(key) ?? 0, off: own }
  }
  const after = (earlier: Ref, later: Ref, gap: number) => ({
    i: earlier.v,
    j: later.v,
    d: gap + earlier.off - later.off,
  })

  const sep: AxisInput['sep'] = []
  const frames = new Map(problem.frames.map((f) => [f.id, f]))
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    sep.push(after(left(key), right(key), f.insets.left + f.insets.right))
    if (f.parent === undefined || f.parent === ROOT) continue
    const parent = frameKey(f.parent)
    sep.push(after(left(parent), left(key), f.insets.left))
    sep.push(after(right(key), right(parent), f.insets.right))
  }
  for (const item of problem.items) {
    const frame = item.frame === ROOT ? undefined : frames.get(item.frame)
    if (!frame) continue
    const key = frameKey(frame.id)
    sep.push(after(left(key), left(item.id), frame.insets.left))
    sep.push(after(right(item.id), right(key), frame.insets.right))
  }

  // Siblings stand side by side, kept apart in the order given, unless the constraints on the
  // heights, by their form, put one above the other: those two never meet at one height and may
  // share a column. The form decides and not the heights that came of it, so that room asked for
  // along one axis never changes who stands beside whom along the other.
  const apart = (a: string, b: string) => !y.ordered(a, b)
  const isFrame = (key: string) => !width.has(key)
  for (const siblings of order.siblings.values()) {
    for (const [i, a] of siblings.entries()) {
      for (const b of siblings.slice(i + 1)) {
        if (!apart(a, b)) continue
        sep.push(
          after(right(a), left(b), isFrame(a) || isFrame(b) ? metrics.groupGap : metrics.gap),
        )
      }
    }
  }
  for (const d of demands) {
    if (d.axis === 'x') {
      const edge = (key: string, at: 'low' | 'high') => (at === 'high' ? right(key) : left(key))
      sep.push(
        after(edge(d.before, d.beforeAt ?? 'high'), edge(d.after, d.afterAt ?? 'low'), d.min),
      )
    }
  }

  // Lines that place things pull their ends to one column.
  const itemOf = new Map(problem.items.map((i) => [i.id, i]))
  const pair: AxisInput['pair'] = []
  for (const line of problem.lines) {
    if (line.role !== 'oriented') continue
    const a = itemOf.get(line.a.item)
    const b = itemOf.get(line.b.item)
    if (!a || !b || a === b) continue
    const oa = endOffset(metrics, a, line.a, order.members)
    const ob = endOffset(metrics, b, line.b, order.members)
    pair.push({ i: left(a.id).v, j: left(b.id).v, w: 1, d: oa - ob })
  }

  const tolerance = snapOf(metrics)
  const spans = problem.frames
    .filter((f) => f.id !== ROOT)
    .map((f) => ({ left: left(frameKey(f.id)).v, right: right(frameKey(f.id)).v }))
  const compact = solveAxis({
    n,
    sep,
    equal: [],
    pull: [],
    pair: spans.map((s) => ({ i: s.left, j: s.right, w: 1, d: 0 })),
    tolerance,
  })
  const caps = spans.map((s) => ({
    i: s.right,
    j: s.left,
    d: (compact[s.left] ?? 0) - (compact[s.right] ?? 0),
  }))
  const x = solveAxis({
    n,
    sep: [...sep, ...caps],
    equal: [],
    pull: [],
    pair,
    tolerance,
    start: compact,
  })

  const boxes = new Map<string, Box>()
  for (const item of problem.items) {
    const top = y.top.get(item.id) ?? 0
    const box = { x: x[leftVar.get(item.id) ?? 0] ?? 0, y: top, ...item.size }
    boxes.set(item.id, box)
    if (item.kind !== 'unit') continue
    const sizes = new Map((item.members ?? []).map((m) => [m.node.id, m.size]))
    const tallest = Math.max(0, ...[...sizes.values()].map((s) => s.height))
    let at = box.x + metrics.hullPad
    for (const id of order.members.get(item.id) ?? []) {
      const size = sizes.get(id)
      if (!size) continue
      boxes.set(id, {
        x: at,
        y: top + metrics.hullPad + (tallest - size.height) / 2,
        ...size,
      })
      at += size.width + metrics.memberGap
    }
  }
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    const l = x[leftVar.get(key) ?? 0] ?? 0
    const r = x[rightVar.get(key) ?? 0] ?? 0
    const t = y.top.get(key) ?? 0
    boxes.set(key, { x: l, y: t, width: r - l, height: (y.bottom.get(key) ?? t) - t })
  }
  return { boxes }
}
