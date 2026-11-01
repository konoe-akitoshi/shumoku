// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { pitchOf } from './kin.js'
import type { Box, Point } from './metrics.js'
import { type Demand, frameKey, type Geometry, type Problem, ROOT } from './problem.js'
import type { Side } from './scene.js'
import { portSides } from './sides.js'

const EPS = 1e-3

/** A straight stretch of a line along one axis. */
interface Run extends Stretch {
  line: string
}

/** A straight stretch along one axis: where across its heading it lies, and from where to where. */
export interface Stretch {
  at: number
  from: number
  to: number
  /** The line it belongs to, which `pitchBetween` is asked about. */
  line?: string | number
}

/** What the lines in a corridor keep: the distance between two neighbours, and half a line's width. */
export interface Keeps {
  between(a: string | number | undefined, b: string | number | undefined): number
  half(a: string | number | undefined): number
}

/** The room a run has at its narrowest, against what the lines there ask for. */
export interface Corridor {
  /** The room between the two boxes. */
  gap: number
  /** What the lines between them ask for: a gap between each, and a margin from each box. */
  need: number
  /** The index of the box on the low side and on the high side of the run. */
  before: number
  after: number
  /** How many lines are there at once. */
  lines: number
}

/**
 * The narrowest place along a run: the room between the nearest box on either side of it and
 * what the runs there at once ask for, the gap `keeps` between each and `margin` from each box, at the
 * worst of the stretches the run's extent is cut into by the edges of the boxes and the ends of
 * the other runs. Where the boxes beside a run change along it, so does the room, and the lines
 * that run beside it for a part of its way count only there. A run with no box on one side has
 * no corridor there.
 */
export function narrowest(
  run: Stretch,
  runs: readonly Stretch[],
  boxes: readonly Box[],
  horizontal: boolean,
  keeps: Keeps,
  /** The white from a box to the edge of the nearest line, by box and side. */
  margin: (box: number, side: Side) => number,
): Corridor | undefined {
  const extent = (b: Box): [number, number] =>
    horizontal ? [b.x, b.x + b.width] : [b.y, b.y + b.height]
  const across = (b: Box): [number, number] =>
    horizontal ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
  const [sLo, sHi]: [Side, Side] = horizontal ? ['bottom', 'top'] : ['right', 'left']
  const cuts = new Set<number>([run.from, run.to])
  for (const b of boxes)
    for (const e of extent(b)) if (e > run.from + EPS && e < run.to - EPS) cuts.add(e)
  for (const r of runs)
    for (const e of [r.from, r.to]) if (e > run.from + EPS && e < run.to - EPS) cuts.add(e)
  const places = [...cuts].sort((p, q) => p - q)
  let worst: Corridor | undefined
  for (const [k, s] of places.entries()) {
    const e = places[k + 1]
    if (e === undefined) continue
    let before = -1
    let after = -1
    let lo = Number.NEGATIVE_INFINITY
    let hi = Number.POSITIVE_INFINITY
    for (const [i, b] of boxes.entries()) {
      const [e0, e1] = extent(b)
      if (e0 >= e - EPS || e1 <= s + EPS) continue
      const [c0, c1] = across(b)
      if (c1 <= run.at + EPS) {
        if (c1 > lo + EPS || (Math.abs(c1 - lo) <= EPS && i < before)) {
          lo = c1
          before = i
        }
      } else if (c0 >= run.at - EPS) {
        if (c0 < hi - EPS || (Math.abs(c0 - hi) <= EPS && i < after)) {
          hi = c0
          after = i
        }
      }
    }
    if (before < 0 || after < 0) continue
    const here = new Map<number, Stretch>()
    for (const r of runs) {
      if (r.at > lo - EPS && r.at < hi + EPS && r.from < e - EPS && r.to > s + EPS) {
        const key = Math.round(r.at / EPS)
        if (!here.has(key)) here.set(key, r)
      }
    }
    const stood = [...here.values()].sort((p, q) => p.at - q.at)
    const lines = Math.max(1, stood.length)
    let between = 0
    for (const [k, r] of stood.entries()) {
      const next = stood[k + 1]
      if (next) between += keeps.between(r.line, next.line)
    }
    const need =
      between +
      margin(before, sLo) +
      keeps.half(stood[0]?.line) +
      margin(after, sHi) +
      keeps.half(stood[stood.length - 1]?.line)
    const gap = hi - lo
    if (!worst || gap / need < worst.gap / worst.need) worst = { gap, need, before, after, lines }
  }
  return worst
}

