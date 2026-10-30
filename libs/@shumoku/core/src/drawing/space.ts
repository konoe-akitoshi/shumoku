// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Box, Point } from './metrics.js'
import { round } from './ports.js'
import { type FrameId, frameKey, type Geometry, type Problem, ROOT } from './problem.js'
import type { Side } from './scene.js'
import { portSides } from './sides.js'

/**
 * A rectangle of free space: no card inside it and no frame edge through it. `frame` is the
 * deepest frame that holds it.
 */
export interface Cell {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  frame: FrameId
  /** The doors on the cell's four sides, each with the cell it leads to. */
  doors: { door: number; side: 'top' | 'right' | 'bottom' | 'left'; to: number }[]
}

/**
 * The edge two cells share. `normal` is the axis a line crosses it along: for `x` the door is a
 * vertical segment with `a` on its left and `b` on its right, for `y` a horizontal one with `a`
 * above and `b` below.
 */
/** A box that makes one end of a room, and where its edge is: what a request for more room is made of. */
export interface Wall {
  item: string
  edge: number
}

export interface Door {
  id: number
  a: number
  b: number
  normal: 'x' | 'y'
  /** The coordinate of the door along its normal. */
  at: number
  /** The extent of the door across its normal. */
  lo: number
  hi: number
  /** The stretch of it a line may cross at: a margin in from each end, or between them if it is too short for that. */
  reach: [number, number]
  /** How many lines can cross it side by side, a margin from each end and a pitch from each other. */
  capacity: number
  /**
   * The item that bounds each end of it, the lower end and the higher, and where its edge is: none
   * where a frame or the edge of the drawing does.
   */
  by: [Wall[] | undefined, Wall[] | undefined]
}

export interface Space {
  /** What the cells fill: the drawing with a margin all round for the first turns. */
  bounds: Box
  cells: Cell[]
  doors: Door[]
  /** The cards, kept a pitch clear: what the cells leave out. */
  obstacles: Box[]
  /**
   * How far a line keeps from each side of an obstacle, beyond the pitch the obstacle is already
   * kept clear by: the room for the lead-outs of the ports on that side, and for a side with no
   * port, nothing but the pitch.
   */
  margins: Record<Side, number>[]
  /** The item each obstacle is of, which is what a request for room is made of. */
  owners: string[]
  /**
   * The boxes that make the two ends of a cell along an axis, all of them: the cards and frames
   * whose edge is the cell's end, over any part of the cell's extent. A cut made by a box that is
   * only beside the cell is not a wall.
   */
  wallsOf(cell: Cell, axis: 'x' | 'y'): { lo: Wall[]; hi: Wall[] }
  /** The cell holding a point, or `undefined` outside the drawing and inside a card. */
  cellAt(p: Point): number | undefined
}

const EPS = 1e-4

/** The midpoint of a door. */
export function doorMid(d: Door): Point {
  const m = (d.lo + d.hi) / 2
  return d.normal === 'x' ? { x: d.at, y: m } : { x: m, y: d.at }
}

/**
 * How far a line keeps from the side of a card that has ports on it: a lead-out less the pitch
 * that the card's cell already keeps from the card, so that a line that passes the card is a
 * lead-out from it, as far as the lines that leave it go straight. Past a side with no port it
 * keeps a pitch.
 */
export function clearance(pitch: number, leadOut: number, ported: boolean): number {
  return ported ? Math.max(pitch, leadOut - pitch) : pitch
}

/** How many lines fit side by side over `length`, the margins clear of its two ends. */
export function lanes(length: number, pitch: number, margins: readonly [number, number]): number {
  return Math.max(0, Math.floor((length - margins[0] - margins[1]) / pitch) + 1)
}

/**
 * Cuts the free space of a drawing into cells and the doors between them. A card, kept a pitch
 * clear, is an obstacle; a frame is not, but its edges cut the space so that no cell is in two
 * frames, and a line can be charged for the cells it runs through. The drawing is given a margin
 * of a lead-out and a pitch all round, where the first turns of a line leaving the outermost
 * cards are.
 *
 * Cells come from a sweep: the space is cut at every height a card or frame begins or ends,
 * each strip into the free stretches between the cards and the frame edges, and stretches that
 * lie above one another with the same extent and frame are joined. So the number of cells grows
 * with the number of boxes, not with the product of their coordinates.
 */
