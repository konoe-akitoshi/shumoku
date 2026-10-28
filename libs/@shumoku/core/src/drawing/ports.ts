// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Box, Point } from './metrics.js'
import type { End, Geometry, Line, Problem } from './problem.js'
import type { Side } from './scene.js'

/** Coordinates are matched after rounding, so that equal edges of different boxes are one line. */
export const round = (v: number) => Math.round(v * 1e4) / 1e4

export const centre = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

/** Which way each side faces. */
export const outward: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Drops repeated points and points in the middle of a straight run. */
export function simplify(points: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && last.x === p.x && last.y === p.y) continue
    out.push(p)
  }
  return out.filter((p, i) => {
    const a = out[i - 1]
    const b = out[i + 1]
    if (!a || !b) return true
    return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) !== 0
  })
}

/**
 * The side of its own box a line leaves by. The top and bottom edges carry the flow, so a line
 * whose other end is wholly above or below leaves by them; one whose other end is level with it
 * leaves by the edge that faces it.
 */
export function sideToward(own: Box, other: Box): Side {
  if (other.y >= own.y + own.height) return 'bottom'
  if (other.y + other.height <= own.y) return 'top'
  return centre(other).x >= centre(own).x ? 'right' : 'left'
}

/** Where a line leaves or enters a box. */
export interface PortPlan {
  line: Line
  end: 'a' | 'b'
  ref: End
  /** The key of the box in the geometry. */
  box: string
  side: Side
  at: Point
  /** The point `leadOut` straight out from `at`, where the line may first turn. */
  lead: Point
}

export const boxKey = (end: End) => end.node ?? end.item

/**
 * One port for each end of each line that is not inside a unit, on the side facing the other
 * end, spread along the edge in the order their lines lead so that they do not cross at the
 * edge. `widths` is how wide each box must be to hold its ports a slot apart; the layout
 * widens the box and asks again.
 */
export function assignPorts(
  problem: Problem,
  geometry: Geometry,
): { plans: PortPlan[]; widths: Map<string, number> } {
  const { metrics } = problem
  const boxOf = (end: End): Box | undefined =>
    geometry.boxes.get(boxKey(end)) ?? geometry.boxes.get(end.item)

  const labels = new Map<string, (string | undefined)[]>()
  for (const l of problem.lines) {
    for (const end of [l.a, l.b]) {
      labels.set(boxKey(end), [...(labels.get(boxKey(end)) ?? []), end.port])
    }
  }

  interface Slot {
    line: Line
    end: 'a' | 'b'
    ref: End
    key: string
    box: Box
    side: Side
    along: number
  }
  const slots: Slot[] = []
  for (const line of problem.lines) {
    if (line.role === 'inside') continue
    const a = boxOf(line.a)
    const b = boxOf(line.b)
    if (!a || !b) continue
    for (const [end, ref, own, other] of [
      ['a', line.a, a, b],
      ['b', line.b, b, a],
    ] as const) {
      const side = sideToward(own, other)
      const c = centre(other)
      slots.push({
        line,
        end,
        ref,
        key: boxKey(ref),
        box: own,
        side,
        along: side === 'top' || side === 'bottom' ? c.x : c.y,
      })
    }
  }

  const groups = new Map<string, Slot[]>()
  for (const s of slots) {
    const key = `${s.key}\0${s.side}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const plans: PortPlan[] = []
  const widths = new Map<string, number>()
  for (const group of groups.values()) {
    group.sort((p, q) => p.along - q.along || compare(p.line.id, q.line.id))
    const first = group[0]
    if (!first) continue
    if (first.side === 'top' || first.side === 'bottom') {
      const need = (group.length + 1) * metrics.portSlot(labels.get(first.key) ?? [])
      widths.set(first.key, Math.max(widths.get(first.key) ?? 0, need))
    }
    for (const [k, s] of group.entries()) {
      const f = (k + 1) / (group.length + 1)
      const { box } = s
      const raw: Point =
        s.side === 'top'
          ? { x: box.x + box.width * f, y: box.y }
          : s.side === 'bottom'
            ? { x: box.x + box.width * f, y: box.y + box.height }
            : { x: s.side === 'left' ? box.x : box.x + box.width, y: box.y + box.height * f }
      const at = { x: round(raw.x), y: round(raw.y) }
      const n = outward[s.side]
      plans.push({
        line: s.line,
        end: s.end,
        ref: s.ref,
        box: s.key,
        side: s.side,
        at,
        lead: { x: round(at.x + n.x * metrics.leadOut), y: round(at.y + n.y * metrics.leadOut) },
      })
    }
  }
  return { plans, widths }
}

/** The problem with every box at least as wide as `widths` asks, and units refitted. */
export function widen(problem: Problem, widths: ReadonlyMap<string, number>): Problem {
  const { metrics } = problem
  const items = problem.items.map((item) => {
    if (item.kind !== 'unit') {
      const w = widths.get(item.id) ?? 0
      return w > item.size.width ? { ...item, size: { ...item.size, width: w } } : item
    }
    const members = (item.members ?? []).map((m) => {
      const w = widths.get(m.node.id) ?? 0
      return w > m.size.width ? { ...m, size: { ...m.size, width: w } } : m
    })
    const width =
      members.reduce((sum, m) => sum + m.size.width, 0) +
      Math.max(0, members.length - 1) * metrics.memberGap +
      2 * metrics.hullPad
    return { ...item, members, size: { ...item.size, width } }
  })
  return { ...problem, items }
}
