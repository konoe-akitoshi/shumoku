// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { arcsOf } from './arcs.js'
import { cornerOf, jogsOf, labelBandOf, snapOf } from './kin.js'
import type { Point } from './metrics.js'
import type { Problem } from './problem.js'
import { EPS } from './tolerance.js'

/**
 * How a line turns at a vertex of its realized (axis-parallel) wire. Every turn is one form: a 45°
 * straight that begins `leg` before the vertex on the run coming in and ends `leg` after it on the
 * run going out (a chamfer, measured along the axes), both its ends 135° vertices rounded with the
 * line's radius `R`. The least chamfer, `leg = (2 − √2)·R`, rounded so, is exactly the quarter
 * circle of `R`, which is how a turn with no room past its corner is drawn (`leg` 0: the vertex
 * itself, rounded with `rho`, which is `R` or, in a nest, the concentric `R_0 + D`). A longer leg
 * is a 45° straight of the route, as long as the room beside it lets it be (`diagonalsOf`).
 *
 * Two turns that turn opposite ways at the ends of one straight (a step) may share one 45°
 * straight: the first's chamfer ends where the second's begins (`through`, legs adding up to the
 * step). That is the shortest form of a step: one 45° straight in place of the step and its two
 * corners.
 */
export interface Turn {
  /** The vertex, in the line's simplified wire (`dropNearCollinear`). */
  i: number
  /** The line's own radius. */
  own: number
  /** The radius the turn is drawn with: at the vertex when `leg` is 0, else at the chamfer's ends. */
  rho: number
  /** How far before and after the vertex, along the runs, the 45° straight begins and ends; 0: none. */
  leg: number
  /** The 45° straight goes on into the next turn (a step crossed by one 45° straight). */
  through?: boolean
  /** The turns of a nest share an id: they turn together, each `D` out of the innermost. */
  nest?: number
  D: number
}

/** `R·tan 22.5°`: what rounding a 135° vertex with `R` takes of either straight beside it. */
export const tangentOf = (radius: number) => (Math.SQRT2 - 1) * radius

/** The leg of the chamfer that, rounded with `R`, is the quarter circle of `R`. */
export const quarterLegOf = (radius: number) => (2 - Math.SQRT2) * radius

/**
 * The turns realize gives room for: every corner a quarter circle of the line's radius (concentric
 * `R_0 + D` in a nest, as far as each member's straights hold it), every step shorter than `2R`
 * one 45° straight (a jog: `jogsOf`, halves of the step on either side). This is what the drawing
 * is when no turn takes more room than its corner; `diagonalsOf` lengthens the 45° straights from
 * here, never below.
 */
export function turnsOf(
  problem: Problem,
  skeleton: ReadonlyMap<string, Point[]>,
): Map<string, Turn[]> {
  const metrics = problem.metrics
  const lines = new Map(problem.lines.map((l) => [l.id, l]))
  const snap = snapOf(metrics)
  interface Corner {
    turn: Turn
    line: string
    v: Point
    sx: number
    sy: number
    hold: number
    inner?: Corner
    outer?: Corner
    d: number
  }
  const out = new Map<string, Turn[]>()
  const corners: Corner[] = []
  const bandOf = labelBandOf(metrics)
  for (const [id, pts] of skeleton) {
    const line = lines.get(id)
    if (!line) continue
    const own = cornerOf(metrics, line)
    const turn = (i: number) => turnSign(pts, i)
    const segs = pts.slice(1).map((b, k) => ({
      length: dist(pts[k] ?? b, b),
      step: turn(k) * turn(k + 1) < 0,
    }))
    const isJog = jogsOf(segs, own)
    const list: Turn[] = []
    const jogAt = new Set<number>()
    for (const [k, jog] of isJog.entries()) {
      if (!jog || k < 1 || k + 2 > pts.length - 1) continue
      const half = (segs[k]?.length ?? 0) / 2
      list.push({ i: k, own, rho: own, leg: half, through: true, D: 0 })
      list.push({ i: k + 1, own, rho: own, leg: half, D: 0 })
      jogAt.add(k)
      jogAt.add(k + 1)
    }
    // What the turn at vertex `i` takes of a straight: a jog's end, or a corner's `R`.
    const takes = (i: number) => {
      const t = list.find((x) => x.i === i)
      return t ? t.leg + tangentOf(own) : own
    }
    for (let i = 1; i + 1 < pts.length; i++) {
      if (jogAt.has(i)) continue
      const p = pts[i - 1]
      const v = pts[i]
      const n = pts[i + 1]
      if (!p || !v || !n) continue
      const din = unit(p, v)
      const dout = unit(v, n)
      if (Math.abs(din.x * dout.x + din.y * dout.y) > EPS) continue // not a right angle
      const legIn = dist(p, v)
      const legOut = dist(v, n)
      const holdIn = i - 1 === 0 ? legIn - bandOf : legIn - takes(i - 1)
      const holdOut = i + 1 === pts.length - 1 ? legOut - bandOf : legOut - takes(i + 1)
      const t: Turn = { i, own, rho: own, leg: 0, D: 0 }
      list.push(t)
      corners.push({
        turn: t,
        line: id,
        v,
        sx: -din.x + dout.x,
        sy: -din.y + dout.y,
        hold: Math.min(holdIn, holdOut),
        d: 0,
      })
    }
    list.sort((a, b) => a.i - b.i)
    out.set(id, list)
  }

  // Nests: the corners of one kind (inside quadrant) that turn together, each on the diagonal of the
  // one inside it and alongside both its legs, nearest first.
  const kinds = new Map<string, Corner[]>()
  for (const c of corners)
    kinds.set(`${c.sx},${c.sy}`, [...(kinds.get(`${c.sx},${c.sy}`) ?? []), c])
  const inward = (c: Corner) => c.v.x * c.sx + c.v.y * c.sy
  for (const list of kinds.values()) {
    list.sort((p, q) => inward(q) - inward(p))
    for (const [idx, outer] of list.entries()) {
      const legs = legLengths(skeleton.get(outer.line), outer.turn.i)
      for (const inner of list.slice(0, idx).reverse()) {
        if (inner.line === outer.line || inner.outer) continue
        const dx = (inner.v.x - outer.v.x) * outer.sx
        const dy = (inner.v.y - outer.v.y) * outer.sy
        if (dx < EPS || dy < EPS || Math.abs(dx - dy) > snap) continue
        if (dx > Math.min(legs.in, legs.out)) continue
        const own = legLengths(skeleton.get(inner.line), inner.turn.i)
        if (Math.min(own.in, own.out) < EPS) continue
        outer.inner = inner
        inner.outer = outer
        outer.d = Math.min(dx, dy)
        break
      }
    }
  }
  // Concentric from the innermost out: `R_0 + D`, as far as each member's straights hold it. A
  // member that cannot hold it keeps its own radius and starts a nest of its own.
  let nests = 0
  for (const root of corners) {
    if (root.inner) continue
    let base = root
    let D = 0
    let id = nests++
    root.turn.nest = id
    for (let o = root.outer; o; o = o.outer) {
      D += o.d
      const want = base.turn.rho + D
      if (want <= o.hold + EPS) {
        o.turn.rho = want
        o.turn.D = D
        o.turn.nest = id
      } else {
        base = o
        D = 0
        id = nests++
        o.turn.nest = id
      }
    }
  }
  return out
}

