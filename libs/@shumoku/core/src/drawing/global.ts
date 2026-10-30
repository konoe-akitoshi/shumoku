// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Box, Point } from './metrics.js'
import { boxKey, type PortPlan, simplify } from './ports.js'
import {
  type Band,
  type End,
  type FrameId,
  type Geometry,
  type Line,
  type Problem,
  ROOT,
} from './problem.js'
import type { Side } from './scene.js'
import type { Cell, Door, Space } from './space.js'

/** Right, down, left, up. */
type Dir = 0 | 1 | 2 | 3
const DY = [0, 1, 0, -1]
const heading: Record<Side, Dir> = { right: 0, bottom: 1, left: 2, top: 3 }
const SIDE: Record<'right' | 'bottom' | 'left' | 'top', Dir> = {
  right: 0,
  bottom: 1,
  left: 2,
  top: 3,
}
const turnAround = (d: Dir): Dir => ((d + 2) % 4) as Dir
const horizontal = (d: Dir) => d % 2 === 0

const EPS = 1e-6

/**
 * What a route costs, most important first: cells in frames it has no business in, crossings
 * of lines already laid, bends, length. They are compared in that order and never added, so no
 * weight is chosen.
 */
export type Cost = [frames: number, crossings: number, bends: number, length: number]

/** A place a line starts or ends: a cell, and the point a lead-out from its port. */
interface Anchor {
  cell: number
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

/** A chord across a cell: where a line comes in and goes out along the cell's perimeter. */
interface Chord {
  line: string
  p: number
  q: number
}

/**
 * Passing through a door. A line that goes straight on keeps the stretch of the door it can
 * still run along (where every door it has gone through since it last turned is open); if there
 * is none it must jog, which is two bends. A turn takes any point of the door. The point is where
 * the line crosses, the nearest the stretch allows to where it was, which is only an estimate of
 * length and crossings: where it really runs is for the layers after this to decide.
 */
function advance(
  head: Dir,
  run: readonly [number, number],
  at: Point,
  door: Door,
  exit: Dir,
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
  const from = door.normal === 'x' ? at.y : at.x
  const cross = Math.min(Math.max(from, next[0]), next[1])
  return {
    bends,
    run: next,
    point: door.normal === 'x' ? { x: door.at, y: cross } : { x: cross, y: door.at },
  }
}

function lexical(a: readonly number[], b: readonly number[]): number {
  for (const [i, v] of a.entries()) {
    const w = b[i] ?? 0
    if (v !== w) return v - w
  }
  return 0
}

/** Position along the perimeter of a cell, clockwise from its top left corner. */
function along(c: Cell, side: Dir, p: Point): number {
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
function interleave(a0: number, a1: number, b0: number, b1: number): boolean {
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
function replay(space: Space, r: Pick<GlobalRoute, 'steps' | 'from'>) {
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
 * What a route costs apart from its crossings, worked out again from the doors it passes: the
 * cells outside the frames it may be in, its bends, its length. The search's own accounting, kept
 * apart so that the two can be held against each other.
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
  let run: [number, number] = horizontal(r.from.out) ? [at.y, at.y] : [at.x, at.x]
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
  return [frames, 0, bends, length]
}

/** A binary heap of what the search has found, ordered by what it cost. */
class Frontier {
  state: number[] = []
  /** The anchor a finished route ends at, or -1 for a step along the way. */
  goal: number[] = []
  c0: number[] = []
  c1: number[] = []
  c2: number[] = []
  c3: number[] = []
  private heap: number[] = []
  get size() {
    return this.heap.length
  }
  clear() {
    this.state.length = 0
    this.goal.length = 0
    this.c0.length = 0
    this.c1.length = 0
    this.c2.length = 0
    this.c3.length = 0
    this.heap.length = 0
  }
  private less(i: number, j: number): boolean {
    if (this.c0[i] !== this.c0[j]) return (this.c0[i] ?? 0) < (this.c0[j] ?? 0)
    if (this.c1[i] !== this.c1[j]) return (this.c1[i] ?? 0) < (this.c1[j] ?? 0)
    if (this.c2[i] !== this.c2[j]) return (this.c2[i] ?? 0) < (this.c2[j] ?? 0)
    return (this.c3[i] ?? 0) < (this.c3[j] ?? 0)
  }
  push(state: number, goal: number, cost: Cost) {
    const id = this.state.length
    this.state.push(state)
    this.goal.push(goal)
    this.c0.push(cost[0])
    this.c1.push(cost[1])
    this.c2.push(cost[2])
    this.c3.push(cost[3])
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

/**
 * Where each line's ends stand, and which cells they may start from. A line between cards
 * leaves by the sides its port was given. A line laid over the drawing leaves by the side of its
 * band, wherever along the card's edge a way up is open, so each cell the edge touches is a place
 * it may start.
 */
function endsOf(
  problem: Problem,
  geometry: Geometry,
  plans: readonly PortPlan[],
  space: Space,
): Map<string, Ends> {
  const { pitch, leadOut } = problem.metrics
  const byLine = new Map<string, { a?: PortPlan; b?: PortPlan }>()
  for (const p of plans) {
    const e = byLine.get(p.line.id) ?? {}
    byLine.set(p.line.id, p.end === 'a' ? { ...e, a: p } : { ...e, b: p })
  }
  const boxOf = (end: End): Box | undefined =>
    geometry.boxes.get(boxKey(end)) ?? geometry.boxes.get(end.item)

  const anchor = (plan: PortPlan): Anchor[] => {
    const cell = space.cellAt(plan.lead)
    return cell === undefined
      ? []
      : [{ cell, lead: plan.lead, port: plan.at, out: heading[plan.side] }]
  }
  const along = (end: End, band: Band): Anchor[] => {
    const b = boxOf(end)
    if (!b) return []
    const out: Dir = band === 'top' ? 3 : 1
    const y = band === 'top' ? b.y : b.y + b.height
    const lo = b.width > 2 * pitch ? b.x + pitch : b.x
    const hi = b.width > 2 * pitch ? b.x + b.width - pitch : b.x + b.width
    const lead = y + (DY[out] ?? 0) * leadOut
    const found: Anchor[] = []
    for (const c of space.cells) {
      if (c.band !== undefined || c.x0 >= hi - EPS || c.x1 <= lo + EPS) continue
      if (lead < c.y0 - EPS || lead > c.y1 + EPS) continue
      const x = Math.min(Math.max((lo + hi) / 2, Math.max(c.x0, lo)), Math.min(c.x1, hi))
      found.push({ cell: c.id, lead: { x, y: lead }, port: { x, y }, out })
    }
    return found
  }

  const out = new Map<string, Ends>()
  for (const line of problem.lines) {
    if (line.role === 'inside') continue
    const e = byLine.get(line.id)
    if (!e?.a || !e.b) continue
    if (line.role === 'overlay' && line.band) {
      out.set(line.id, { a: along(line.a, line.band), b: along(line.b, line.band) })
    } else {
      out.set(line.id, { a: anchor(e.a), b: anchor(e.b) })
    }
  }
  return out
}

/**
 * Routes every line from end to end through the doors of the cells, short ones first, each by
 * the cheapest way: fewest cells in frames it has no business in, then fewest crossings of lines
 * already laid, then fewest bends, then shortest. Lines that place things come before those laid
 * over the drawing. Those may only run up (or down) to their band through the doors, cross no door
 * that is full, and run sideways only inside the band, or at once on leaving or reaching a card.
 *
 * The result is a topology: the doors each line passes. Where in a door it passes is the next
 * layers' to decide; the points returned put it at the door's middle.
 */
export function routeGlobal(
  problem: Problem,
  geometry: Geometry,
  plans: readonly PortPlan[],
  space: Space,
  refine = true,
): GlobalRoutes {
  const { cells, doors } = space
  const ends = endsOf(problem, geometry, plans, space)
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
  const chords: Chord[][] = cells.map(() => [])

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
    const goalsAt = new Map<number, number[]>()
    for (const [i, g] of e.b.entries()) goalsAt.set(g.cell, [...(goalsAt.get(g.cell) ?? []), i])
    const [b0, b1, b2, b3] = best as [Float64Array, Float64Array, Float64Array, Float64Array]
    attempt++
    frontier.clear()
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
      const cost: Cost = [
        frontier.c0[id] ?? 0,
        frontier.c1[id] ?? 0,
        frontier.c2[id] ?? 0,
        frontier.c3[id] ?? 0,
      ]
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
        return { steps, cost, from: a, to }
      }
      if (
        stamp[state] === attempt &&
        lexical([b0[state] ?? 0, b1[state] ?? 0, b2[state] ?? 0, b3[state] ?? 0], cost) < 0
      ) {
        continue
      }
      const here = stateOf(state, starts)
      const c = cells[here.cell] as Cell
      const isStart = state >= doorStates
      const entry = along(c, turnAround(here.head), here.at)
      const across = (p: Point) => (horizontal(here.head) ? p.y : p.x)

      // finishing here, at each end that stands in this cell
      const finishing = capacity && !here.banded ? undefined : goalsAt.get(c.id)
      if (finishing) {
        for (const gi of finishing) {
          const g = e.b[gi] as Anchor
          const arrive = turnAround(g.out)
          const exit = along(c, arrive, g.lead)
          const crossing = chords[c.id]?.reduce(
            (n, o) => n + (interleave(entry, exit, o.p, o.q) && o.line !== line.id ? 1 : 0),
            0,
          )
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
            cost[1] + (crossing ?? 0),
            cost[2] + bends,
            cost[3] + len,
          ])
        }
        continue
      }

      for (const d of c.doors) {
        const door = doors[d.door] as Door
        // Back out of the door just come through is only worth it in a band, which is one cell with
        // one door as wide as the drawing, and where lines go up and down through it.
        if (here.door && door.id === here.door.id && c.band === undefined) continue
        const exitDir = SIDE[d.side]
        const next = cells[d.to] as Cell
        if (capacity) {
          if (next.band !== undefined && next.id !== wantBand) continue
          if ((used[door.id] ?? 0) + 1 > door.capacity) continue
          // Sideways only in the band, and when leaving or reaching a card; otherwise straight
          // on toward the band, through doors that face it.
          if (c.band === undefined) {
            const reaching = goalsAt.has(next.id)
            if (!isStart && !reaching) {
              if (door.normal !== 'y') continue
              if (exitDir === turnAround(here.head)) continue
              if (!horizontal(here.head) && exitDir !== here.head) continue
            }
            if (isStart && exitDir === turnAround(here.head)) continue
          }
        }
        const moved = advance(here.head, here.run, here.at, door, exitDir)
        const mid = moved.point
        const exit = along(c, exitDir, mid)
        let crossing = 0
        for (const o of chords[c.id] ?? []) {
          if (o.line !== line.id && interleave(entry, exit, o.p, o.q)) crossing++
        }
        const { bends } = moved
        const len = Math.abs(mid.x - here.at.x) + Math.abs(mid.y - here.at.y)
        const nextCost: Cost = [
          cost[0] + forbidden(c),
          cost[1] + crossing,
          cost[2] + bends,
          cost[3] + len,
        ]
        const banded = here.banded || (wantBand !== undefined && next.id === wantBand)
        const key = (door.id * 2 + (c.id === door.a ? 0 : 1)) * 2 + (banded ? 1 : 0)
        if (
          stamp[key] === attempt &&
          lexical([b0[key] ?? 0, b1[key] ?? 0, b2[key] ?? 0, b3[key] ?? 0], nextCost) <= 0
        ) {
          continue
        }
        stamp[key] = attempt
        b0[key] = nextCost[0]
        b1[key] = nextCost[1]
        b2[key] = nextCost[2]
        b3[key] = nextCost[3]
        parent[key] = state
        px[key] = mid.x
        py[key] = mid.y
        rlo[key] = moved.run[0]
        rhi[key] = moved.run[1]
        frontier.push(key, -1, nextCost)
      }
    }
    return undefined
  }

