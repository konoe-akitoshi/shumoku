// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Box, Point } from './metrics.js'
import { boxKey, centre, portRoom, portSlots, simplify } from './ports.js'
import { type End, type FrameId, type Geometry, type Line, type Problem, ROOT } from './problem.js'
import type { Side } from './scene.js'
import { sidesOf } from './sides.js'
import type { Cell, Door, Space } from './space.js'

/** Right, down, left, up. */
export type Dir = 0 | 1 | 2 | 3
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]
const heading: Record<Side, Dir> = { right: 0, bottom: 1, left: 2, top: 3 }
export const SIDE: Record<'right' | 'bottom' | 'left' | 'top', Dir> = {
  right: 0,
  bottom: 1,
  left: 2,
  top: 3,
}
export const turnAround = (d: Dir): Dir => ((d + 2) % 4) as Dir
export const horizontal = (d: Dir) => d % 2 === 0

const EPS = 1e-6

/**
 * What a route costs, a term each: cells in frames it has no business in, bends, length. The
 * terms are compared in the order of the key and never added, so no weight is chosen.
 */
export interface Cost {
  frames: number
  /** How many lines already laid it crosses; counted only when asked for (`chords`). */
  crossings: number
  bends: number
  length: number
}

type Term = keyof Cost
const TERMS: readonly Term[] = ['frames', 'bends', 'length', 'crossings']

/**
 * The order the terms count in, for every line alike: it keeps to the frames of its ends, is
 * short and is straight. Crossings are not here: the layers after this, which settle the order of
 * lines within a door, are what make them fewer, and a route chosen to dodge a crossing that is
 * only estimated would run far for a crossing that may not be there.
 */
export const KEY: readonly Term[] = ['frames', 'bends', 'length']

/**
 * The key of a line laid again once the order of the lines at every door is settled, so that the
 * crossings with the others are known and not guessed: they come before bends and length. What
 * comes of it is kept only if the crossings that the order then counts are fewer.
 */
export const KEY_COUNTING: readonly Term[] = ['frames', 'crossings', 'bends', 'length']

/** Where the lines already laid run across a cell, as places along its perimeter (see `along`). */
export type Chords = (cell: number) => readonly { line: string; p: number; q: number }[]

/** A place a line starts or ends: a cell, and the point a lead-out from its port. */
export interface Anchor {
  cell: number
  /** The box the port is on: its card, bus or cloud. */
  box: string
  /** The side of the box the port is on. */
  side: Side
  /**
   * Where along the side a port may stand in this cell: a stretch and not a point, since the port
   * is a result of the solve. A line that can go straight on through a door meets the stretch there.
   */
  span: [number, number]
  /** The point a lead-out from the port at the place the stretch has nearest the middle: an estimate. */
  lead: Point
  port: Point
  /** The way out of the box, which is the way the line leaves. */
  out: Dir
}

export interface GlobalRoute {
  line: string
  /** The doors crossed in order, and the cell each leads into. */
  steps: { door: number; into: number }[]
  cost: Cost
  /** The route as straight runs, port to port, through the middles of the doors. */
  points: Point[]
  /** The straight runs the route is made of (see `skeleton`), which are what the layers after it order and place. */
  runs: Run[]
  from: Anchor
  to: Anchor
}

/** The frames a line may be in without cost: those that hold either of its ends. */
export function allowedFrames(problem: Problem, line: Line): Set<FrameId> {
  const itemOf = new Map(problem.items.map((i) => [i.id, i]))
  const parent = new Map(problem.frames.map((f) => [f.id, f.parent]))
  const allowed = new Set<FrameId>()
  for (const end of [line.a, line.b]) {
    for (
      let f: FrameId | undefined = itemOf.get(end.item)?.frame;
      f !== undefined;
      f = parent.get(f)
    ) {
      allowed.add(f)
    }
  }
  return allowed
}

export interface GlobalRoutes {
  routes: Map<string, GlobalRoute>
  /** Lines that no way was found for, in id order. */
  unroutable: string[]
  /** How many lines cross each door. */
  used: Uint16Array
}

/** The line as two ends, each a box, the side it leaves by and where. */
interface Ends {
  a: Anchor[]
  b: Anchor[]
}