/** The drawn wire of a line: its points and the radius each is rounded with (0 at the ends). */
export function drawTurns(
  pts: readonly Point[],
  turns: readonly Turn[],
): { points: Point[]; radii: number[] } {
  const at = new Map(turns.map((t) => [t.i, t]))
  const points: Point[] = []
  const radii: number[] = []
  for (const [i, v] of pts.entries()) {
    const t = at.get(i)
    const p = pts[i - 1]
    const n = pts[i + 1]
    if (!t || !p || !n) {
      points.push(v)
      radii.push(0)
      continue
    }
    if (t.leg <= EPS) {
      points.push(v)
      radii.push(t.rho)
      continue
    }
    const din = unit(p, v)
    const dout = unit(v, n)
    if (!at.get(i - 1)?.through) {
      points.push({ x: v.x - din.x * t.leg, y: v.y - din.y * t.leg })
      radii.push(t.rho)
    }
    if (!t.through) {
      points.push({ x: v.x + dout.x * t.leg, y: v.y + dout.y * t.leg })
      radii.push(t.rho)
    }
  }
  return { points, radii }
}

/**
 * The drawn wire as a polyline, its arcs cut into short chords, rounded as the renderer rounds it
 * (`arcsOf`).
 */
export function sampled(points: readonly Point[], radii: readonly number[]): Point[] {
  const out: Point[] = []
  const first = points[0]
  if (!first) return out
  out.push(first)
  for (const [i, arc] of arcsOf(points, radii).entries()) {
    const v = points[i]
    if (!v) continue
    if (!arc) {
      if (i > 0 && i < points.length - 1) out.push(v)
      continue
    }
    const a0 = Math.atan2(arc.from.y - arc.centre.y, arc.from.x - arc.centre.x)
    const steps = Math.max(2, Math.ceil(arc.theta / (Math.PI / 16)))
    const sign = arc.clockwise ? 1 : -1
    for (let s = 0; s <= steps; s++) {
      const ang = a0 + (sign * arc.theta * s) / steps
      out.push({ x: arc.centre.x + arc.r * Math.cos(ang), y: arc.centre.y + arc.r * Math.sin(ang) })
    }
  }
  const last = points[points.length - 1]
  if (last && points.length > 1) out.push(last)
  return out
}

/** The way a polyline turns at vertex `i`: +1, −1, or 0 (an end, or straight on). */
export function turnSign(pts: readonly Point[], i: number): number {
  const p = pts[i - 1]
  const v = pts[i]
  const n = pts[i + 1]
  return p && v && n ? Math.sign((v.x - p.x) * (n.y - v.y) - (v.y - p.y) * (n.x - v.x)) : 0
}

/** The lengths of the two legs of the vertex `i` of a polyline. */
function legLengths(pts: readonly Point[] | undefined, i: number): { in: number; out: number } {
  const p = pts?.[i - 1]
  const v = pts?.[i]
  const n = pts?.[i + 1]
  return p && v && n ? { in: dist(p, v), out: dist(v, n) } : { in: 0, out: 0 }
}

/**
 * Drops points a hair from the last and vertices a hair off a straight run (within `EPS`). The
 * `dropCollinear` of the ports drops only what is exactly on the run.
 */
export function dropNearCollinear(pts: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && dist(last, p) < EPS) continue
    const prev = out[out.length - 2]
    if (prev && last) {
      const a = unit(prev, last)
      const b = unit(last, p)
      if (Math.abs(a.x * b.y - a.y * b.x) < EPS && a.x * b.x + a.y * b.y > 0) out.pop()
    }
    out.push(p)
  }
  return out
}

export function unit(a: Point, b: Point): Point {
  const d = dist(a, b)
  return d < EPS ? { x: 0, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d }
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}
