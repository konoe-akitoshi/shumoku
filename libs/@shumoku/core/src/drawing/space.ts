// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Box, Point } from './metrics.js'
import { round } from './ports.js'
import { type Band, type FrameId, frameKey, type Geometry, type Problem, ROOT } from './problem.js'

/**
 * A rectangle of free space: no card inside it and no frame edge through it. `frame` is the
 * deepest frame that holds it. A band cell lies outside the drawing, against its top or bottom
 * edge, and has no frame of its own.
 */
export interface Cell {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  frame: FrameId
  band?: Band
  /** How many lines can run side by side along the cell, horizontally and vertically. */
  laneX: number
  laneY: number
  /** The doors on the cell's four sides, each with the cell it leads to. */
  doors: { door: number; side: 'top' | 'right' | 'bottom' | 'left'; to: number }[]
}

/**
 * The edge two cells share. `normal` is the axis a line crosses it along: for `x` the door is a
 * vertical segment with `a` on its left and `b` on its right, for `y` a horizontal one with `a`
 * above and `b` below.
 */
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
  /** The stretch of it a line may cross at: a margin in from each end, or the middle if it is too short for that. */
  reach: [number, number]
  /** How many lines can cross it side by side, a margin from each end and a pitch from each other. */
  capacity: number
}

export interface Space {
  /** What the cells fill: the drawing with a margin all round for the first turns. */
  bounds: Box
  cells: Cell[]
  doors: Door[]
  /** The band cells that were asked for. */
  bands: Partial<Record<Band, number>>
  /** The cards, kept a pitch clear: what the cells leave out. */
  obstacles: Box[]
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
 * How far a line keeps from the end of a door or the side of a cell: a pitch, or a lead-out less
 * the pitch that a card's cell already keeps from the card, whichever is more, so that a line
 * that passes a card is a lead-out from it, as far as the line that leaves it is.
 */
export function clearance(pitch: number, leadOut: number): number {
  return Math.max(pitch, leadOut - pitch)
}

/** How many lines fit side by side over `length`, a margin clear of each end. */
export function lanes(length: number, pitch: number, leadOut: number): number {
  const m = clearance(pitch, leadOut)
  return Math.max(0, Math.floor((length - 2 * m) / pitch) + 1)
}

/**
 * Cuts the free space of a drawing into cells and the doors between them. A card, kept a pitch
 * clear, is an obstacle; a frame is not, but its edges cut the space so that no cell is in two
 * frames, and a line can be charged for the cells it runs through. The drawing is given a margin
 * of a lead-out and a pitch all round, where the first turns of a line leaving the outermost
 * cards are, and a band of cells on its top and bottom edge for the lines laid over it.
 *
 * Cells come from a sweep: the space is cut at every height a card or frame begins or ends,
 * each strip into the free stretches between the cards and the frame edges, and stretches that
 * lie above one another with the same extent and frame are joined. So the number of cells grows
 * with the number of boxes, not with the product of their coordinates.
 */
export function buildSpace(
  problem: Problem,
  geometry: Geometry,
  bands: readonly Band[] = ['top', 'bottom'],
): Space {
  const { pitch, leadOut, groupGap } = problem.metrics

  const obstacles: Box[] = []
  for (const item of problem.items) {
    const boxes =
      item.kind === 'unit'
        ? (item.members ?? []).map((m) => geometry.boxes.get(m.node.id))
        : [geometry.boxes.get(item.id)]
    for (const b of boxes) {
      if (b) {
        obstacles.push({
          x: round(b.x - pitch),
          y: round(b.y - pitch),
          width: round(b.width + 2 * pitch),
          height: round(b.height + 2 * pitch),
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
            laneX: 0,
            laneY: 0,
            doors: [],
          }
          cells.push(cell)
          next.set(key, cell)
        }
      }
    }
    open = next
  }

  const asked: Partial<Record<Band, number>> = {}
  for (const band of ['top', 'bottom'] as const) {
    if (!bands.includes(band)) continue
    // The band's own thickness is settled after the wiring, from the lines in it; until then it
    // is the least it can be, the room kept between it and what is inside.
    const cell: Cell = {
      id: cells.length,
      x0: bx0,
      x1: bx1,
      y0: band === 'top' ? round(by0 - groupGap) : by1,
      y1: band === 'top' ? by0 : round(by1 + groupGap),
      frame: ROOT,
      band,
      laneX: Number.POSITIVE_INFINITY,
      laneY: 0,
      doors: [],
    }
    cells.push(cell)
    asked[band] = cell.id
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
        doors.push({
          id,
          a: a.id,
          b: b.id,
          normal,
          at,
          lo: from,
          hi: to,
          reach:
            to - from >= 2 * clearance(pitch, leadOut)
              ? [from + clearance(pitch, leadOut), to - clearance(pitch, leadOut)]
              : [(from + to) / 2, (from + to) / 2],
          capacity: lanes(to - from, pitch, leadOut),
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

  for (const c of cells) {
    if (c.band === undefined) {
      c.laneX = lanes(c.y1 - c.y0, pitch, leadOut)
      c.laneY = lanes(c.x1 - c.x0, pitch, leadOut)
    } else {
      c.laneY = lanes(c.x1 - c.x0, pitch, leadOut)
    }
  }

  // ---- lookup: the strips, each with its cells from left to right
  const strips = ys.flatMap((top, i) => {
    const bottom = ys[i + 1]
    return bottom === undefined || bottom - top < EPS ? [] : [{ top, bottom, cells: [] as Cell[] }]
  })
  for (const c of cells) {
    if (c.band !== undefined) continue
    for (const s of strips) if (s.top >= c.y0 - EPS && s.bottom <= c.y1 + EPS) s.cells.push(c)
  }
  for (const s of strips) s.cells.sort((p, q) => p.x0 - q.x0)
  const cellAt = (p: Point): number | undefined => {
    if (p.x < bx0 - EPS || p.x > bx1 + EPS) return undefined
    if (p.y < by0 - EPS) return asked.top
    if (p.y > by1 + EPS) return asked.bottom
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

  return { bounds, cells, doors, bands: asked, obstacles: obs.map(toBox), cellAt }
}

const toBox = (r: { x0: number; y0: number; x1: number; y1: number }): Box => ({
  x: r.x0,
  y: r.y0,
  width: r.x1 - r.x0,
  height: r.y1 - r.y0,
})