/**
 * Passing through a door. A line that goes straight on keeps the stretch of the door it can
 * still run along (where every door it has gone through since it last turned is open); if there
 * is none it must jog, which is two bends. A turn takes any point of the door. The point is where
 * the line crosses, the nearest the stretch allows to where it was, which is only an estimate of
 * length and crossings: where it really runs is for the layers after this to decide.
 *
 */
function advance(
  head: Dir,
  run: readonly [number, number],
  at: Point,
  door: Door,
  exit: Dir,
): { bends: number; run: [number, number]; point: Point } {
  let bends: number
  let next: [number, number] = door.reach
  if (exit === head) {
    const lo = Math.max(run[0], door.reach[0])
    const hi = Math.min(run[1], door.reach[1])
    if (lo <= hi + EPS) {
      bends = 0
      next = [lo, hi]
    } else bends = 2
  } else bends = exit === turnAround(head) ? 2 : 1
  const from = door.normal === 'x' ? at.y : at.x
  const cross = Math.min(Math.max(from, next[0]), next[1])
  return {
    bends,
    run: next,
    point: door.normal === 'x' ? { x: door.at, y: cross } : { x: cross, y: door.at },
  }
}

/** The terms of a cost as the search keeps them, in the order of `TERMS`. */
type Terms = [frames: number, bends: number, length: number, crossings: number]

const costFrom = (t: readonly number[]): Cost => ({
  frames: t[0] ?? 0,
  bends: t[1] ?? 0,
  length: t[2] ?? 0,
  crossings: t[3] ?? 0,
})
const indexOf = (key: readonly Term[]): number[] => key.map((t) => TERMS.indexOf(t))

/** Compares two costs by `key`, the indexes of the terms that count, most important first. */
function lexical(a: readonly number[], b: readonly number[], key: readonly number[]): number {
  for (const k of key) {
    const v = a[k] ?? 0
    const w = b[k] ?? 0
    if (v !== w) return v - w
  }
  return 0
}

/** Position along the perimeter of a cell, clockwise from its top left corner. */
export function along(c: Cell, side: Dir, p: Point): number {
  const w = c.x1 - c.x0
  const h = c.y1 - c.y0
  switch (side) {
    case 3:
      return p.x - c.x0
    case 0:
      return w + (p.y - c.y0)
    case 1:
      return w + h + (c.x1 - p.x)
    default:
      return 2 * w + h + (c.y1 - p.y)
  }
}

/** Whether chords `p` and `q` come in and go out alternately round a cell. */
export function interleave(a0: number, a1: number, b0: number, b1: number): boolean {
  const [lo, hi] = a0 <= a1 ? [a0, a1] : [a1, a0]
  const inside = (v: number) => v > lo + EPS && v < hi - EPS
  const on = (v: number) => Math.abs(v - lo) <= EPS || Math.abs(v - hi) <= EPS
  if (on(b0) || on(b1)) return false
  return inside(b0) !== inside(b1)
}

/** Whether the stretch a line may still run along and the stretch of a port's side share a place. */
const meets = (run: readonly [number, number], span: readonly [number, number]): boolean =>
  Math.max(run[0], span[0]) <= Math.min(run[1], span[1]) + EPS

/**
 * What a route does in each cell it passes, replayed by the rules the search used: the way it
 * faces going in and out, and where it crosses each door.
 */
export function replay(space: Space, r: Pick<GlobalRoute, 'steps' | 'from' | 'to'>) {
  const { cells, doors } = space
  const hops: { cell: number; head: Dir; enter: Point; exit: Dir; leave: Point; door: Door }[] = []
  let head = r.from.out
  let at = r.from.lead
  let cell = r.from.cell
  let run: [number, number] = [...r.from.span]
  for (const step of r.steps) {
    const door = doors[step.door] as Door
    const c = cells[cell] as Cell
    const exit = SIDE[c.doors.find((d) => d.door === step.door)?.side ?? 'top']
    const moved = advance(head, run, at, door, exit)
    hops.push({ cell, head, enter: at, exit, leave: moved.point, door })
    head = exit
    at = moved.point
    run = moved.run
    cell = step.into
  }
  return { hops, last: { cell, head, enter: at, run } }
}

/**
 * What a route costs, worked out again from the doors it passes: the cells outside the frames it
 * may be in, its bends, its length. The search's own accounting, kept apart so that the two can be
 * held against each other.
 */