/**
 * What the lines, as drawn, lack of the placement: a check. Where K lines run side by side between
 * two boxes, the boxes must stand the gaps between the K lines apart and more, a lead-out from a
 * side with a port on it and a white from one without, each counted to the line's edge, the same room the report measures (`narrowest`). Where
 * they stand closer, the room is what the two boxes would be asked for; the layout is asked from the rooms
 * that were too small (`realize`), and this says whether anything was left out. Every line is
 * counted that is routed, whether or not it places anything: a line that finds its way between the
 * others needs room as much as any.
 *
 * Each line counts once, wherever it was put: lines that the solution had no room to keep apart
 * are still lines that need the room. The runs are read from the lines as drawn, not from what was planned for them, so the room asked
 * for is the room that the drawing lacks. A line's first and last stretch belong to its port and
 * not to a corridor.
 */
export function demandsOf(
  problem: Problem,
  geometry: Geometry,
  wires: ReadonlyMap<string, readonly Point[]>,
): Demand[] {
  const { gapApart, leadOut } = problem.metrics
  const lineOf = new Map(problem.lines.map((l) => [l.id, l]))
  const keeps: Keeps = {
    between: (a, b) => {
      const p = lineOf.get(String(a))
      const q = lineOf.get(String(b))
      return p && q ? pitchOf(problem.metrics, p, q) : gapApart
    },
    half: (a) => {
      const p = lineOf.get(String(a))
      return p ? problem.metrics.width(p.link) / 2 : 0
    },
  }
  const ported = portSides(problem, geometry)
  // A box is its card, or each member of a unit; the demand is for the item that holds it.
  const boxes: [string, Box, Set<Side>][] = [
    ...problem.items.flatMap((item) =>
      (item.kind === 'unit' ? (item.members ?? []).map((m) => m.node.id) : [item.id]).flatMap(
        (id): [string, Box, Set<Side>][] => {
          const b = geometry.boxes.get(id)
          return b ? [[item.id, b, ported.get(id) ?? new Set()]] : []
        },
      ),
    ),
    ...problem.frames
      .filter((f) => f.id !== ROOT)
      .flatMap((f): [string, Box, Set<Side>][] => {
        const b = geometry.boxes.get(frameKey(f.id))
        return b ? [[frameKey(f.id), b, new Set()]] : []
      }),
  ]
  const margin = (sides: Set<Side>, side: Side) => (sides.has(side) ? leadOut : gapApart)
  const routed = new Set(problem.lines.filter((l) => l.role !== 'inside').map((l) => l.id))
  const demands = new Map<string, Demand>()
  for (const horizontal of [true, false]) {
    const runs: Run[] = []
    for (const [id, points] of wires) {
      if (!routed.has(id)) continue
      for (let i = 1; i + 2 < points.length; i++) {
        const p = points[i]
        const q = points[i + 1]
        if (!p || !q) continue
        const [at, a, b, off] = horizontal ? [p.y, p.x, q.x, q.y - p.y] : [p.x, p.y, q.y, q.x - p.x]
        if (Math.abs(off) > EPS || Math.abs(b - a) <= EPS) continue
        runs.push({ line: id, at, from: Math.min(a, b), to: Math.max(a, b) })
      }
    }
    const rects = boxes.map(([, b]) => b)
    for (const run of runs) {
      const c = narrowest(run, runs, rects, horizontal, keeps, (i, side) =>
        margin(boxes[i]?.[2] ?? new Set(), side),
      )
      if (!c || c.gap >= c.need - EPS) continue
      const before = boxes[c.before]?.[0] ?? ''
      const after = boxes[c.after]?.[0] ?? ''
      const key = `${horizontal ? 'y' : 'x'}\0${before}\0${after}`
      const known = demands.get(key)
      if (!known || known.min < c.need) {
        demands.set(key, { axis: horizontal ? 'y' : 'x', before, after, min: c.need })
      }
    }
  }
  return [...demands.values()].sort(
    (p, q) => compare(p.axis, q.axis) || compare(p.before, q.before) || compare(p.after, q.after),
  )
}
