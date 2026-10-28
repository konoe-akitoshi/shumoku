// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Point } from './metrics.js'

/** A line as the corners it turns at, ports included. */
export type Path = readonly Point[]

/** One straight stretch of a path: the one from corner `index` to corner `index + 1`. */
export interface Stretch {
  path: Path
  index: number
}

export type Axis = 'h' | 'v'

const sign = Math.sign
const along = (a: Point, axis: Axis) => (axis === 'h' ? a.x : a.y)
const across = (a: Point, axis: Axis) => (axis === 'h' ? a.y : a.x)

export function axisOf(s: Stretch): Axis | undefined {
  const a = s.path[s.index]
  const b = s.path[s.index + 1]
  if (!a || !b) return undefined
  return a.y === b.y ? 'h' : a.x === b.x ? 'v' : undefined
}

/** The run of a stretch along its axis, low end first. */
export function spanOf(s: Stretch): [number, number] {
  const axis = axisOf(s)
  const a = s.path[s.index]
  const b = s.path[s.index + 1]
  if (!axis || !a || !b) return [0, 0]
  const [p, q] = [along(a, axis), along(b, axis)]
  return [Math.min(p, q), Math.max(p, q)]
}

interface Cursor {
  /** The next corner in the direction the walk leaves in. */
  next: number
  step: 1 | -1
}

interface Vec {
  x: number
  y: number
}

/** Where two lines that share a stretch go at one end of it, and where they part. */
export interface Parting {
  /** Which lane each prefers: 1 the higher one (larger y or x), -1 the lower, 0 either. */
  lane: [number, number]
  /** The corners the shared stretch goes on through before they part. */
  through: number
  /** Where they part. */
  where: Point
}

/**
 * Where, and to which side, two lines that run side by side along a stretch part at one end
 * of it. The stretch they share may go on round corners, so this follows both until their ways
 * differ and then says on which side of that way each goes: the one that goes further left
 * wants the lane on the left. Left and right are those of the direction of travel, which does
 * not change as the lines go round a corner together, and are turned back into the lane of the
 * stretch asked about. `overlap` is the run both have in common and `end` the end of it to look at.
 */
export function parting(
  p: Stretch,
  q: Stretch,
  end: 'lo' | 'hi',
  overlap: [number, number],
): Parting {
  const axis = axisOf(p) ?? 'h'
  const first = p.path[p.index]
  const mid = first ? across(first, axis) : 0
  const stop = end === 'hi' ? overlap[1] : overlap[0]
  let here: Vec = axis === 'h' ? { x: stop, y: mid } : { x: mid, y: stop }
  let heading: Vec =
    axis === 'h' ? { x: end === 'hi' ? 1 : -1, y: 0 } : { x: 0, y: end === 'hi' ? 1 : -1 }
  const start = (s: Stretch): Cursor => {
    const from = s.path[s.index]
    const to = s.path[s.index + 1]
    const forward = from && to ? along(from, axis) <= along(to, axis) : true
    return (end === 'hi') === forward ? { next: s.index + 1, step: 1 } : { next: s.index, step: -1 }
  }
  const cursors: [Cursor, Cursor] = [start(p), start(q)]
  const paths = [p.path, q.path]
  // The lane that is on the left of the travel is the higher one on the high end of a
  // horizontal stretch, and so on for the other three.
  const orientation = (axis === 'h' ? 1 : -1) * (end === 'hi' ? 1 : -1)

  for (let through = 0; ; through++) {
    const out: (Vec | undefined)[] = []
    for (const [i, c] of cursors.entries()) {
      const path = paths[i]
      const ahead = path?.[c.next]
      if (!ahead) {
        out.push(undefined)
        continue
      }
      if (ahead.x === here.x && ahead.y === here.y) {
        const after = path?.[c.next + c.step]
        out.push(after ? { x: sign(after.x - here.x), y: sign(after.y - here.y) } : undefined)
        c.next += c.step
      } else {
        out.push(heading)
      }
    }
    const [dp, dq] = out
    const same = dp === dq || (dp && dq && dp.x === dq.x && dp.y === dq.y)
    if (!same) {
      const side = (d: Vec | undefined) =>
        d === undefined ? 0 : sign(heading.x * d.y - heading.y * d.x) * orientation
      return { lane: [side(dp), side(dq)], through, where: here }
    }
    if (!dp) return { lane: [0, 0], through, where: here }
    heading = dp
    // Both go the same way: on to the nearer of the corners they come to next.
    let reach = Number.POSITIVE_INFINITY
    for (const [i, c] of cursors.entries()) {
      const next = paths[i]?.[c.next]
      if (next) reach = Math.min(reach, Math.abs(next.x - here.x) + Math.abs(next.y - here.y))
    }
    if (!Number.isFinite(reach)) return { lane: [0, 0], through, where: here }
    here = { x: here.x + heading.x * reach, y: here.y + heading.y * reach }
  }
}

/** The stretches of a path, as pairs of consecutive corners. */
export function stretchesOf(path: Path): Stretch[] {
  return path.slice(0, -1).map((_, index) => ({ path, index }))
}