export function costOf(
  space: Space,
  r: Pick<GlobalRoute, 'steps' | 'from' | 'to'>,
  allowed: ReadonlySet<FrameId>,
): Cost {
  const { hops, last } = replay(space, r)
  const forbidden = (cell: number) => (allowed.has(space.cells[cell]?.frame ?? ROOT) ? 0 : 1)
  let frames = 0
  let bends = 0
  let length = 0
  let at = r.from.lead
  let run: [number, number] = [...r.from.span]
  let head = r.from.out
  for (const h of hops) {
    frames += forbidden(h.cell)
    const moved = advance(head, run, at, h.door, h.exit)
    bends += moved.bends
    length += Math.abs(moved.point.x - at.x) + Math.abs(moved.point.y - at.y)
    head = h.exit
    at = moved.point
    run = moved.run
  }
  frames += forbidden(last.cell)
  const arrive = turnAround(r.to.out)
  bends += arrive === head ? (meets(run, r.to.span) ? 0 : 2) : arrive === turnAround(head) ? 2 : 1
  length += Math.abs(r.to.lead.x - at.x) + Math.abs(r.to.lead.y - at.y)
  return { frames, crossings: 0, bends, length }
}

/**
 * A straight run of a route: the stretch that keeps one heading. A run is reached from the one
 * before it by a turn, or by a joint, which is a short run across (two bends) that moves the line
 * sideways, or turns it back, when the doors the runs pass cannot be met on one line.
 */
export interface Run {
  head: Dir
  /** Where across its heading the run may lie to pass every door that it goes through. */
  span: [number, number]
  kind: 'start' | 'turn' | 'joint'
  /** For a joint: the cell it is made in. */
  cell?: Cell
  /** For a turn back: where the line came into `cell`. */
  back?: Point
  /** The steps of the route (indexes into `steps`) whose door the run goes through. */
  hops: number[]
  /** The cells the run lies in. */
  cells: number[]
  /** Where the estimate puts it across its heading, and, for a joint, where along the heading before. */
  at: number
  mid?: number
  /** The extent the estimate gives it along its heading. */
  from: number
  to: number
}

/**
 * The route as straight runs from port to port, and the estimate of the line they make. A run
 * keeps to one line wherever the doors it goes through allow it, so a line that can go straight
 * does. A turn is a corner; a joint goes sideways through the middle of the cell it is made in. A
 * turn back is made just inside the cell, where the line came in, since going on to the middle only
 * to return is length that nothing asks for.
 */
