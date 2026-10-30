// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Box, Point } from './metrics.js'
import { boxKey, centre, type PortPlan, simplify } from './ports.js'
import { type End, type FrameId, type Geometry, type Line, type Problem, ROOT } from './problem.js'
import type { Side } from './scene.js'
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
const horizontal = (d: Dir) => d % 2 === 0

const EPS = 1e-6

/**
 * What a route costs, a term each: cells in frames it has no business in, how far it runs
 * sideways through the drawing's content (outside a band), bends, length. The terms are compared
 * in the order of the line's key and never added, so no weight is chosen.
 */
export interface Cost {
  frames: number
  lateral: number
  bends: number
  length: number
}

type Term = keyof Cost
const TERMS: readonly Term[] = ['frames', 'lateral', 'bends', 'length']

/**
 * The order the terms count in. Crossings are not here: the layers after this, which settle the
 * order of lines within a door, are what make them fewer, and a route chosen to dodge a crossing
 * that is only estimated would run far for a crossing that may not be there.
 *
 * A line that places things is short and straight. A line laid over the drawing has a band to
 * reach, and the way up to it is through the content of the drawing: it is charged for running
 * sideways there (in its band it runs sideways freely), so it runs sideways no more than the
 * way up needs.
 */
export const KEY: Record<'oriented' | 'overlay', readonly Term[]> = {
  oriented: ['frames', 'bends', 'length'],
  overlay: ['frames', 'lateral', 'bends', 'length'],
}