/** The run two stretches have in common, if they lie on one line and overlap along it. */
export function overlapOf(p: Stretch, q: Stretch): [number, number] | undefined {
  const axis = axisOf(p)
  const a = p.path[p.index]
  const b = q.path[q.index]
  if (!axis || axisOf(q) !== axis || !a || !b || across(a, axis) !== across(b, axis)) {
    return undefined
  }
  const [plo, phi] = spanOf(p)
  const [qlo, qhi] = spanOf(q)
  const lo = Math.max(plo, qlo)
  const hi = Math.min(phi, qhi)
  return hi > lo ? [lo, hi] : undefined
}

/**
 * What it costs two lines that run along one stretch to take the lanes `p` below `q` (the lower
 * lane has the smaller y or x) or the other way round: one crossing for each end at which the
 * one in the lower lane is the one that wants the higher.
 */
export function laneCosts(
  p: Stretch,
  q: Stretch,
): { pBelow: number; qBelow: number; ends: [Point, Point] } | undefined {
  const overlap = overlapOf(p, q)
  if (!overlap) return undefined
  const lo = parting(p, q, 'lo', overlap)
  const hi = parting(p, q, 'hi', overlap)
  const pHigher = (x: Parting) => Number(x.lane[0] > x.lane[1])
  const qHigher = (x: Parting) => Number(x.lane[1] > x.lane[0])
  return {
    pBelow: pHigher(lo) + pHigher(hi),
    qBelow: qHigher(lo) + qHigher(hi),
    ends: [lo.where, hi.where],
  }
}

const key = (p: Point) => `${p.x},${p.y}`

function properlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const horizontal = a.y === b.y
  if (horizontal === (c.y === d.y)) return false
  const [h0, h1, v0, v1] = horizontal ? [a, b, c, d] : [c, d, a, b]
  return (
    Math.min(h0.x, h1.x) < v0.x &&
    v0.x < Math.max(h0.x, h1.x) &&
    Math.min(v0.y, v1.y) < h0.y &&
    h0.y < Math.max(v0.y, v1.y)
  )
}

/**
 * How many times two lines must cross, counted from their corners alone. Where one goes
 * straight across the other they cross once. Where they run side by side along a stretch they
 * cross once if they come in on one side and part on the other, since whichever lane each takes
 * they must change places somewhere; the same stretch going on round corners is one run, counted
 * once. Lines that only touch at a corner are the business of the lanes they take.
 */
export function crossings(p: Path, q: Path): number {
  let count = 0
  const runs = new Set<string>()
  for (const sp of stretchesOf(p)) {
    for (const sq of stretchesOf(q)) {
      const a = sp.path[sp.index]
      const b = sp.path[sp.index + 1]
      const c = sq.path[sq.index]
      const d = sq.path[sq.index + 1]
      if (a && b && c && d && properlyCross(a, b, c, d)) count++
      const cost = laneCosts(sp, sq)
      if (cost && Math.min(cost.pBelow, cost.qBelow) > 0) {
        runs.add(cost.ends.map(key).sort().join('|'))
      }
    }
  }
  return count + runs.size
}

/**
 * The order of lines, lower lane first, that crosses least: the sum of `cost(a, b)` over every
 * pair with `a` below `b`. Up to eight lines every order is weighed, by a search over the
 * subsets that goes through the lines in the order given, so that equal costs keep that order.
 * Beyond that the lines are put in one at a time, each where it adds least; `exact` says which.
 */
export function laneOrder(
  lines: readonly string[],
  cost: (a: string, b: string) => number,
): { order: string[]; exact: boolean } {
  const n = lines.length
  if (n > 8) {
    const order: string[] = []
    for (const line of lines) {
      let bestAt = 0
      let bestCost = Number.POSITIVE_INFINITY
      for (let slot = 0; slot <= order.length; slot++) {
        let sum = 0
        for (const [i, other] of order.entries()) {
          sum += i < slot ? cost(other, line) : cost(line, other)
        }
        if (sum < bestCost) {
          bestCost = sum
          bestAt = slot
        }
      }
      order.splice(bestAt, 0, line)
    }
    return { order, exact: false }
  }
  const c = lines.map((a) => lines.map((b) => cost(a, b)))
  /** What putting line `r` below all of `rest` that remains adds. */
  const below = (r: number, rest: number): number => {
    let sum = 0
    for (let s = 0; s < n; s++) if (s !== r && (rest & (1 << s)) !== 0) sum += c[r]?.[s] ?? 0
    return sum
  }
  const best = new Map<number, number>()
  const f = (rest: number): number => {
    if (rest === 0) return 0
    const known = best.get(rest)
    if (known !== undefined) return known
    let min = Number.POSITIVE_INFINITY
    for (let r = 0; r < n; r++) {
      if ((rest & (1 << r)) === 0) continue
      min = Math.min(min, below(r, rest) + f(rest & ~(1 << r)))
    }
    best.set(rest, min)
    return min
  }
  const order: string[] = []
  for (let rest = (1 << n) - 1; rest !== 0; ) {
    const target = f(rest)
    for (let r = 0; r < n; r++) {
      if ((rest & (1 << r)) === 0) continue
      const without = rest & ~(1 << r)
      if (below(r, rest) + f(without) === target) {
        order.push(lines[r] ?? '')
        rest = without
        break
      }
    }
  }
  return { order, exact: true }
}