export function skeleton(
  space: Space,
  pitch: number,
  r: Pick<GlobalRoute, 'steps' | 'from' | 'to'>,
): { runs: Run[]; points: Point[] } {
  const { cells } = space
  const { hops, last } = replay(space, r)
  const sequence = [r.from.cell, ...r.steps.map((s) => s.into)]
  const first = r.from.lead
  const start = horizontal(r.from.out) ? first.y : first.x
  const runs: Run[] = [
    {
      head: r.from.out,
      span: [...r.from.span],
      kind: 'start',
      hops: [],
      cells: [r.from.cell],
      at: start,
      from: 0,
      to: 0,
    },
  ]
  const follow = (
    head: Dir,
    span: [number, number],
    cell: Cell | undefined,
    enter: Point,
    hop?: number,
  ) => {
    const cur = runs[runs.length - 1] as Run
    const into = hop === undefined ? [] : [sequence[hop] ?? 0, sequence[hop + 1] ?? 0]
    const hopList = hop === undefined ? [] : [hop]
    const base = { head, span, hops: hopList, cells: into, at: 0, from: 0, to: 0 }
    if (head === cur.head) {
      const lo = Math.max(cur.span[0], span[0])
      const hi = Math.min(cur.span[1], span[1])
      if (lo <= hi + EPS) {
        cur.span = [lo, hi]
        cur.hops.push(...hopList)
        for (const c of into) if (!cur.cells.includes(c)) cur.cells.push(c)
        return
      }
      runs.push({ ...base, kind: 'joint', ...(cell && { cell }) })
    } else if (head === turnAround(cur.head)) {
      runs.push({ ...base, kind: 'joint', back: enter, ...(cell && { cell }) })
    } else runs.push({ ...base, kind: 'turn' })
  }
  for (const [h, hop] of hops.entries()) {
    follow(hop.exit, [...hop.door.reach], cells[hop.cell], hop.enter, h)
  }
  const arrive = turnAround(r.to.out)
  follow(arrive, [...r.to.span], cells[last.cell], last.enter)
  const tail = runs[runs.length - 1] as Run
  if (!tail.cells.includes(last.cell)) tail.cells.push(last.cell)

  // Each run's line, as near as its stretch allows to where the run before it began. The ports
  // stand where the first and last run do, which is within the stretch of their side.
  const extent = (p: Point, run: Run) => (horizontal(run.head) ? p.x : p.y)
  const into = (p: Point, run: Run, v: number): Point =>
    horizontal(run.head) ? { x: p.x, y: v } : { x: v, y: p.y }
  const at0 = Math.min(Math.max(start, (runs[0] as Run).span[0]), (runs[0] as Run).span[1])
  const port0 = into(r.from.port, runs[0] as Run, at0)
  const first0 = into(first, runs[0] as Run, at0)
  const pts: Point[] = [port0, first0]
  let begin = first0
  const cross: number[] = [at0]
  runs[0] = { ...(runs[0] as Run), at: at0, from: extent(port0, runs[0] as Run) }
  for (const [i, run] of runs.entries()) {
    if (i === 0) continue
    const before = runs[i - 1] as Run
    const cb = cross[i - 1] ?? 0
    const want = horizontal(run.head) ? begin.y : begin.x
    const c = Math.min(Math.max(want, run.span[0]), run.span[1])
    cross.push(c)
    run.at = c
    if (run.kind === 'turn') {
      const corner = horizontal(before.head) ? { x: c, y: cb } : { x: cb, y: c }
      pts.push(corner)
      begin = corner
      run.from = extent(corner, run)
      before.to = extent(corner, before)
      continue
    }
    const j = run.cell
    const x = horizontal(before.head)
    const middle = j ? (x ? (j.x0 + j.x1) / 2 : (j.y0 + j.y1) / 2) : 0
    const inside = j && run.back ? Math.min(pitch, Math.abs(middle - (x ? j.x0 : j.y0))) : 0
    const sign = (x ? DX : DY)[before.head] ?? 0
    const mid = run.back ? (x ? run.back.x : run.back.y) + sign * inside : middle
    run.mid = mid
    if (x) {
      pts.push({ x: mid, y: cb }, { x: mid, y: c })
      begin = { x: mid, y: c }
    } else {
      pts.push({ x: cb, y: mid }, { x: c, y: mid })
      begin = { x: c, y: mid }
    }
    run.from = mid
    before.to = mid
  }
  const end = runs[runs.length - 1] as Run
  const atEnd = cross[cross.length - 1] ?? 0
  const port1 = into(r.to.port, end, atEnd)
  pts.push(into(r.to.lead, end, atEnd), port1)
  end.to = extent(port1, end)
  return { runs, points: simplify(pts) }
}

/** A binary heap of what the search has found, ordered by what it cost under a key. */
class Frontier {
  state: number[] = []
  /** The anchor a finished route ends at, or -1 for a step along the way. */
  goal: number[] = []
  /** Four terms for each entry, in the order of `TERMS`. */
  cost: number[] = []
  private heap: number[] = []
  private key: readonly number[] = []
  get size() {
    return this.heap.length
  }
  clear(key: readonly number[]) {
    this.state.length = 0
    this.goal.length = 0
    this.cost.length = 0
    this.heap.length = 0
    this.key = key
  }
  termsAt(id: number): Terms {
    return [
      this.cost[4 * id] ?? 0,
      this.cost[4 * id + 1] ?? 0,
      this.cost[4 * id + 2] ?? 0,
      this.cost[4 * id + 3] ?? 0,
    ]
  }
  private less(i: number, j: number): boolean {
    for (const k of this.key) {
      const v = this.cost[4 * i + k] ?? 0
      const w = this.cost[4 * j + k] ?? 0
      if (v !== w) return v < w
    }
    return false
  }
  push(state: number, goal: number, cost: Terms) {
    const id = this.state.length
    this.state.push(state)
    this.goal.push(goal)
    this.cost.push(...cost)
    const h = this.heap
    h.push(id)
    let i = h.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      const up = h[p] ?? 0
      if (!this.less(id, up)) break
      h[i] = up
      i = p
    }
    h[i] = id
  }
  pop(): number | undefined {
    const h = this.heap
    const top = h[0]
    const end = h.pop()
    if (top === undefined || end === undefined || h.length === 0) return top
    let i = 0
    for (;;) {
      const l = 2 * i + 1
      if (l >= h.length) break
      let m = l
      if (l + 1 < h.length && this.less(h[l + 1] ?? 0, h[l] ?? 0)) m = l + 1
      if (!this.less(h[m] ?? 0, end)) break
      h[i] = h[m] ?? 0
      i = m
    }
    h[i] = end
    return top
  }
}