/** A place a line starts or ends: a cell, and the point a lead-out from its port. */
export interface Anchor {
  cell: number
  /** The box the port is on: its card, bus or cloud. */
  box: string
  /** The side of the box the port is on. */
  side: Side
  /** The middle of the box, which a line that has to go round to reach it is heading for. */
  hint: Point
  /** The point a lead-out from the port, where the line may first turn. */
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
  /** Lines laid over the drawing that no way to their band was left for, in id order. */
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
 * In a band a line goes sideways freely, so where it leaves is not tied to where it came in: it
 * takes the point nearest `toward`, the middle of the box it is on its way to, so that the way
 * down starts where the way on to its end is shortest.
 */
function advance(
  head: Dir,
  run: readonly [number, number],
  at: Point,
  door: Door,
  exit: Dir,
  toward?: Point,
): { bends: number; run: [number, number]; point: Point } {
  let bends: number
  let next: [number, number] = [door.lo, door.hi]
  if (exit === head) {
    const lo = Math.max(run[0], door.lo)
    const hi = Math.min(run[1], door.hi)
    if (lo <= hi + EPS) {
      bends = 0
      next = [lo, hi]
    } else bends = 2
  } else bends = exit === turnAround(head) ? 2 : 1
  const from = toward
    ? door.normal === 'x'
      ? toward.y
      : toward.x
    : door.normal === 'x'
      ? at.y
      : at.x
  const cross = Math.min(Math.max(from, next[0]), next[1])
  return {
    bends,
    run: next,
    point: door.normal === 'x' ? { x: door.at, y: cross } : { x: cross, y: door.at },
  }
}

/** The terms of a cost as the search keeps them, in the order of `TERMS`. */
type Terms = [frames: number, lateral: number, bends: number, length: number]

const costFrom = (t: readonly number[]): Cost => ({
  frames: t[0] ?? 0,
  lateral: t[1] ?? 0,
  bends: t[2] ?? 0,
  length: t[3] ?? 0,
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
  let run: [number, number] = horizontal(head) ? [at.y, at.y] : [at.x, at.x]
  for (const step of r.steps) {
    const door = doors[step.door] as Door
    const c = cells[cell] as Cell
    const exit = SIDE[c.doors.find((d) => d.door === step.door)?.side ?? 'top']
    const moved = advance(head, run, at, door, exit, cells[cell]?.band ? r.to.hint : undefined)
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
 * may be in, how far it runs sideways outside a band, its bends, its length. The search's own
 * accounting, kept apart so that the two can be held against each other.
 */
export function costOf(
  space: Space,
  r: Pick<GlobalRoute, 'steps' | 'from' | 'to'>,
  allowed: ReadonlySet<FrameId>,
): Cost {
  const { hops, last } = replay(space, r)
  const forbidden = (cell: number) => (allowed.has(space.cells[cell]?.frame ?? ROOT) ? 0 : 1)
  let frames = 0
  let lateral = 0
  let bends = 0
  let length = 0
  let at = r.from.lead
  let run: [number, number] = horizontal(r.from.out) ? [at.y, at.y] : [at.x, at.x]
  let head = r.from.out
  for (const h of hops) {
    frames += forbidden(h.cell)
    const moved = advance(
      head,
      run,
      at,
      h.door,
      h.exit,
      space.cells[h.cell]?.band ? r.to.hint : undefined,
    )
    bends += moved.bends
    length += Math.abs(moved.point.x - at.x) + Math.abs(moved.point.y - at.y)
    if (space.cells[h.cell]?.band === undefined) lateral += Math.abs(moved.point.x - at.x)
    head = h.exit
    at = moved.point
    run = moved.run
  }
  frames += forbidden(last.cell)
  const arrive = turnAround(r.to.out)
  const goal = horizontal(arrive) ? r.to.lead.y : r.to.lead.x
  bends +=
    arrive === head
      ? goal >= run[0] - EPS && goal <= run[1] + EPS
        ? 0
        : 2
      : arrive === turnAround(head)
        ? 2
        : 1
  length += Math.abs(r.to.lead.x - at.x) + Math.abs(r.to.lead.y - at.y)
  if (space.cells[last.cell]?.band === undefined) lateral += Math.abs(r.to.lead.x - at.x)
  return { frames, lateral, bends, length }
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

/**
 * Every place a line may leave or reach a box from: for each of its four sides, each cell that
 * the side's lead-out line runs through, with the port the nearest to the middle of the side that
 * the cell allows. Which side a line uses is for the search to say; the box's own sides are not
 * told it beforehand, since the port is where the line is, not the other way round.
 */
export function anchorsOf(problem: Problem, geometry: Geometry, space: Space, end: End): Anchor[] {
  const { pitch, leadOut } = problem.metrics
  const b = boxOf(geometry, end)
  if (!b) return []
  const found: Anchor[] = []
  for (const side of SIDES) {
    const out = heading[side]
    const across = horizontal(out)
    // The stretch of the side the port may stand on, a pitch in from its corners if it is long enough.
    const [from, length] = across ? [b.y, b.height] : [b.x, b.width]
    const lo = length > 2 * pitch ? from + pitch : from
    const hi = length > 2 * pitch ? from + length - pitch : from + length
    const edge = { top: b.y, bottom: b.y + b.height, left: b.x, right: b.x + b.width }[side]
    const lead = edge + (across ? (DX[out] ?? 0) : (DY[out] ?? 0)) * leadOut
    for (const c of space.cells) {
      if (c.band !== undefined) continue
      const [c0, c1, d0, d1] = across ? [c.y0, c.y1, c.x0, c.x1] : [c.x0, c.x1, c.y0, c.y1]
      if (c0 >= hi - EPS || c1 <= lo + EPS) continue
      if (lead < d0 - EPS || lead > d1 + EPS) continue
      const m = Math.min(Math.max((lo + hi) / 2, Math.max(c0, lo)), Math.min(c1, hi))
      const port = across ? { x: edge, y: m } : { x: m, y: edge }
      found.push({
        cell: c.id,
        box: boxKey(end),
        side,
        hint: centre(b),
        lead: across ? { x: lead, y: m } : { x: m, y: lead },
        port,
        out,
      })
    }
  }
  return found
}

/** Where each line's ends may stand: every side of its two boxes. */
function endsOf(problem: Problem, geometry: Geometry, space: Space): Map<string, Ends> {
  const out = new Map<string, Ends>()
  for (const line of problem.lines) {
    if (line.role === 'inside') continue
    const a = anchorsOf(problem, geometry, space, line.a)
    const b = anchorsOf(problem, geometry, space, line.b)
    if (a.length > 0 && b.length > 0) out.set(line.id, { a, b })
  }
  return out
}

/**
 * The ports the routes settled on: the side of each box a line leaves by is where the search
 * took it, not where the box's neighbours were guessed to be.
 */
export function portsOf(problem: Problem, routes: GlobalRoutes): PortPlan[] {
  const plans: PortPlan[] = []
  for (const line of problem.lines) {
    const r = routes.routes.get(line.id)
    if (!r) continue
    for (const [end, ref, a] of [
      ['a', line.a, r.from],
      ['b', line.b, r.to],
    ] as const) {
      plans.push({ line, end, ref, box: a.box, side: a.side, at: a.port, lead: a.lead })
    }
  }
  return plans
}

/**
 * Routes every line from end to end through the doors of the cells, short ones first, each by
 * the cheapest way under its key (`KEY`): the fewest cells in frames it has no business in,
 * then, for a line laid over the drawing, the least running sideways through the content, then
 * the fewest bends, then the shortest. Lines that place things come before those laid over the
 * drawing. A line may leave or reach a box by any of its sides; the side it takes is the
 * search's result. Those laid over may only cross doors that are not full and go only to their
 * own band; none enters a band that is not its own.
 *
 * The result is a topology: the doors each line passes. Where in a door it passes is the next
 * layers' to decide; the points returned put it at the door's middle.
 */
export function routeGlobal(problem: Problem, geometry: Geometry, space: Space): GlobalRoutes {
  const { cells, doors } = space
  const ends = endsOf(problem, geometry, space)
  /** A state is a door, the way it is crossed, and whether the line has been through its band. */
  const doorStates = doors.length * 4
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
    banded: boolean
    door?: Door
  } => {
    if (s >= doorStates) {
      const a = starts[s - doorStates]
      const at = a?.lead ?? { x: 0, y: 0 }
      const across = a && horizontal(a.out) ? at.y : at.x
      return { cell: a?.cell ?? 0, head: a?.out ?? 0, at, run: [across, across], banded: false }
    }
    const door = doors[s >> 2] as Door
    const forward = ((s >> 1) & 1) === 0
    const head: Dir = door.normal === 'x' ? (forward ? 0 : 2) : forward ? 1 : 3
    return {
      cell: forward ? door.b : door.a,
      head,
      at: { x: px[s] ?? 0, y: py[s] ?? 0 },
      run: [rlo[s] ?? 0, rhi[s] ?? 0],
      banded: (s & 1) === 1,
      door,
    }
  }

  const search = (
    line: Line,
    e: Ends,
    allowed: ReadonlySet<FrameId>,
    capacity: boolean,
  ):
    | { steps: { door: number; into: number }[]; cost: Cost; from: Anchor; to: Anchor }
    | undefined => {
    const starts = e.a.slice(0, 512)
    const hint = e.b[0]?.hint
    const goalsAt = new Map<number, number[]>()
    for (const [i, g] of e.b.entries()) goalsAt.set(g.cell, [...(goalsAt.get(g.cell) ?? []), i])
    const [b0, b1, b2, b3] = best as [Float64Array, Float64Array, Float64Array, Float64Array]
    const key = indexOf(KEY[line.role === 'overlay' ? 'overlay' : 'oriented'])
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
    const wantBand = line.band === undefined ? undefined : space.bands[line.band]
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
          const d = doors[s >> 2] as Door
          steps.push({ door: d.id, into: ((s >> 1) & 1) === 0 ? d.b : d.a })
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
      const across = (p: Point) => (horizontal(here.head) ? p.y : p.x)

      // finishing here, at each end that stands in this cell
      const finishing = capacity && !here.banded ? undefined : goalsAt.get(c.id)
      if (finishing) {
        for (const gi of finishing) {
          const g = e.b[gi] as Anchor
          const arrive = turnAround(g.out)
          const bends =
            arrive === here.head
              ? across(g.lead) >= here.run[0] - EPS && across(g.lead) <= here.run[1] + EPS
                ? 0
                : 2
              : arrive === turnAround(here.head)
                ? 2
                : 1
          const len = Math.abs(g.lead.x - here.at.x) + Math.abs(g.lead.y - here.at.y)
          frontier.push(state, gi, [
            cost[0] + forbidden(c),
            cost[1] + (c.band === undefined ? Math.abs(g.lead.x - here.at.x) : 0),
            cost[2] + bends,
            cost[3] + len,
          ])
        }
      }

      for (const d of c.doors) {
        const door = doors[d.door] as Door
        // Back out of the door just come through is only worth it in a band, which is one cell with
        // one door as wide as the drawing, and where lines go up and down through it.
        if (here.door && door.id === here.door.id && c.band === undefined) continue
        const exitDir = SIDE[d.side]
        const next = cells[d.to] as Cell
        // A band is for the lines laid over the drawing that were given it, and no other's.
        if (next.band !== undefined && next.id !== wantBand) continue
        if (capacity && (used[door.id] ?? 0) + 1 > door.capacity) continue
        const moved = advance(
          here.head,
          here.run,
          here.at,
          door,
          exitDir,
          c.band === undefined ? undefined : hint,
        )
        const mid = moved.point
        const { bends } = moved
        const len = Math.abs(mid.x - here.at.x) + Math.abs(mid.y - here.at.y)
        const nextCost: Terms = [
          cost[0] + forbidden(c),
          cost[1] + (c.band === undefined ? Math.abs(mid.x - here.at.x) : 0),
          cost[2] + bends,
          cost[3] + len,
        ]
        const banded = here.banded || (wantBand !== undefined && next.id === wantBand)
        const at = (door.id * 2 + (c.id === door.a ? 0 : 1)) * 2 + (banded ? 1 : 0)
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

  const route = (line: Line, e: Ends): GlobalRoute | undefined => {
    const found = search(line, e, allowedFrames(problem, line), line.role === 'overlay')
    if (!found) return undefined
    const r: GlobalRoute = {
      line: line.id,
      steps: found.steps,
      cost: found.cost,
      from: found.from,
      to: found.to,
      points: [],
    }
    r.points = draw(r)
    return r
  }

  /**
   * The route as straight runs from port to port. A run keeps to one line wherever the doors it
   * goes through allow it, so a line that can go straight does. A turn is a corner; a jog, or a turn
   * goes sideways through the middle of the cell it is made in. A turn back is made just inside
   * the cell, where the line came in, since going on to the middle only to return is length that
   * nothing asks for.
   */
  const draw = (r: GlobalRoute): Point[] => {
    interface Run {
      head: Dir
      /** The stretch of the line's cross coordinate that suits every door in the run. */
      span: [number, number]
      /** How it follows the run before it; a joint is made in `cell`. */
      kind: 'start' | 'turn' | 'joint'
      cell?: Cell
      /** For a turn back: where the line came into `cell`. */
      back?: Point
    }
    const { hops, last } = replay(space, r)
    const first = r.from.lead
    const start = horizontal(r.from.out) ? first.y : first.x
    const runs: Run[] = [{ head: r.from.out, span: [start, start], kind: 'start' }]
    const follow = (head: Dir, span: [number, number], cell: Cell | undefined, enter: Point) => {
      const cur = runs[runs.length - 1] as Run
      if (head === cur.head) {
        const lo = Math.max(cur.span[0], span[0])
        const hi = Math.min(cur.span[1], span[1])
        if (lo <= hi + EPS) {
          cur.span = [lo, hi]
          return
        }
        runs.push({ head, span, kind: 'joint', ...(cell && { cell }) })
      } else if (head === turnAround(cur.head)) {
        runs.push({ head, span, kind: 'joint', back: enter, ...(cell && { cell }) })
      } else runs.push({ head, span, kind: 'turn' })
    }
    for (const h of hops) follow(h.exit, [h.door.lo, h.door.hi], cells[h.cell], h.enter)
    const arrive = turnAround(r.to.out)
    const goal = horizontal(arrive) ? r.to.lead.y : r.to.lead.x
    follow(arrive, [goal, goal], cells[last.cell], last.enter)

    // Each run's line, as near as its stretch allows to where the run before it began.
    const pts: Point[] = [r.from.port, first]
    let begin = first
    const cross: number[] = [start]
    for (const [i, run] of runs.entries()) {
      if (i === 0) continue
      const before = runs[i - 1] as Run
      const cb = cross[i - 1] ?? 0
      const want = horizontal(run.head) ? begin.y : begin.x
      const c = Math.min(Math.max(want, run.span[0]), run.span[1])
      cross.push(c)
      if (run.kind === 'turn') {
        const corner = horizontal(before.head) ? { x: c, y: cb } : { x: cb, y: c }
        pts.push(corner)
        begin = corner
        continue
      }
      const j = run.cell
      const x = horizontal(before.head)
      const middle = j ? (x ? (j.x0 + j.x1) / 2 : (j.y0 + j.y1) / 2) : 0
      const inside =
        j && run.back ? Math.min(problem.metrics.pitch, Math.abs(middle - (x ? j.x0 : j.y0))) : 0
      const sign = (x ? DX : DY)[before.head] ?? 0
      const mid = run.back ? (x ? run.back.x : run.back.y) + sign * inside : middle
      if (x) {
        pts.push({ x: mid, y: cb }, { x: mid, y: c })
        begin = { x: mid, y: c }
      } else {
        pts.push({ x: cb, y: mid }, { x: c, y: mid })
        begin = { x: c, y: mid }
      }
    }
    pts.push(r.to.lead, r.to.port)
    return simplify(pts)
  }

  /** How far apart a line's boxes are, for the shorter to go first. */
  const reach = (line: Line) => {
    const a = boxOf(geometry, line.a)
    const b = boxOf(geometry, line.b)
    if (!a || !b) return 0
    const [p, q] = [centre(a), centre(b)]
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
  }
  const rank = { oriented: 0, overlay: 1, inside: 2 }
  const order = problem.lines
    .filter((l) => ends.has(l.id))
    .sort((p, q) => rank[p.role] - rank[q.role] || reach(p) - reach(q) || compare(p.id, q.id))

  const routes = new Map<string, GlobalRoute>()
  const unroutable: string[] = []
  // The lines that place things first, and only then, with the room they have left, those laid over
  // the drawing: what is done to the first never depends on the second.
  for (const role of ['oriented', 'overlay'] as const) {
    const lines = order.filter((l) => l.role === role)
    for (const line of lines) {
      const e = ends.get(line.id)
      const r = e && route(line, e)
      if (!r) {
        unroutable.push(line.id)
        continue
      }
      routes.set(line.id, r)
      lay(r, 1)
    }
  }
  return { routes, unroutable, used }
}
