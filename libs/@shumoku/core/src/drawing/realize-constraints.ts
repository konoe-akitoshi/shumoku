// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey } from '../structure/keys.js'
import type { Ordering } from './bundle-order.js'
import { type Dir, type GlobalRoute, type GlobalRoutes, horizontal } from './global.js'
import { haloOf, pitchOfAny, snapOf, whiteOf } from './kin.js'
import {
  type Bound,
  type Leg,
  laneOrders,
  misreadings,
  type Piece,
  piecesOf,
  type Reading,
  type Relation,
} from './lanes.js'
import { ownerOf, type PortEntity, portEntities, portRoom } from './ports.js'
import {
  boxKey,
  type End,
  type Geometry,
  type Line,
  lineEnd,
  linesById,
  type Problem,
} from './problem.js'
import { anywhere, between, type Room, type RouteRooms, within } from './rooms.js'
import type { Axis, Constraints } from './solve-xy.js'
import type { Space, Wall } from './space.js'
import { EPS } from './tolerance.js'
import { Unknowns } from './unknowns.js'

export type Run = GlobalRoute['runs'][number]

export const portAxis = (p: PortEntity): Axis =>
  p.side === 'top' || p.side === 'bottom' ? 'x' : 'y'
export const runAxis = (run: Run): Axis => (horizontal(run.head) ? 'y' : 'x')
export const acrossAxis = (run: Run): Axis => (horizontal(run.head) ? 'x' : 'y')

/** The box an end of a line stands at. */
export const boxAt = (geometry: Geometry, end: End) =>
  geometry.boxes.get(boxKey(end)) ?? geometry.boxes.get(end.item)

/** One routed line as the unknowns it is made of. */
export interface LaidLine {
  line: Line
  route: GlobalRoute
  runs: Run[]
  /** Each run's unknown, and each joint's unknown for the run across. */
  at: number[]
  across: (number | undefined)[]
  /** The unknown a door's crossing is at, for each step of the route. */
  step: number[]
  from: PortEntity
  to: PortEntity
  /** The straight pieces of the line in order: its runs, and the joints' short runs across. */
  pieces: { axis: Axis; v: number }[]
}

/**
 * What the layout of the lines is asked of: the `Constraints` the two axes are solved from, and
 * the things they are about, which the lines are drawn from once the unknowns have values.
 */
export interface Setup extends Constraints {
  /** The pieces of the lines and how the lane layer reads them. */
  lanes: Lanes
  ports: PortEntity[]
  unknownOf: Map<PortEntity, number>
  laid: LaidLine[]
  byLine: Map<string, LaidLine>
}

/** The pieces of the lines, and how they are read: the relations of the two axes and the rooms. */
export interface Lanes {
  pieces: readonly Piece[]
  reading: Reading
}

/**
 * Adds the orders of the lines that run side by side in a cell, on `axis`, to its unknowns. Which
 * pairs those are, and which is first, is the lane layer's to say (`laneOrders`), read from the
 * orders made so far on both axes and the rooms. Where the ends of two pieces decide it (`forced`)
 * the order is taken as it is given. Where they decide nothing, the order is the one that
 * everything else asked of this axis puts them in: the axis is solved with those alone, and the
 * two are put in the order they came out in; where that solve puts them at one place, the order
 * given stands. Pairs ordered here before are not asked again (`done`). Gives how many orders
 * were added, and the pairs the relations leave undecided.
 */