/** The box an end is on: its card, bus or cloud, or the member of a unit. */
function boxOf(geometry: Geometry, end: End): Box | undefined {
  return geometry.boxes.get(boxKey(end)) ?? geometry.boxes.get(end.item)
}

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left']

/** What two ends of lines share when they name the same port of a box. */
const portKey = (end: End): string | undefined =>
  end.port === undefined ? undefined : `${boxKey(end)}\0${end.port}`

/**
 * Every place a line may leave or reach a box from: for each of the sides it may use (`sidesOf`),
 * each cell that the side's lead-out line runs through. The port is not a point: the stretch of the
 * side that the cell allows is kept (`span`), so that a line that can meet it going straight on is
 * counted straight. Which side of those a line uses is for the search to say, when the relation of
 * its ends leaves it more than one.
 */
export function anchorsOf(
  problem: Problem,
  geometry: Geometry,
  space: Space,
  end: End,
  sides: readonly Side[] = SIDES,
  slot: number = problem.metrics.portSlot([end.port]),
): Anchor[] {
  const { leadOut } = problem.metrics
  const b = boxOf(geometry, end)
  if (!b) return []
  const found: Anchor[] = []
  for (const side of sides) {
    const out = heading[side]
    const across = horizontal(out)
    // The stretch of the side the port may stand on: the room a port takes along it, half in from
    // each corner, or the middle if the side is too short for that (see `portRoom`).
    const { lo, hi } = portRoom(b, side, slot)
    const edge = { top: b.y, bottom: b.y + b.height, left: b.x, right: b.x + b.width }[side]
    const lead = edge + (across ? (DX[out] ?? 0) : (DY[out] ?? 0)) * leadOut
    const forward = out === 0 || out === 1
    for (const c of space.cells) {
      const [c0, c1, d0, d1] = across ? [c.y0, c.y1, c.x0, c.x1] : [c.x0, c.x1, c.y0, c.y1]
      if (c0 >= hi - EPS || c1 <= lo + EPS) continue
      if (lead < d0 - EPS || lead > d1 + EPS) continue
      // The first turn is a lead-out from the box or further: a cell that ends where the lead-out
      // does, which the point is on the edge of, has no room for it.
      if (forward ? d1 <= lead + EPS : d0 >= lead - EPS) continue
      const m = Math.min(Math.max((lo + hi) / 2, Math.max(c0, lo)), Math.min(c1, hi))
      const port = across ? { x: edge, y: m } : { x: m, y: edge }
      found.push({
        cell: c.id,
        box: boxKey(end),
        side,
        span: [Math.max(c0, lo), Math.min(c1, hi)],
        lead: across ? { x: lead, y: m } : { x: m, y: lead },
        port,
        out,
      })
    }
  }
  return found
}

/** Where each line's ends may stand: the sides its relation gives it (`sidesOf`). */
function endsOf(problem: Problem, geometry: Geometry, space: Space): Map<string, Ends> {
  const ends = new Map<string, Ends>()
  const slots = portSlots(problem)
  for (const line of problem.lines) {
    const sides = sidesOf(line)
    if (!sides) continue
    const a = anchorsOf(problem, geometry, space, line.a, sides.a, slots.get(boxKey(line.a)))
    const b = anchorsOf(problem, geometry, space, line.b, sides.b, slots.get(boxKey(line.b)))
    if (a.length > 0 && b.length > 0) ends.set(line.id, { a, b })
  }
  return ends
}

/**
 * Routes every line from end to end through the doors of the cells, short ones first, each by
 * the cheapest way under its key (`KEY`): the fewest cells in frames it has no business in, then
 * the fewest bends, then the shortest. Lines that place things come before those that do not. A
 * line leaves and reaches its boxes by the sides that the relation of its ends gives it
 * (`sidesOf`): down a flow, a line goes out of the bottom of the upper box and into the top of the
 * lower, and a line between equals goes by their sides. A line whose ends the structure does not
 * relate is no different in the search; it has only the lines that place things to find its way
 * between.
 *
 * The result is a topology: the doors each line passes. Where in a door it passes is the next
 * layers' to decide; the points returned put it at the door's middle.
 */
