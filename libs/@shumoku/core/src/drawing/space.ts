// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { joinKey } from '../structure/keys.js'
import { clearance, inflate, keepOff, snapOf } from './kin.js'
import type { Box, Point } from './metrics.js'
import {
  type Demand,
  type FrameId,
  frameKey,
  type Geometry,
  type Problem,
  ROOT,
} from './problem.js'
import type { Side } from './scene.js'
import { portSides } from './sides.js'
import { EPS, round } from './tolerance.js'

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
  /** Where the edge of the item the room ends at is: its far edge for a wall on the low side, its near edge on the high side, and for the item whose own ports the room is for, the edge that bounds it. */
  edge: number
  /** Which edge of the item that is: its low one (left or top) or its high one (right or bottom). */
  at: 'low' | 'high'
  /** The item is the one whose ports the room is for, not one beside it. */
  own?: boolean
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
   * How far a line keeps from each side of an obstacle, beyond the white the obstacle is already
   * kept clear by: the room for the lead-outs of the ports on that side, and for a side with no
   * port, nothing.
   */
  margins: Record<Side, number>[]
  /** The item each obstacle is of, which is what a request for room is made of. */
  owners: string[]
  /** The frames, whose edges cut the space, each with its box. */
  frames: { id: FrameId; box: Box }[]
  /**
   * The boxes that make the two ends of a cell along an axis, all of them: the cards and frames
   * whose edge is the cell's end, over any part of the cell's extent. A cut made by a box that is
   * only beside the cell is not a wall.
   */
  wallsOf(cell: Cell, axis: 'x' | 'y'): { lo: Wall[]; hi: Wall[] }
  /** The cell holding a point, or `undefined` outside the drawing and inside a card. */
  cellAt(p: Point): number | undefined
}

/**
 * Cuts the free space of a drawing into cells and the doors between them. A card, kept a white
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
  const { metrics } = problem
  const white = inflate(metrics)

  const ported = portSides(problem, geometry)
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
          x: round(b.x - white),
          y: round(b.y - white),
          width: round(b.width + 2 * white),
          height: round(b.height + 2 * white),
        })
        owners.push(item.id)
        const sides = ported.get(key)
        margins.push({
          top: clearance(metrics, sides?.has('top') ?? false),
          bottom: clearance(metrics, sides?.has('bottom') ?? false),
          left: clearance(metrics, sides?.has('left') ?? false),
          right: clearance(metrics, sides?.has('right') ?? false),
        })
      }
    }
  }
  // The outline of a unit is a drawn plate: what lies between its members, the seams, is no way
  // through, though the members' own ports still lead out past the outline's pad.
  for (const item of problem.items) {
    if (item.kind !== 'unit') continue
    const outline = geometry.boxes.get(item.id)
    const members = (item.members ?? [])
      .flatMap((m) => {
        const b = geometry.boxes.get(m.node.id)
        return b ? [b] : []
      })
      .sort((p, q) => p.x - q.x)
    if (!outline) continue
    for (const [i, left] of members.entries()) {
      const right = members[i + 1]
      if (!right) continue
      const x0 = left.x + left.width
      const x1 = right.x
      if (x1 <= x0) continue
      obstacles.push({
        x: round(x0 - white),
        y: round(outline.y - white),
        width: round(x1 - x0 + 2 * white),
        height: round(outline.height + 2 * white),
      })
      owners.push(item.id)
      margins.push({ top: 0, bottom: 0, left: 0, right: 0 })
    }
  }
  const frames = problem.frames.flatMap((f) => {
    const b = f.id === ROOT ? undefined : geometry.boxes.get(frameKey(f.id))
    return b ? [{ id: f.id, box: b }] : []
  })

  const everything: Box[] = [...obstacles, ...frames.map((f) => f.box)]
  const margin = keepOff(metrics, true) + white
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
        out.push({
          item: owners[k] ?? '',
          edge: side === 'lo' ? e1 - white : e0 + white,
          at: side === 'lo' ? 'high' : 'low',
        })
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
        out.push({
          item: frameKey(f.id),
          edge: side === 'lo' ? e1 : e0,
          at: side === 'lo' ? 'high' : 'low',
        })
      }
    }
    return out
  }
  /**
   * How far a line keeps from the end of a door, and the item that bounds it there: the margin of
   * the side of the card that bounds it, or a white where a frame or the edge of the drawing does.
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
    // Not at a card: at the edge of a frame, which a line keeps a white from and whose place is
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
          margin: white,
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
        const key = joinKey([a, b, frame])
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
    frames,
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

/** An edge of a box as the layout holds it: the low or high edge of an item or frame, and how far the edge meant is from it. */
interface Edge {
  key: string
  at: 'low' | 'high'
  off: number
  /** Where the edge is now, and the stretch of the other axis it covers. */
  coord: number
  from: number
  to: number
}