export function separate(
  u: Unknowns,
  axis: Axis,
  lanes: Lanes,
  tolerance: number,
  done: Set<string> = new Set(),
  /** Which orders to add: those the legs force, which cost no solve, or those nothing forces, which cost one. */
  which: 'forced' | 'free' | 'both' = 'both',
  /** The pairs still open from the last look, where there was one: the only ones a look can change. */
  open?: readonly [Piece, Piece][],
): { added: number; undecided: [Piece, Piece][] } {
  const { reading: r } = lanes
  const { orders, undecided } = laneOrders(axis, lanes.pieces, r, open)
  const fresh = orders.filter((o) => !done.has(pairKey(o.before, o.after)))
  const was = u.sep.length
  if (which !== 'free') {
    for (const o of fresh) {
      if (!o.forced) continue
      const v = r.unknownOf(o.before)
      const w = r.unknownOf(o.after)
      done.add(pairKey(o.before, o.after))
      if (v === undefined || w === undefined) continue
      // The order the legs ask for may be the reverse of what the orders made before (at the
      // doors and the ports) already say: then those stand, and a leg is crossed.
      if (!apart(u, v, w, r.pitch(o.before, o.after))) u.laneCrossed++
    }
  }
  const free = which === 'forced' ? [] : fresh.filter((o) => !o.forced)
  if (free.length > 0) {
    const solved = u.solve(tolerance)
    for (const o of free) {
      const v = r.unknownOf(o.before)
      const w = r.unknownOf(o.after)
      done.add(pairKey(o.before, o.after))
      if (v === undefined || w === undefined) continue
      const d = solved.value(w) - solved.value(v)
      const gap = r.pitch(o.before, o.after)
      if (d < -EPS) apart(u, w, v, gap)
      else apart(u, v, w, gap)
    }
  }
  // what is still open: the pairs not decided, and the orders found but not added this time
  return {
    added: u.sep.length - was,
    undecided: [...undecided, ...orders.map((o): [Piece, Piece] => [o.before, o.after])].filter(
      ([p, q]) => !done.has(pairKey(p, q)),
    ),
  }
}

/**
 * Orders the pairs the relations left undecided, on a solution of both axes: a pair whose extents
 * the solution shows overlapping, and nearer than their pitch, is put in the order the solution
 * shows, and kept so. A pair the solution shows apart, or side by side with room between, is left
 * as it is: the relation between the two is free, and a free relation is the solve's to settle,
 * asked of it only where it would otherwise lay the two on each other. Gives how many orders were
 * added.
 */
export function settle(
  u: Unknowns,
  axis: Axis,
  lanes: Lanes,
  pairs: readonly [Piece, Piece][],
  value: (a: Axis, i: number) => number,
  done: Set<string>,
  /** Where to note each pair settled, as its key and which came first. */
  settled?: string[],
): number {
  const { reading: r } = lanes
  const across = axis === 'x' ? 'y' : 'x'
  const at = (e: Bound) => ('at' in e ? e.at : value(across, e.v))
  const was = u.sep.length
  for (const [p, q] of pairs) {
    if (done.has(pairKey(p, q))) continue
    const pe = r.ends(p).map(at)
    const qe = r.ends(q).map(at)
    const over =
      Math.min(Math.max(...pe), Math.max(...qe)) - Math.max(Math.min(...pe), Math.min(...qe))
    if (over <= EPS) continue
    const v = r.unknownOf(p)
    const w = r.unknownOf(q)
    if (v === undefined || w === undefined) continue
    const d = value(axis, w) - value(axis, v)
    const gap = r.pitch(p, q)
    // a pair shown apart with room between stays open: a later solution may bring it together
    if (Math.abs(d) >= gap - EPS) continue
    done.add(pairKey(p, q))
    // of the two orders, the one that misreads less (each crossed leg, and each crossing also
    // read as the lines running on into each other); where they misread alike, the one shown
    const read = (a: Axis, e: Bound) => ('at' in e ? e.at : value(a, e.v))
    const mp = misreadings(r, p, q, true, read)
    const mq = misreadings(r, p, q, false, read)
    const first = mp !== mq ? mp < mq : Math.abs(d) > EPS ? d > 0 : compare(p.line, q.line) < 0
    settled?.push(`${pairKey(p, q)} ${first ? p.line : q.line}#${first ? p.k : q.k}`)
    if (first) apart(u, v, w, gap)
    else apart(u, w, v, gap)
  }
  return u.sep.length - was
}

/**
 * Keeps `v` a `gap` before `w`; where the orders made before already put `w` before `v`, keeps
 * them the gap apart that way instead. Either way no two pieces are left on top of each other.
 * Gives whether the order asked for is the one kept.
 */
function apart(u: Unknowns, v: number, w: number, gap: number): boolean {
  if (u.before(v, w, gap, true)) return true
  if (u.precedes(w, v)) u.before(w, v, gap, true)
  return false
}