export function routeGlobal(problem: Problem, geometry: Geometry, space: Space): GlobalRoutes {
  return createRouter(problem, geometry, space).result
}

/** The routes, and what is needed to lay a line again after them. */
export function createRouter(problem: Problem, geometry: Geometry, space: Space) {
  const { cells, doors } = space
  const ends = endsOf(problem, geometry, space)
  /** A state is a door and the way it is crossed. */
  const doorStates = doors.length * 2
  const stamp = new Int32Array(doorStates + 512)
  const best = [0, 1, 2, 3].map(() => new Float64Array(doorStates + 512))
  const parent = new Int32Array(doorStates + 512)
  /** Where each state crosses its door, which depends on the way it came. */
  const px = new Float64Array(doorStates + 512)
  const py = new Float64Array(doorStates + 512)
  /** The stretch of the door a line that goes straight on may still run along. */
  const rlo = new Float64Array(doorStates + 512)
  const rhi = new Float64Array(doorStates + 512)
  let attempt = 0
  const frontier = new Frontier()
  const used = new Uint16Array(doors.length)

  /** The way a state is entered: the cell, the way it faces, and the point it came in at. */
  const stateOf = (
    s: number,
    starts: readonly Anchor[],
  ): {
    cell: number
    head: Dir
    at: Point
    run: [number, number]
    door?: Door
  } => {
    if (s >= doorStates) {
      const a = starts[s - doorStates]
      const at = a?.lead ?? { x: 0, y: 0 }
      return {
        cell: a?.cell ?? 0,
        head: a?.out ?? 0,
        at,
        run: [...(a?.span ?? [0, 0])],
      }
    }
    const door = doors[s >> 1] as Door
    const forward = (s & 1) === 0
    const head: Dir = door.normal === 'x' ? (forward ? 0 : 2) : forward ? 1 : 3
    return {
      cell: forward ? door.b : door.a,
      head,
      at: { x: px[s] ?? 0, y: py[s] ?? 0 },
      run: [rlo[s] ?? 0, rhi[s] ?? 0],
      door,
    }
  }

  const search = (
    line: Line,
    e: Ends,
    allowed: ReadonlySet<FrameId>,
    terms: readonly Term[],
    chords?: Chords,
  ):
    | { steps: { door: number; into: number }[]; cost: Cost; from: Anchor; to: Anchor }
    | undefined => {
    const starts = e.a.slice(0, 512)
    const goalsAt = new Map<number, number[]>()
    for (const [i, g] of e.b.entries()) goalsAt.set(g.cell, [...(goalsAt.get(g.cell) ?? []), i])
    const [b0, b1, b2, b3] = best as [Float64Array, Float64Array, Float64Array, Float64Array]
    const key = indexOf(terms)
    attempt++
    frontier.clear(key)
    for (const i of starts.keys()) {
      const id = doorStates + i
      stamp[id] = attempt
      b0[id] = 0
      b1[id] = 0
      b2[id] = 0
      b3[id] = 0
      parent[id] = -1
      frontier.push(id, -1, [0, 0, 0, 0])
    }
    const forbidden = (c: Cell) => (allowed.has(c.frame) ? 0 : 1)
    while (frontier.size > 0) {
      const id = frontier.pop()
      if (id === undefined) break
      const state = frontier.state[id] ?? 0
      const cost = frontier.termsAt(id)
      const goal = frontier.goal[id] ?? -1
      if (goal >= 0) {
        const steps: { door: number; into: number }[] = []
        let s = state
        for (; s >= 0 && s < doorStates; s = parent[s] ?? -1) {
          const d = doors[s >> 1] as Door
          steps.push({ door: d.id, into: (s & 1) === 0 ? d.b : d.a })
        }
        steps.reverse()
        const a = starts[s - doorStates]
        const to = e.b[goal]
        if (!a || !to) return undefined
        return { steps, cost: costFrom(cost), from: a, to }
      }
      if (
        stamp[state] === attempt &&
        lexical([b0[state] ?? 0, b1[state] ?? 0, b2[state] ?? 0, b3[state] ?? 0], cost, key) < 0
      ) {
        continue
      }
      const here = stateOf(state, starts)
      const c = cells[here.cell] as Cell
      const entry = chords ? along(c, turnAround(here.head), here.at) : 0
      /** The lines already laid that a chord across this cell crosses. */
      const crossed = (exit: number) => {
        let n = 0
        for (const o of chords?.(c.id) ?? []) {
          if (o.line !== line.id && interleave(entry, exit, o.p, o.q)) n++
        }
        return n
      }

      // finishing here, at each end that stands in this cell
      const finishing = goalsAt.get(c.id)
      if (finishing) {
        for (const gi of finishing) {
          const g = e.b[gi] as Anchor
          const arrive = turnAround(g.out)
          const bends =
            arrive === here.head
              ? meets(here.run, g.span)
                ? 0
                : 2
              : arrive === turnAround(here.head)
                ? 2
                : 1
          const len = Math.abs(g.lead.x - here.at.x) + Math.abs(g.lead.y - here.at.y)
          frontier.push(state, gi, [
            cost[0] + forbidden(c),
            cost[1] + bends,
            cost[2] + len,
            cost[3] + (chords ? crossed(along(c, arrive, g.lead)) : 0),
          ])
        }
      }

      for (const d of c.doors) {
        const door = doors[d.door] as Door
        // Back out of the door just come through is never worth it.
        if (here.door && door.id === here.door.id) continue
        const exitDir = SIDE[d.side]
        const moved = advance(here.head, here.run, here.at, door, exitDir)
        const mid = moved.point
        const { bends } = moved
        const len = Math.abs(mid.x - here.at.x) + Math.abs(mid.y - here.at.y)
        const nextCost: Terms = [
          cost[0] + forbidden(c),
          cost[1] + bends,
          cost[2] + len,
          cost[3] + (chords ? crossed(along(c, exitDir, mid)) : 0),
        ]
        const at = door.id * 2 + (c.id === door.a ? 0 : 1)
        if (
          stamp[at] === attempt &&
          lexical([b0[at] ?? 0, b1[at] ?? 0, b2[at] ?? 0, b3[at] ?? 0], nextCost, key) <= 0
        ) {
          continue
        }
        stamp[at] = attempt
        b0[at] = nextCost[0]
        b1[at] = nextCost[1]
        b2[at] = nextCost[2]
        b3[at] = nextCost[3]
        parent[at] = state
        px[at] = mid.x
        py[at] = mid.y
        rlo[at] = moved.run[0]
        rhi[at] = moved.run[1]
        frontier.push(at, -1, nextCost)
      }
    }
    return undefined
  }

  const lay = (r: GlobalRoute, by: 1 | -1) => {
    for (const s of r.steps) used[s.door] = (used[s.door] ?? 0) + by
  }

  const route = (
    line: Line,
    e: Ends,
    terms: readonly Term[],
    chords?: Chords,
  ): GlobalRoute | undefined => {
    const found = search(line, e, allowedFrames(problem, line), terms, chords)
    if (!found) return undefined
    const r: GlobalRoute = {
      line: line.id,
      steps: found.steps,
      cost: found.cost,
      from: found.from,
      to: found.to,
      points: [],
      runs: [],
    }
    const drawn = skeleton(space, problem.metrics.pitch, r)
    r.points = drawn.points
    r.runs = drawn.runs
    return r
  }

  /** How far apart a line's boxes are, for the shorter to go first. */
  const reach = (line: Line) => {
    const a = boxOf(geometry, line.a)
    const b = boxOf(geometry, line.b)
    if (!a || !b) return 0
    const [p, q] = [centre(a), centre(b)]
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
  }
  const rank = { oriented: 0, unrelated: 1, inside: 2 }
  const order = problem.lines
    .filter((l) => ends.has(l.id))
    .sort((p, q) => rank[p.role] - rank[q.role] || reach(p) - reach(q) || compare(p.id, q.id))

  const routes = new Map<string, GlobalRoute>()
  const unroutable: string[] = []
  // The lines that place things first, and only then, with the room they have left, those that
  // do not: what is done to the first never depends on the second.
  for (const role of ['oriented', 'unrelated'] as const) {
    const lines = order.filter((l) => l.role === role)
    for (const line of lines) {
      const e = ends.get(line.id)
      const r = e && route(line, e, KEY)
      if (!r) {
        unroutable.push(line.id)
        continue
      }
      routes.set(line.id, r)
      lay(r, 1)
    }
  }
  // The lines that name one port of a box meet at one point of one side. Each end chose its own
  // way out, so the ends that did not take the way most of them took are laid again from there.
  const named = new Map<string, { line: Line; end: 'a' | 'b' }[]>()
  for (const line of order) {
    if (!routes.has(line.id)) continue
    for (const end of ['a', 'b'] as const) {
      const key = portKey(line[end])
      if (key !== undefined) named.set(key, [...(named.get(key) ?? []), { line, end }])
    }
  }
  const sideRank = new Map(SIDES.map((s, i) => [s, i]))
  const anchorOf = (r: GlobalRoute, end: 'a' | 'b') => (end === 'a' ? r.from : r.to)
  for (const members of named.values()) {
    if (members.length < 2) continue
    const count = new Map<string, { n: number; side: Side; cell: number }>()
    for (const m of members) {
      const a = anchorOf(routes.get(m.line.id) as GlobalRoute, m.end)
      const k = `${a.side}\0${a.cell}`
      count.set(k, { n: (count.get(k)?.n ?? 0) + 1, side: a.side, cell: a.cell })
    }
    const [best] = [...count.values()].sort(
      (p, q) =>
        q.n - p.n || (sideRank.get(p.side) ?? 0) - (sideRank.get(q.side) ?? 0) || p.cell - q.cell,
    )
    for (const m of members) {
      const old = routes.get(m.line.id) as GlobalRoute
      const a = anchorOf(old, m.end)
      const e = ends.get(m.line.id)
      if (!best || !e || (a.side === best.side && a.cell === best.cell)) continue
      const only = e[m.end].filter((x) => x.side === best.side && x.cell === best.cell)
      if (only.length === 0) continue
      // The other end keeps the way out it has: it may be a named port that was settled already.
      const other = m.end === 'a' ? 'b' : 'a'
      const kept = anchorOf(old, other)
      const stay = e[other].filter((x) => x.side === kept.side && x.cell === kept.cell)
      lay(old, -1)
      const r = route(
        m.line,
        { ...e, [m.end]: only, [other]: stay.length > 0 ? stay : e[other] },
        KEY,
      )
      if (r) {
        routes.set(m.line.id, r)
        lay(r, 1)
      } else lay(old, 1)
    }
  }
  const result: GlobalRoutes = { routes, unroutable, used }
  /**
   * Lays the given ends again with the first run of each given no stretch, so that the line moves
   * sideways in its first cell (a joint) and the port is free of the doors: for an end whose window
   * (the stretch the doors leave its first run) has no room for its port among the others of its
   * side, in the order they are given. Which ends those are is the order layer's to say. The other
   * end of each line keeps the way out it has. Gives the ends that were laid again.
   */
  const loosen = (which: readonly { line: string; end: 'a' | 'b' }[]): string[] => {
    const done: string[] = []
    for (const { line: id, end } of which) {
      const old = routes.get(id)
      const line = problem.lines.find((l) => l.id === id)
      const e = ends.get(id)
      if (!old || !line || !e) continue
      const a = anchorOf(old, end)
      if (a.span[0] > a.span[1] + EPS) continue
      const p = horizontal(a.out) ? a.lead.y : a.lead.x
      const loose = e[end]
        .filter((x) => x.side === a.side && x.cell === a.cell)
        .map(
          (x): Anchor => ({ ...x, span: [p + problem.metrics.pitch, p - problem.metrics.pitch] }),
        )
      if (loose.length === 0) continue
      const other = end === 'a' ? 'b' : 'a'
      const kept = anchorOf(old, other)
      const stay = e[other].filter((x) => x.side === kept.side && x.cell === kept.cell)
      lay(old, -1)
      const r = route(line, { ...e, [end]: loose, [other]: stay.length > 0 ? stay : e[other] }, KEY)
      if (r) {
        routes.set(id, r)
        lay(r, 1)
        done.push(`${id}.${end}`)
      } else lay(old, 1)
    }
    return done
  }
  return {
    result,
    lay,
    loosen,
    /**
     * The line laid again, its key given the crossings of the lines already laid (`chords`, where
     * each crosses each cell) after what it costs in frames. The line's old route is to be taken out first (`lay(old, -1)`); the new one is
     * the caller's to keep or not.
     */
    reroute(line: Line, chords: Chords): GlobalRoute | undefined {
      const e = ends.get(line.id)
      return e && route(line, e, KEY_COUNTING, chords)
    },
  }
}