export function buildSpace(problem: Problem, geometry: Geometry): Space {
  const { pitch, leadOut } = problem.metrics

  const ported = portSides(problem)
  const obstacles: Box[] = []
  const owners: string[] = []
  const margins: Record<Side, number>[] = []
  for (const item of problem.items) {
    const boxes =
      item.kind === 'unit'
        ? (item.members ?? []).map((m) => [m.node.id, geometry.boxes.get(m.node.id)] as const)
        : [[item.id, geometry.boxes.get(item.id)] as const]
    for (const [key, b] of boxes) {
      if (b) {
        obstacles.push({
          x: round(b.x - pitch),
          y: round(b.y - pitch),
          width: round(b.width + 2 * pitch),
          height: round(b.height + 2 * pitch),
        })
        owners.push(item.id)
        const sides = ported.get(key)
        margins.push({
          top: clearance(pitch, leadOut, sides?.has('top') ?? false),
          bottom: clearance(pitch, leadOut, sides?.has('bottom') ?? false),
          left: clearance(pitch, leadOut, sides?.has('left') ?? false),
          right: clearance(pitch, leadOut, sides?.has('right') ?? false),
        })
      }
    }
  }
  const frames = problem.frames.flatMap((f) => {
    const b = f.id === ROOT ? undefined : geometry.boxes.get(frameKey(f.id))
    return b ? [{ id: f.id, box: b }] : []
  })

  const everything: Box[] = [...obstacles, ...frames.map((f) => f.box)]
  const margin = leadOut + pitch
  const x0 = Math.min(...everything.map((b) => b.x), 0) - margin
  const y0 = Math.min(...everything.map((b) => b.y), 0) - margin
  const x1 = Math.max(...everything.map((b) => b.x + b.width), 0) + margin
  const y1 = Math.max(...everything.map((b) => b.y + b.height), 0) + margin
  const bounds: Box = {
    x: round(x0),
    y: round(y0),
    width: round(x1 - x0),
    height: round(y1 - y0),
  }
  const [bx0, by0, bx1, by1] = [
    bounds.x,
    bounds.y,
    round(bounds.x + bounds.width),
    round(bounds.y + bounds.height),
  ]

  const rect = (b: Box) => ({
    x0: round(b.x),
    y0: round(b.y),
    x1: round(b.x + b.width),
    y1: round(b.y + b.height),
  })
  const obs = obstacles.map(rect)
  /**
   * The boxes whose edge lies at `coord` across `axis`, on the low side (their far edge) or the
   * high side (their near edge), over the stretch `from` to `to` along the other axis, or at the
   * point `from` if the two are the same.
   */
  const wallsAt = (
    axis: 'x' | 'y',
    side: 'lo' | 'hi',
    coord: number,
    from: number,
    to: number,
  ): Wall[] => {
    const over = (a0: number, a1: number) =>
      from === to ? a0 <= from + EPS && a1 >= from - EPS : a1 > from + EPS && a0 < to - EPS
    const out: Wall[] = []
    for (const [k, o] of obs.entries()) {
      const [a0, a1, e0, e1] = axis === 'y' ? [o.x0, o.x1, o.y0, o.y1] : [o.y0, o.y1, o.x0, o.x1]
      if (!over(a0, a1)) continue
      if (side === 'lo' ? Math.abs(e1 - coord) <= EPS : Math.abs(e0 - coord) <= EPS) {
        out.push({ item: owners[k] ?? '', edge: side === 'lo' ? e1 - pitch : e0 + pitch })
      }
    }
    for (const f of frames) {
      const b = f.box
      const [a0, a1, e0, e1] =
        axis === 'y'
          ? [b.x, b.x + b.width, b.y, b.y + b.height]
          : [b.y, b.y + b.height, b.x, b.x + b.width]
      if (!over(a0, a1)) continue
      if (side === 'lo' ? Math.abs(e1 - coord) <= EPS : Math.abs(e0 - coord) <= EPS) {
        out.push({ item: frameKey(f.id), edge: side === 'lo' ? e1 : e0 })
      }
    }
    return out
  }
  /**
   * How far a line keeps from the end of a door, and the item that bounds it there: the margin of
   * the side of the card that bounds it, or a pitch where a frame or the edge of the drawing does.
   */
  const keep = (
    normal: 'x' | 'y',
    at: number,
    end: number,
    low: boolean,
  ): { margin: number; by?: Wall[] } => {
    for (const [k, o] of obs.entries()) {
      const m = margins[k]
      if (!m) continue
      if (normal === 'x') {
        if (o.x0 > at + EPS || o.x1 < at - EPS) continue
        if (low ? Math.abs(o.y1 - end) <= EPS : Math.abs(o.y0 - end) <= EPS) {
          return {
            margin: low ? m.bottom : m.top,
            by: wallsAt('y', low ? 'lo' : 'hi', end, at, at),
          }
        }
      } else {
        if (o.y0 > at + EPS || o.y1 < at - EPS) continue
        if (low ? Math.abs(o.x1 - end) <= EPS : Math.abs(o.x0 - end) <= EPS) {
          return {
            margin: low ? m.right : m.left,
            by: wallsAt('x', low ? 'lo' : 'hi', end, at, at),
          }
        }
      }
    }
    // Not at a card: at the edge of a frame, which a line keeps a pitch from and whose place is
    // as much the layout's as a card's, or at a line the space is cut by for a card elsewhere,
    // where the free space goes on and there is nothing to keep from.
    for (const f of frames) {
      const b = f.box
      const [across0, across1, along0, along1] =
        normal === 'x'
          ? [b.x, b.x + b.width, b.y, b.y + b.height]
          : [b.y, b.y + b.height, b.x, b.x + b.width]
      const edge = low ? along1 : along0
      if (at >= across0 - EPS && at <= across1 + EPS && Math.abs(edge - end) <= EPS) {
        return {
          margin: pitch,
          by: wallsAt(normal === 'x' ? 'y' : 'x', low ? 'lo' : 'hi', end, at, at),
        }
      }
    }
    return { margin: 0 }
  }
  const frs = frames.map((f) => ({ id: f.id, ...rect(f.box) }))

  const ys = [
    ...new Set([
      by0,
      by1,
      ...obs.flatMap((o) => [o.y0, o.y1]),
      ...frs.flatMap((f) => [f.y0, f.y1]),
    ]),
  ]
    .filter((y) => y >= by0 && y <= by1)
    .sort((p, q) => p - q)

  const cells: Cell[] = []
  /** Cells still open at the bottom of the previous strip, by their extent and frame. */
  let open = new Map<string, Cell>()
  for (const [i, top] of ys.entries()) {
    const bottom = ys[i + 1]
    if (bottom === undefined || bottom - top < EPS) continue
    const blocked = obs
      .filter((o) => o.y0 < bottom - EPS && o.y1 > top + EPS)
      .map((o) => [o.x0, o.x1] as const)
      .sort((p, q) => p[0] - q[0])
    const here = frs.filter((f) => f.y0 < bottom - EPS && f.y1 > top + EPS)
    const cuts = [...new Set(here.flatMap((f) => [f.x0, f.x1]))].sort((p, q) => p - q)

    const free: [number, number][] = []
    let from = bx0
    for (const [lo, hi] of blocked) {
      if (lo > from + EPS) free.push([from, Math.min(lo, bx1)])
      from = Math.max(from, hi)
    }
    if (from < bx1 - EPS) free.push([from, bx1])

    const next = new Map<string, Cell>()
    for (const [lo, hi] of free) {
      const inner = cuts.filter((c) => c > lo + EPS && c < hi - EPS)
      const edges = [lo, ...inner, hi]
      for (const [k, a] of edges.entries()) {
        const b = edges[k + 1]
        if (b === undefined || b - a < EPS) continue
        // The frames are listed parent before child, so the last that holds the stretch is the
        // deepest.
        let frame: FrameId = ROOT
        for (const f of here) if (f.x0 <= a + EPS && b <= f.x1 + EPS) frame = f.id
        const key = `${a}\0${b}\0${frame}`
        const above = open.get(key)
        if (above) {
          above.y1 = bottom
          next.set(key, above)
        } else {
          const cell: Cell = {
            id: cells.length,
            x0: a,
            y0: top,
            x1: b,
            y1: bottom,
            frame,
            doors: [],
          }
          cells.push(cell)
          next.set(key, cell)
        }
      }
    }
    open = next
  }

  // ---- doors: cells that meet along an edge of positive length
  const doors: Door[] = []
  const meet = (left: Cell[], right: Cell[], normal: 'x' | 'y', at: number) => {
    const lo = (c: Cell) => (normal === 'x' ? c.y0 : c.x0)
    const hi = (c: Cell) => (normal === 'x' ? c.y1 : c.x1)
    left.sort((p, q) => lo(p) - lo(q))
    right.sort((p, q) => lo(p) - lo(q))
    let j = 0
    for (const a of left) {
      while (j < right.length && hi(right[j] as Cell) <= lo(a) + EPS) j++
      for (let k = j; k < right.length; k++) {
        const b = right[k] as Cell
        if (lo(b) >= hi(a) - EPS) break
        const from = Math.max(lo(a), lo(b))
        const to = Math.min(hi(a), hi(b))
        if (to - from < EPS) continue
        const id = doors.length
        const [low, high] = [keep(normal, at, from, true), keep(normal, at, to, false)]
        const keeps: [number, number] = [low.margin, high.margin]
        // A door too short for its margins is crossed where they give way to each other equally.
        const split = from + ((to - from) * keeps[0]) / (keeps[0] + keeps[1])
        doors.push({
          id,
          a: a.id,
          b: b.id,
          normal,
          at,
          lo: from,
          hi: to,
          reach:
            to - from >= keeps[0] + keeps[1] ? [from + keeps[0], to - keeps[1]] : [split, split],
          capacity: lanes(to - from, pitch, keeps),
          by: [low.by, high.by],
        })
        a.doors.push({ door: id, side: normal === 'x' ? 'right' : 'bottom', to: b.id })
        b.doors.push({ door: id, side: normal === 'x' ? 'left' : 'top', to: a.id })
      }
    }
  }
  const group = (key: (c: Cell) => number) => {
    const m = new Map<number, Cell[]>()
    for (const c of cells) m.set(key(c), [...(m.get(key(c)) ?? []), c])
    return m
  }
  const rightEdge = group((c) => c.x1)
  const leftEdge = group((c) => c.x0)
  for (const [at, left] of rightEdge) {
    const right = leftEdge.get(at)
    if (right) meet(left, [...right], 'x', at)
  }
  const bottomEdge = group((c) => c.y1)
  const topEdge = group((c) => c.y0)
  for (const [at, above] of bottomEdge) {
    const below = topEdge.get(at)
    if (below) meet(above, [...below], 'y', at)
  }

  // ---- lookup: the strips, each with its cells from left to right
  const strips = ys.flatMap((top, i) => {
    const bottom = ys[i + 1]
    return bottom === undefined || bottom - top < EPS ? [] : [{ top, bottom, cells: [] as Cell[] }]
  })
  for (const c of cells) {
    for (const s of strips) if (s.top >= c.y0 - EPS && s.bottom <= c.y1 + EPS) s.cells.push(c)
  }
  for (const s of strips) s.cells.sort((p, q) => p.x0 - q.x0)
  const cellAt = (p: Point): number | undefined => {
    if (p.x < bx0 - EPS || p.x > bx1 + EPS) return undefined
    if (p.y < by0 - EPS || p.y > by1 + EPS) return undefined
    let lo = 0
    let hi = strips.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const s = strips[mid]
      if (!s) return undefined
      if (p.y < s.top - EPS) hi = mid - 1
      else if (p.y >= s.bottom - EPS) lo = mid + 1
      else return s.cells.find((c) => p.x >= c.x0 - EPS && p.x <= c.x1 + EPS)?.id
    }
    // On the edge of the drawing itself: the last strip's bottom.
    const last = strips[strips.length - 1]
    return last && p.y <= last.bottom + EPS
      ? last.cells.find((c) => p.x >= c.x0 - EPS && p.x <= c.x1 + EPS)?.id
      : undefined
  }

  const wallsOf = (cell: Cell, axis: 'x' | 'y') =>
    axis === 'y'
      ? {
          lo: wallsAt('y', 'lo', cell.y0, cell.x0, cell.x1),
          hi: wallsAt('y', 'hi', cell.y1, cell.x0, cell.x1),
        }
      : {
          lo: wallsAt('x', 'lo', cell.x0, cell.y0, cell.y1),
          hi: wallsAt('x', 'hi', cell.x1, cell.y0, cell.y1),
        }

  return {
    bounds,
    cells,
    doors,
    obstacles: obs.map(toBox),
    margins,
    owners,
    wallsOf,
    cellAt,
  }
}

const toBox = (r: { x0: number; y0: number; x1: number; y1: number }): Box => ({
  x: r.x0,
  y: r.y0,
  width: r.x1 - r.x0,
  height: r.y1 - r.y0,
})