type Ending = (axis: 'x' | 'y', coord: number, from: number, to: number) => Edge[]

/**
 * The edges of the cards, members, seams and frames that cut the space, each as an edge of a box
 * the layout places (an item's or a frame's; a member's or a seam's is at a distance from its
 * unit's): for an axis, a coordinate and a stretch of the other axis, the edges there that reach it.
 */
function edgeIndex(problem: Problem, geometry: Geometry, space: Space): Ending {
  const white = inflate(problem.metrics)
  const edges: Record<'x' | 'y', Edge[]> = { x: [], y: [] }
  type Rect = { x0: number; y0: number; x1: number; y1: number }
  /** The rectangle `r` as edges of the box `key`: low edges from `low`, high ones from `high`, or from `low` without it. */
  const add = (key: string, r: Rect, low: Box, high?: Box) => {
    const hi = high ? 'high' : 'low'
    const hx = high ? high.x + high.width : low.x
    const hy = high ? high.y + high.height : low.y
    edges.x.push(
      { key, at: 'low', off: r.x0 - low.x, coord: round(r.x0), from: r.y0, to: r.y1 },
      { key, at: hi, off: r.x1 - hx, coord: round(r.x1), from: r.y0, to: r.y1 },
    )
    edges.y.push(
      { key, at: 'low', off: r.y0 - low.y, coord: round(r.y0), from: r.x0, to: r.x1 },
      { key, at: hi, off: r.y1 - hy, coord: round(r.y1), from: r.x0, to: r.x1 },
    )
  }
  const keptClear = (b: Box): Rect => ({
    x0: b.x - white,
    y0: b.y - white,
    x1: b.x + b.width + white,
    y1: b.y + b.height + white,
  })
  for (const item of problem.items) {
    const box = geometry.boxes.get(item.id)
    if (!box) continue
    if (item.kind !== 'unit') {
      add(item.id, keptClear(box), box, box)
      continue
    }
    const members = (item.members ?? []).flatMap((m) => {
      const b = geometry.boxes.get(m.node.id)
      return b ? [b] : []
    })
    for (const m of members) add(item.id, keptClear(m), box)
    const sorted = [...members].sort((p, q) => p.x - q.x)
    for (const [i, l] of sorted.entries()) {
      const r = sorted[i + 1]
      if (!r || r.x <= l.x + l.width) continue
      const seam: Rect = {
        x0: l.x + l.width - white,
        y0: box.y - white,
        x1: r.x + white,
        y1: box.y + box.height + white,
      }
      // Across, a seam's edges are both at a distance from its unit's left edge; along, they are
      // its unit's own top and bottom.
      edges.x.push(
        {
          key: item.id,
          at: 'low',
          off: seam.x0 - box.x,
          coord: round(seam.x0),
          from: seam.y0,
          to: seam.y1,
        },
        {
          key: item.id,
          at: 'low',
          off: seam.x1 - box.x,
          coord: round(seam.x1),
          from: seam.y0,
          to: seam.y1,
        },
      )
      edges.y.push(
        { key: item.id, at: 'low', off: -white, coord: round(seam.y0), from: seam.x0, to: seam.x1 },
        { key: item.id, at: 'high', off: white, coord: round(seam.y1), from: seam.x0, to: seam.x1 },
      )
    }
  }
  for (const f of space.frames) {
    const b = f.box
    add(frameKey(f.id), { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }, b, b)
  }
  const at: Record<'x' | 'y', Map<number, Edge[]>> = { x: new Map(), y: new Map() }
  for (const axis of ['x', 'y'] as const) {
    for (const e of edges[axis]) at[axis].set(e.coord, [...(at[axis].get(e.coord) ?? []), e])
  }
  return (axis, coord, from, to) =>
    (at[axis].get(round(coord)) ?? []).filter((e) => e.from <= to + EPS && e.to >= from - EPS)
}

/**
 * What keeps the cutting of the space as it is while the boxes move: every cell keeps some room
 * between the edges it ends at, along both axes, every door between the edges its ends are at,
 * and edges that end a cell at one place stay at one place (two of them apart would cut it
 * anew). Each is a room between two edges of the boxes the layout places, asked as a `Demand`,
 * of what the room is now or a snap, whichever is less: it keeps the order of the edges, not
 * their distances. Boxes that move within these keep which edge faces which, so the routes and
 * orders settled on the cutting hold; that they do is still checked (`matchCutting`), since a
 * cell may also be cut anew by a box that comes to stand beside it, which these do not see.
 */