const pairKey = (p: Piece, q: Piece) => {
  const a = `${p.line}#${p.k}`
  const b = `${q.line}#${q.k}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * What is asked of the lines: each straight run of a line is an unknown (its x if it goes up or
 * down, its y if across), as is each port along the edge of its box and each short run across that
 * moves a line sideways. A run lies within the doors it goes through, kept a white from their
 * ends, or a lead-out from a box that bounds the room; two runs at one door keep the gap of their
 * widths in the order the door has; the ports of one side of a box keep a slot from each other, in
 * the order of the lines that leave them. What pulls is a straight line: a run toward the run two
 * along from it, and everything toward where the route estimated it.
 */
export function constraintsOf(
  problem: Problem,
  geometry: Geometry,
  space: Space,
  routes: GlobalRoutes,
  ordering: Ordering,
  rooms: ReadonlyMap<string, RouteRooms>,
): Setup {
  const white = whiteOf(problem.metrics)
  const { doors } = space

  const ports = portEntities(problem, geometry, routes)
  const slotAt = (p: PortEntity) => problem.slots.get(p.box) ?? 0
  const ownedBox = (key: string) => ownerOf(problem, geometry, key)
  const U: Record<Axis, Unknowns> = { x: new Unknowns(), y: new Unknowns() }
  const unknownOf = new Map<PortEntity, number>()
  const entityOf = new Map<string, PortEntity>()
  // A port is pulled to where its line would run straight to the other end's box (the mean over the
  // lines that share the port): to the centre of the box where the box stands across some of the
  // room, and to the middle of the room where it does not, as no place on the side is then
  // straighter than another. The route's estimate (`est`) is the way the line goes, not this.
  const lineOf = linesById(problem)
  const towardOf = (p: PortEntity, room: Room): number | undefined => {
    const aims: number[] = []
    for (const e of p.ends) {
      const l = lineOf.get(e.line)
      const other = l ? boxAt(geometry, e.end === 'a' ? l.b : l.a) : undefined
      if (!other) continue
      const [t0, t1] =
        portAxis(p) === 'x' ? [other.x, other.x + other.width] : [other.y, other.y + other.height]
      aims.push(
        Math.min(t1, room.hi) - Math.max(t0, room.lo) > 0 ? (t0 + t1) / 2 : (room.lo + room.hi) / 2,
      )
    }
    if (aims.length === 0) return undefined
    const mean = aims.reduce((u, v) => u + v, 0) / aims.length
    return Math.min(Math.max(mean, room.lo), room.hi)
  }
  for (const p of ports) {
    const axis = portAxis(p)
    const room = portRoom(p.rect, p.side, slotAt(p), ownedBox(p.box))
    const name = `port ${p.box} ${p.side} ${p.ends.map((e) => lineEnd(e.line, e.end)).join(',')}`
    unknownOf.set(p, U[axis].add(name, room, towardOf(p, room) ?? p.est))
    for (const e of p.ends) entityOf.set(lineEnd(e.line, e.end), p)
  }

  const laid: LaidLine[] = []
  const byLine = new Map<string, LaidLine>()

  // Two ends that are one run are one port to the unknown: that line is straight.
  const routed = problem.lines.flatMap((line) => {
    const route = routes.routes.get(line.id)
    const from = entityOf.get(lineEnd(line.id, 'a'))
    const to = entityOf.get(lineEnd(line.id, 'b'))
    return route && from && to ? [{ line, route, from, to, runs: route.runs }] : []
  })
  for (const r of routed) {
    if (r.runs.length === 1) {
      const a = unknownOf.get(r.from)
      const b = unknownOf.get(r.to)
      if (a !== undefined && b !== undefined && r.from !== r.to) U[portAxis(r.from)].join(a, b)
    }
  }

  for (const r of routed) {
    const { line, route, runs, from, to } = r
    const last = runs.length - 1
    const at: number[] = []
    const across: (number | undefined)[] = []
    const step: number[] = []
    for (const [i, run] of runs.entries()) {
      const axis = runAxis(run)
      let v: number
      if (i === 0) v = unknownOf.get(from) ?? 0
      else if (i === last) v = unknownOf.get(to) ?? 0
      else v = U[axis].add(`run ${line.id}#${i}`, anywhere, run.at)
      const room = rooms.get(line.id)?.runs[i]
      if (room) U[axis].limit(v, room)
      at.push(v)
      for (const h of run.hops) step[h] = v
      if (i > 0 && run.kind === 'joint') {
        const cx = acrossAxis(run)
        const room = rooms.get(line.id)?.across[i]
        const w = U[cx].add(`across ${line.id}#${i}`, room ?? anywhere, run.mid)
        across.push(w)
      } else across.push(undefined)
    }
    const pieces: LaidLine['pieces'] = []
    for (const [i, run] of runs.entries()) {
      const w = across[i]
      if (i > 0 && w !== undefined) pieces.push({ axis: acrossAxis(run), v: w })
      pieces.push({ axis: runAxis(run), v: at[i] ?? 0 })
    }
    const item: LaidLine = { line, route, runs, at, across, step, from, to, pieces }
    laid.push(item)
    byLine.set(line.id, item)

    // Straight where the line can be: a run is pulled toward the run two along from it.
    for (const [i, run] of runs.entries()) {
      const next = runs[i + 2]
      const a = at[i]
      const b = at[i + 2]
      if (next && a !== undefined && b !== undefined && runAxis(run) === runAxis(next)) {
        U[runAxis(run)].pairs.push({ i: a, j: b })
      }
    }
  }

  // ---- the order of the lines at each door
  for (const [door, list] of [...ordering.doors].sort((p, q) => p[0] - q[0])) {
    const d = doors[door]
    if (!d) continue
    const axis: Axis = d.normal === 'x' ? 'y' : 'x'
    const unknowns = list.map(({ line, step }) => byLine.get(line)?.step[step - 1])
    for (const [k, a] of unknowns.entries()) {
      const b = unknowns[k + 1]
      const lp = byLine.get(list[k]?.line ?? '')?.line
      const lq = byLine.get(list[k + 1]?.line ?? '')?.line
      if (a !== undefined && b !== undefined)
        U[axis].before(a, b, pitchOfAny(problem.metrics, lp, lq))
    }
  }

  // ---- the ports of one side of a box, a slot apart, in the order their lines leave in
  const sides = new Map<string, PortEntity[]>()
  for (const p of ports)
    sides.set(joinKey([p.box, p.side]), [...(sides.get(joinKey([p.box, p.side])) ?? []), p])
  const sign = (out: Dir) => (out === 1 || out === 2 ? 1 : -1)
  for (const group of sides.values()) {
    const place = (p: PortEntity) => {
      const e = p.ends[0]
      return e ? (ordering.ports.get(lineEnd(e.line, e.end)) ?? 0) : 0
    }
    const byCell = new Map<number, PortEntity[]>()
    for (const p of group) byCell.set(p.cell, [...(byCell.get(p.cell) ?? []), p])
    const cells = [...byCell.values()]
      .map((list) => ({
        list: list.sort(
          (p, q) => sign(p.out) * (place(p) - place(q)) || p.est - q.est || compare(p.id, q.id),
        ),
        at: Math.min(...list.map((p) => p.est)),
      }))
      .sort((p, q) => p.at - q.at)
    const ordered = cells.flatMap((c) => c.list)
    for (const [k, p] of ordered.entries()) {
      const next = ordered[k + 1]
      const a = unknownOf.get(p)
      const b = next ? unknownOf.get(next) : undefined
      if (a !== undefined && b !== undefined) U[portAxis(p)].before(a, b, slotAt(p))
    }
  }

  // ---- the lines that share no door but run side by side in a cell: their order is the lane
  // layer's to say (`laneOrders`), read from the orders of both axes and the rooms; here each
  // order is taken as it is given, and what the relations leave is settled on a solution.
  const edgeOf = (p: PortEntity) =>
    p.side === 'top'
      ? p.rect.y
      : p.side === 'bottom'
        ? p.rect.y + p.rect.height
        : p.side === 'left'
          ? p.rect.x
          : p.rect.x + p.rect.width
  const laidLines = laid.map((item) => ({
    item,
    laid: {
      pieces: piecesOf(item.route),
      fromEdge: edgeOf(item.from),
      toEdge: edgeOf(item.to),
    },
  }))
  const laidOf = new Map(laidLines.map((l) => [l.item.line.id, l]))
  const unknownOfPiece = (p: Piece): number | undefined => {
    const item = byLine.get(p.line)
    return p.kind === 'run' ? item?.at[p.i] : item?.across[p.i]
  }
  const tolerance = snapOf(problem.metrics)
  type LaidLine2 = (typeof laidLines)[number]
  const endOf = (line: LaidLine2, k: number, which: 0 | 1): Bound => {
    const o = line.laid.pieces[k]
    const v = o ? unknownOfPiece(o) : undefined
    return o && v !== undefined
      ? { v }
      : { at: which === 0 ? line.laid.fromEdge : line.laid.toEdge }
  }
  // Which way the leg at an end runs from the piece: a run next to it runs the way it heads, and
  // arrives from the opposite way; a joint's run across runs from the one run's stretch to the
  // other's, where the doors put the two stretches apart, and no way the route can say where not.
  const legDir = (line: LaidLine2, o: Piece, which: 0 | 1): 1 | -1 | 0 => {
    const runs = line.item.runs
    if (o.kind === 'run') {
      const h = runs[o.i]?.head
      if (h === undefined) return 0
      const s: 1 | -1 = h === 0 || h === 1 ? 1 : -1
      return which === 1 ? s : s === 1 ? -1 : 1
    }
    const from = runs[o.i - 1]
    const to = runs[o.i]
    if (!from || !to) return 0
    const s: 1 | -1 | 0 =
      to.span[0] > from.span[1] + EPS ? 1 : to.span[1] < from.span[0] - EPS ? -1 : 0
    return which === 1 ? s : s === 0 ? 0 : s === 1 ? -1 : 1
  }
  const reading: Reading = {
    unknownOf: unknownOfPiece,
    ends: (p) => {
      const line = laidOf.get(p.line)
      if (!line) return [{ at: 0 }, { at: 0 }]
      return [endOf(line, p.k - 1, 0), endOf(line, p.k + 1, 1)]
    },
    legs: (p) => {
      const line = laidOf.get(p.line)
      if (!line) return []
      const legs: Leg[] = []
      for (const which of [0, 1] as const) {
        const step = which === 0 ? -1 : 1
        const o = line.laid.pieces[p.k + step]
        if (!o) continue
        legs.push({
          at: endOf(line, p.k + step, which),
          dir: legDir(line, o, which),
          to: endOf(line, p.k + 2 * step, which),
        })
      }
      return legs
    },
    compare: (axis, a, b): Relation => {
      const u = U[axis]
      if ('at' in a) {
        if ('at' in b) return a.at < b.at - EPS ? -1 : a.at > b.at + EPS ? 1 : 0
        const [lo, hi] = u.room(b.v)
        if (lo >= a.at - EPS) return hi <= a.at + EPS ? 0 : -1
        if (hi <= a.at + EPS) return 1
        return undefined
      }
      const [lo, hi] = u.room(a.v)
      if ('at' in b) {
        if (hi <= b.at + EPS) return lo >= b.at - EPS ? 0 : -1
        if (lo >= b.at - EPS) return 1
        return undefined
      }
      if (u.find(a.v) === u.find(b.v)) return 0
      if (u.precedes(a.v, b.v)) return -1
      if (u.precedes(b.v, a.v)) return 1
      const [lo2, hi2] = u.room(b.v)
      if (hi <= lo2 + EPS) return -1
      if (hi2 <= lo + EPS) return 1
      return undefined
    },
    room: (p) => {
      const v = unknownOfPiece(p)
      return v === undefined ? [0, 0] : U[p.axis].room(v)
    },
    same: (p, q) => {
      const v = unknownOfPiece(p)
      const w = unknownOfPiece(q)
      return v === undefined || w === undefined || U[p.axis].find(v) === U[p.axis].find(w)
    },
    pitch: (p, q) => {
      const lp = byLine.get(p.line)?.line
      const lq = byLine.get(q.line)?.line
      return pitchOfAny(problem.metrics, lp, lq)
    },
    radius: (p) => {
      const line = byLine.get(p.line)?.line
      return line ? whiteOf(problem.metrics) + haloOf(line) : 0
    },
  }
  const lanes: Lanes = { pieces: laidLines.flatMap((l) => l.laid.pieces), reading }

  // ---- every piece lies between the boxes along its stretch
  // The rooms were made with the stretch of a piece as far as the rooms of the pieces beside it
  // reach (`roomsOf`). Once the other axis is solved the stretch is known exactly, and the boxes
  // along it, and not where the route estimated it, bound the piece and are what room is asked of.
  const framesOf = within(problem)
  const boundPieces = (axis: Axis, solvedOther: (i: number) => number) => {
    for (const { item, laid: line } of laidLines) {
      for (const [k, p] of line.pieces.entries()) {
        if (p.axis !== axis) continue
        const v = unknownOfPiece(p)
        const run = item.runs[p.i]
        if (v === undefined || !run) continue
        const [start, end] = [line.pieces[k - 1], line.pieces[k + 1]].map((q, which) => {
          const w = q ? unknownOfPiece(q) : undefined
          return w === undefined ? (which === 0 ? line.fromEdge : line.toEdge) : solvedOther(w)
        })
        const inside = new Set<string>()
        if (p.kind === 'across') {
          if (run.cell) for (const f of framesOf(run.cell.frame)) inside.add(f)
        } else {
          for (const c of run.cells) {
            const cell = space.cells[c]
            if (cell) for (const f of framesOf(cell.frame)) inside.add(f)
          }
        }
        const at = p.kind === 'across' ? (run.mid ?? 0) : run.at
        U[axis].limit(
          v,
          between(space, white, haloOf(item.line), axis === 'y', start ?? 0, end ?? 0, at, inside),
        )
      }
    }
  }

  // Room is asked of the layout between the boxes at the two ends of a chain that does not fit,
  // but not where an end is the edge of a box's own side and the two boxes stand in one row, side
  // by side: their order is fixed there, and one cannot be asked to reach past the other. Nor
  // where both ends are the edges of two boxes' own sides: each side is as long as the ports on
  // it ask (`portWidths`), and a chain that runs from the one side to the other does so along a
  // straight line that holds a port of each at one place. The room it lacks is not either box's
  // to give by growing, which would leave it wider than what it holds; it is the straight line's,
  // which is laid again with a joint and parts the chain.
  const inOrder = (axis: Axis) => (before: Wall, after: Wall) => {
    if (!before.own && !after.own) return true
    if (before.own && after.own && before.item !== after.item) return false
    const p = geometry.boxes.get(before.item)
    const q = geometry.boxes.get(after.item)
    if (!p || !q) return false
    const [p0, p1, q0, q1] =
      axis === 'x'
        ? [p.y, p.y + p.height, q.y, q.y + q.height]
        : [p.x, p.x + p.width, q.x, q.x + q.width]
    return Math.min(p1, q1) - Math.max(p0, q0) <= EPS
  }

  const done: Record<Axis, Set<string>> = { x: new Set(), y: new Set() }
  const pending: Record<Axis, [Piece, Piece][] | undefined> = { x: undefined, y: undefined }
  const settledPairs: string[] = []
  return {
    settled: settledPairs,
    U,
    tolerance,
    separate: (axis, which) => {
      const r = separate(U[axis], axis, lanes, tolerance, done[axis], which, pending[axis])
      pending[axis] = r.undecided
      return r.added
    },
    settle: (axis, value) =>
      settle(U[axis], axis, lanes, pending[axis] ?? [], value, done[axis], settledPairs),
    undecided: (axis) =>
      (pending[axis] ?? []).filter(([p, q]) => !done[axis].has(pairKey(p, q))).length,
    boundPieces,
    inOrder,
    lanes,
    ports,
    unknownOf,
    laid,
    byLine,
  }
}
