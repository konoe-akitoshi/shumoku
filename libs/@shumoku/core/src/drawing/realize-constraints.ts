// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey } from '../structure/keys.js'
import type { Ordering } from './bundle-order.js'
import { type Dir, type GlobalRoute, type GlobalRoutes, horizontal } from './global.js'
import { haloOf, pitchOfAny, snapOf, whiteOf } from './kin.js'
import { type Laid, laneOrders, type Piece, piecesOf } from './lanes.js'
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
  ports: PortEntity[]
  unknownOf: Map<PortEntity, number>
  laid: LaidLine[]
  byLine: Map<string, LaidLine>
}

/** The pieces of the lines that run side by side in a cell, and how they are read. */
export interface Lanes {
  lines: readonly Laid[]
  /** The unknown a piece is, if it has one. */
  unknownOf(p: Piece): number | undefined
  /** The pitch two pieces keep. */
  pitch(p: Piece, q: Piece): number
}

/**
 * Adds the orders of the lines that run side by side in a cell, on `axis`, to its unknowns. Their
 * order is the lane layer's to say (`laneOrders`), read with the other axis as `known` gives it.
 * Where the ends of two pieces decide it (`forced`) the order is taken as it is given. Where they
 * decide nothing, the order is the one that everything else asked of this axis puts them in: the
 * axis is solved with those alone, and the two are put in the order they came out in. Where that
 * solve puts them at one place, the order given stands.
 */
export function separate(
  u: Unknowns,
  axis: Axis,
  lanes: Lanes,
  tolerance: number,
  known: (a: Axis, i: number) => number,
) {
  const orders = laneOrders(
    axis,
    lanes.lines,
    lanes.pitch,
    (p) => {
      const v = lanes.unknownOf(p)
      return v === undefined ? 0 : known(p.axis, v)
    },
    (p) => {
      const v = lanes.unknownOf(p)
      return v === undefined ? [0, 0] : u.room(v)
    },
    (p, q) => {
      const v = lanes.unknownOf(p)
      const w = lanes.unknownOf(q)
      return v === undefined || w === undefined || u.find(v) === u.find(w)
    },
  )
  for (const o of orders) {
    if (!o.forced) continue
    const v = lanes.unknownOf(o.before)
    const w = lanes.unknownOf(o.after)
    if (v !== undefined && w !== undefined) u.before(v, w, lanes.pitch(o.before, o.after), true)
  }
  const free = orders.filter((o) => !o.forced)
  if (free.length === 0) return
  const solved = u.solve(tolerance)
  for (const o of free) {
    const v = lanes.unknownOf(o.before)
    const w = lanes.unknownOf(o.after)
    if (v === undefined || w === undefined) continue
    const d = solved.value(w) - solved.value(v)
    const gap = lanes.pitch(o.before, o.after)
    if (d < -EPS) u.before(w, v, gap, true)
    else u.before(v, w, gap, true)
  }
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
  // layer's to say (`laneOrders`), read with the other axis as estimated for the first axis and as
  // solved for the second; here each order is taken as it is given.
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
  const unknownOfPiece = (p: Piece): number | undefined => {
    const item = byLine.get(p.line)
    return p.kind === 'run' ? item?.at[p.i] : item?.across[p.i]
  }
  const tolerance = snapOf(problem.metrics)
  const lanes: Lanes = {
    lines: laidLines.map((l) => l.laid),
    unknownOf: unknownOfPiece,
    pitch: (p, q) => {
      const lp = byLine.get(p.line)?.line
      const lq = byLine.get(q.line)?.line
      return pitchOfAny(problem.metrics, lp, lq)
    },
  }

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
  // by side: their order is fixed there, and one cannot be asked to reach past the other.
  const inOrder = (axis: Axis) => (before: Wall, after: Wall) => {
    if (!before.own && !after.own) return true
    const p = geometry.boxes.get(before.item)
    const q = geometry.boxes.get(after.item)
    if (!p || !q) return false
    const [p0, p1, q0, q1] =
      axis === 'x'
        ? [p.y, p.y + p.height, q.y, q.y + q.height]
        : [p.x, p.x + p.width, q.x, q.x + q.width]
    return Math.min(p1, q1) - Math.max(p0, q0) <= EPS
  }

  return {
    U,
    tolerance,
    separate: (axis, known) => separate(U[axis], axis, lanes, tolerance, known),
    boundPieces,
    inOrder,
    ports,
    unknownOf,
    laid,
    byLine,
  }
}