  /** The chords a route makes across the cells it passes, from where it starts to where it ends. */
  const chordsOf = (r: GlobalRoute): { cell: number; chord: Chord }[] => {
    const { hops, last } = replay(space, r)
    const out = hops.map((h) => {
      const c = cells[h.cell] as Cell
      return {
        cell: h.cell,
        chord: {
          line: r.line,
          p: along(c, turnAround(h.head), h.enter),
          q: along(c, h.exit, h.leave),
        },
      }
    })
    const c = cells[last.cell] as Cell
    out.push({
      cell: last.cell,
      chord: {
        line: r.line,
        p: along(c, turnAround(last.head), last.enter),
        q: along(c, turnAround(r.to.out), r.to.lead),
      },
    })
    return out
  }

  const lay = (r: GlobalRoute, by: 1 | -1) => {
    for (const s of r.steps) used[s.door] = (used[s.door] ?? 0) + by
    for (const { cell, chord } of chordsOf(r)) {
      const list = chords[cell] ?? []
      if (by === 1) list.push(chord)
      else {
        const i = list.findIndex((o) => o.line === chord.line)
        if (i >= 0) list.splice(i, 1)
      }
    }
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
   * back, goes sideways through the middle of the cell it is made in.
   */
  const draw = (r: GlobalRoute): Point[] => {
    interface Run {
      head: Dir
      /** The stretch of the line's cross coordinate that suits every door in the run. */
      span: [number, number]
      /** How it follows the run before it; a joint is made in `cell`. */
      kind: 'start' | 'turn' | 'joint'
      cell?: Cell
    }
    const { hops, last } = replay(space, r)
    const first = r.from.lead
    const start = horizontal(r.from.out) ? first.y : first.x
    const runs: Run[] = [{ head: r.from.out, span: [start, start], kind: 'start' }]
    const follow = (head: Dir, span: [number, number], cell: Cell | undefined) => {
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
        runs.push({ head, span, kind: 'joint', ...(cell && { cell }) })
      } else runs.push({ head, span, kind: 'turn' })
    }
    for (const h of hops) follow(h.exit, [h.door.lo, h.door.hi], cells[h.cell])
    const arrive = turnAround(r.to.out)
    const goal = horizontal(arrive) ? r.to.lead.y : r.to.lead.x
    follow(arrive, [goal, goal], cells[last.cell])

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
      const mid = j ? (horizontal(before.head) ? (j.x0 + j.x1) / 2 : (j.y0 + j.y1) / 2) : 0
      if (horizontal(before.head)) {
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

  const reach = (id: string) => {
    const e = ends.get(id)
    const a = e?.a[0]
    const b = e?.b[0]
    return a && b ? Math.abs(a.lead.x - b.lead.x) + Math.abs(a.lead.y - b.lead.y) : 0
  }
  const rank = { oriented: 0, overlay: 1, inside: 2 }
  const order = problem.lines
    .filter((l) => ends.has(l.id))
    .sort((p, q) => rank[p.role] - rank[q.role] || reach(p.id) - reach(q.id) || compare(p.id, q.id))

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
    // Lay again the lines that cross another, worst first, while that makes them cheaper.
    for (let pass = 0; refine && pass < lines.length; pass++) {
      let improved = false
      const crossing = lines
        .filter((l) => (routes.get(l.id)?.cost[1] ?? 0) > 0)
        .sort((p, q) =>
          lexical(routes.get(q.id)?.cost ?? [0, 0, 0, 0], routes.get(p.id)?.cost ?? [0, 0, 0, 0]),
        )
      for (const line of crossing) {
        const old = routes.get(line.id)
        const e = ends.get(line.id)
        if (!old || !e) continue
        lay(old, -1)
        const r = route(line, e)
        if (r && lexical(r.cost, old.cost) < 0) {
          routes.set(line.id, r)
          lay(r, 1)
          improved = true
        } else {
          lay(old, 1)
        }
      }
      if (!improved) break
    }
  }
  return { routes, unroutable, used }
}