export function keepCutting(problem: Problem, geometry: Geometry, space: Space): Demand[] {
  const least = snapOf(problem.metrics)
  const ending = edgeIndex(problem, geometry, space)
  const out = new Map<string, Demand>()
  /** Asks that edge `b` stay at least `room` past edge `a`. */
  const past = (axis: 'x' | 'y', a: Edge, b: Edge, room: number) => {
    if (a.key === b.key && a.at === b.at) return
    const d: Demand = {
      axis,
      before: a.key,
      beforeAt: a.at,
      after: b.key,
      afterAt: b.at,
      min: room + a.off - b.off,
    }
    const k = joinKey([axis, a.key, a.at, b.key, b.at])
    const known = out.get(k)
    if (!known || d.min > known.min) out.set(k, d)
  }
  const keep = (axis: 'x' | 'y', lo: Edge[], hi: Edge[], room: number) => {
    const min = Math.min(room, least)
    for (const a of lo) for (const b of hi) past(axis, a, b, min)
    for (const same of [lo, hi]) {
      const [first, ...rest] = same
      if (!first) continue
      for (const e of rest) {
        past(axis, first, e, 0)
        past(axis, e, first, 0)
      }
    }
  }
  for (const c of space.cells) {
    keep('x', ending('x', c.x0, c.y0, c.y1), ending('x', c.x1, c.y0, c.y1), c.x1 - c.x0)
    keep('y', ending('y', c.y0, c.x0, c.x1), ending('y', c.y1, c.x0, c.x1), c.y1 - c.y0)
  }
  for (const d of space.doors) {
    const [a, b] = [space.cells[d.a], space.cells[d.b]]
    if (!a || !b) continue
    const other = d.normal === 'x' ? 'y' : 'x'
    const [from, to] =
      d.normal === 'x'
        ? [Math.min(a.x0, b.x0), Math.max(a.x1, b.x1)]
        : [Math.min(a.y0, b.y0), Math.max(a.y1, b.y1)]
    keep(other, ending(other, d.lo, from, to), ending(other, d.hi, from, to), d.hi - d.lo)
  }
  return [...out.values()]
}

/** The name of an edge, the same wherever the boxes stand. */
const edgeName = (e: Edge) => `${e.key}:${e.at}:${round(e.off)}`

/**
 * Each cell named by what it ends at: its frame and the edges at each of its four ends (none for
 * the edge of the drawing). Two cuttings that are the same give their cells the same names,
 * whatever numbers the sweep gave them, which follow from heights far off.
 */
export function cellNames(problem: Problem, geometry: Geometry, space: Space): string[] {
  const ending = edgeIndex(problem, geometry, space)
  const names = (es: Edge[]) => es.map(edgeName).sort().join('+')
  return space.cells.map((c) =>
    joinKey([
      c.frame,
      names(ending('x', c.x0, c.y0, c.y1)),
      names(ending('x', c.x1, c.y0, c.y1)),
      names(ending('y', c.y0, c.x0, c.x1)),
      names(ending('y', c.y1, c.x0, c.x1)),
    ]),
  )
}

/** The cell and door of one cutting that is each of another's. */
export interface Matching {
  cell: number[]
  door: number[]
}

/**
 * Whether two cuttings of the space are the same up to where things stand and how the sweep
 * numbered them, and if so which cell and door of `b` is each of `a`'s: the cells match by name
 * (`cellNames`), each name once, and each door of `a` is a door of `b` between the matched cells
 * across the same axis, with no door more.
 */
export function matchCutting(
  a: Space,
  namesA: readonly string[],
  b: Space,
  namesB: readonly string[],
): Matching | undefined {
  if (a.cells.length !== b.cells.length || a.doors.length !== b.doors.length) return undefined
  const byName = new Map<string, number>()
  for (const [i, n] of namesB.entries()) {
    if (byName.has(n)) return undefined
    byName.set(n, i)
  }
  const cell: number[] = []
  for (const n of namesA) {
    const j = byName.get(n)
    if (j === undefined) return undefined
    cell.push(j)
  }
  const doorOf = new Map<string, number>()
  for (const d of b.doors) doorOf.set(joinKey([d.a, d.b, d.normal]), d.id)
  const door: number[] = []
  for (const d of a.doors) {
    const j = doorOf.get(joinKey([cell[d.a] ?? -1, cell[d.b] ?? -1, d.normal]))
    if (j === undefined) return undefined
    door.push(j)
  }
  return { cell, door }
}
