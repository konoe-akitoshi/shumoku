// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey } from '../structure/keys.js'
import type { Ordering } from './bundle-order.js'
import { type Dir, type GlobalRoute, type GlobalRoutes, horizontal } from './global.js'
import { halfOf, keepOff, pitchOf, pitchOfAny, snapOf, whiteOf } from './kin.js'
import { laneOrders, type Piece, piecesOf } from './lanes.js'
import type { Box, Point } from './metrics.js'
import {
  centre,
  ownerOf,
  type PortEntity,
  portEntities,
  portId,
  portRoom,
  simplify,
} from './ports.js'
import {
  boxKey,
  type Demand,
  type End,
  type Geometry,
  type Line,
  lineEnd,
  linesById,
  type Problem,
} from './problem.js'
import { anywhere, between, type Room, type RouteRooms, within } from './rooms.js'
import type { Scene, Side } from './scene.js'
import { type Axis, solveXY } from './solve-xy.js'
import type { Space, Wall } from './space.js'
import { Unknowns } from './unknowns.js'

type Run = GlobalRoute['runs'][number]

const EPS = 1e-6
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

/** What `realize` hands on. */
export interface Realized {
  wires: Map<string, Point[]>
  ports: NonNullable<Scene['ports']>
  demands: Demand[]
  /** Where the room fell short of the orders asked, by axis: the two ends of each chain that does not fit. */
  squeezedAt: {
    axis: Axis
    low: string
    high: string
    short: number
    asked: boolean
    /** The values of the chain, in order, with the room each has. */
    chain: string[]
    /** The rooms asked of the layout for it, between the boxes that make its two ends. */
    asks: Omit<Demand, 'axis'>[]
    /**
     * The ports in the chain whose line still goes straight out through a door, the one that falls
     * shortest first: what to lay again with a joint, which frees the port of the door and parts
     * the chain, where no room can be asked for it.
     */
    ends: string[]
  }[]
  /** What could not be met, for the report: nothing is hidden. */
  unmet: {
    /** Chains of orders that the rooms, from the doors and the boxes round them, cannot hold, and are still asked of the layout or cannot be. */
    squeezed: number
    /** Orders that a ring of orders left out, and orders that the rooms of the two could not keep. */
    cycles: number
    apart: number
    /** Lane orders in a cell, which are decided here and not by the order layer, that the rooms or the other orders did not let be kept. */
    lanes: number
    /** Separations the solution does not keep, and values it puts outside their room. */
    separations: number
    bounds: number
  }
}

/** The side of a box that faces another, for a line that no route was found for. */
function facing(own: Box, other: Box): Side {
  if (other.y >= own.y + own.height) return 'bottom'
  if (other.y + other.height <= own.y) return 'top'
  return centre(other).x >= centre(own).x ? 'right' : 'left'
}

const OUT: Record<Side, Dir> = { right: 0, bottom: 1, left: 2, top: 3 }

/**
 * Puts every line on coordinates. The routes say which doors a line goes through, and the orders
 * say how the lines at one door stand; here each straight run of a line is an unknown (its x if it
 * goes up or down, its y if across), as is each port along the edge of its box and each short run
 * across that moves a line sideways. Each axis is solved by itself.
 *
 * A run lies within the doors it goes through, kept a white from their ends, or a lead-out from a
 * box that bounds the room; two runs at one door keep the gap of their widths in the order the door has; the ports
 * of one side of a box keep a slot from each other, in the order of the lines that leave them; the
 * first and last turn of a line are a lead-out from the box. What pulls is a straight line: a run
 * toward the run two along from it, and everything toward where the route estimated it.
 *
 * Where the room is not enough the values are put as near as they can be and counted in `unmet`;
 * and the room that the chains of orders lack is asked of the layout by `demands`.
 */
export function realize(
  problem: Problem,
  geometry: Geometry,
  space: Space,
  routes: GlobalRoutes,
  ordering: Ordering,
  rooms: ReadonlyMap<string, RouteRooms>,
): Realized {
  const leadOut = keepOff(problem.metrics, true)
  const white = whiteOf(problem.metrics)
  const { doors } = space
  const box = (end: End) => geometry.boxes.get(boxKey(end)) ?? geometry.boxes.get(end.item)

  const ports = portEntities(problem, geometry, routes)
  const slotAt = (p: PortEntity) => problem.slots.get(p.box) ?? 0
  const portAxis = (p: PortEntity): Axis => (p.side === 'top' || p.side === 'bottom' ? 'x' : 'y')

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
      const other = l ? box(e.end === 'a' ? l.b : l.a) : undefined
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

  interface Laid {
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
  const laid: Laid[] = []
  const byLine = new Map<string, Laid>()
  const runAxis = (run: Run): Axis => (horizontal(run.head) ? 'y' : 'x')
  const acrossAxis = (run: Run): Axis => (horizontal(run.head) ? 'x' : 'y')

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
    const pieces: Laid['pieces'] = []
    for (const [i, run] of runs.entries()) {
      const w = across[i]
      if (i > 0 && w !== undefined) pieces.push({ axis: acrossAxis(run), v: w })
      pieces.push({ axis: runAxis(run), v: at[i] ?? 0 })
    }
    const item: Laid = { line, route, runs, at, across, step, from, to, pieces }
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

  // ---- the lines that share no door but run side by side in a cell
  const edgeOf = (p: PortEntity) =>
    p.side === 'top'
      ? p.rect.y
      : p.side === 'bottom'
        ? p.rect.y + p.rect.height
        : p.side === 'left'
          ? p.rect.x
          : p.rect.x + p.rect.width
  // ---- the lines that share no door but run side by side in a cell: their order is the lane
  // layer's to say (`laneOrders`), read with the other axis as estimated for the first axis and as
  // solved for the second; here each order is taken as it is given.
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
  const pitchBetween = (p: Piece, q: Piece): number => {
    const lp = byLine.get(p.line)?.line
    const lq = byLine.get(q.line)?.line
    return pitchOfAny(problem.metrics, lp, lq)
  }
  const separate = (axis: Axis, known: (a: Axis, i: number) => number) => {
    const u = U[axis]
    const orders = laneOrders(
      axis,
      laidLines.map((l) => l.laid),
      pitchBetween,
      (p) => {
        const v = unknownOfPiece(p)
        return v === undefined ? 0 : known(p.axis, v)
      },
      (p) => {
        const v = unknownOfPiece(p)
        return v === undefined ? [0, 0] : u.room(v)
      },
      (p, q) => {
        const v = unknownOfPiece(p)
        const w = unknownOfPiece(q)
        return v === undefined || w === undefined || u.find(v) === u.find(w)
      },
    )
    for (const o of orders) {
      if (!o.forced) continue
      const v = unknownOfPiece(o.before)
      const w = unknownOfPiece(o.after)
      if (v !== undefined && w !== undefined) u.before(v, w, pitchBetween(o.before, o.after), true)
    }
    // Where the ends of two pieces decide nothing, the order is the one that everything else
    // asked of this axis puts them in: the axis is solved with those alone, and the two are put in
    // the order they came out in. Where that solve puts them at one place, the order given stands.
    const free = orders.filter((o) => !o.forced)
    if (free.length === 0) return
    const solved = u.solve(tolerance)
    for (const o of free) {
      const v = unknownOfPiece(o.before)
      const w = unknownOfPiece(o.after)
      if (v === undefined || w === undefined) continue
      const d = solved.value(w) - solved.value(v)
      const gap = pitchBetween(o.before, o.after)
      if (d < -EPS) u.before(w, v, gap, true)
      else u.before(v, w, gap, true)
    }
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
          between(space, white, halfOf(item.line), axis === 'y', start ?? 0, end ?? 0, at, inside),
        )
      }
    }
  }

  // ---- solve
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
  const { solved, want } = solveXY({ U, tolerance, separate, boundPieces, inOrder })
  const wantX = want.x
  const wantY = want.y
  const value = (axis: Axis, i: number) => solved[axis].value(i)

  // ---- the lines
  const wires = new Map<string, Point[]>()
  const portAt = (p: PortEntity): Point => {
    const v = value(portAxis(p), unknownOf.get(p) ?? 0)
    const { rect } = p
    return p.side === 'top'
      ? { x: v, y: rect.y }
      : p.side === 'bottom'
        ? { x: v, y: rect.y + rect.height }
        : p.side === 'left'
          ? { x: rect.x, y: v }
          : { x: rect.x + rect.width, y: v }
  }
  const lead = (p: Point, out: Dir): Point => ({
    x: p.x + (DX[out] ?? 0) * leadOut,
    y: p.y + (DY[out] ?? 0) * leadOut,
  })
  for (const item of laid) {
    const { runs, at, across, route } = item
    const a = portAt(item.from)
    const b = portAt(item.to)
    const pts: Point[] = [a, lead(a, route.from.out)]
    for (const [i, run] of runs.entries()) {
      if (i === 0) continue
      const before = runs[i - 1] as Run
      const cb = value(runAxis(before), at[i - 1] ?? 0)
      const c = value(runAxis(run), at[i] ?? 0)
      const flat = horizontal(before.head)
      if (run.kind === 'turn') {
        pts.push(flat ? { x: c, y: cb } : { x: cb, y: c })
        continue
      }
      const w = across[i]
      const mid = w === undefined ? 0 : value(acrossAxis(run), w)
      if (flat) pts.push({ x: mid, y: cb }, { x: mid, y: c })
      else pts.push({ x: cb, y: mid }, { x: c, y: mid })
    }
    pts.push(lead(b, route.to.out), b)
    wires.set(item.line.id, simplify(pts))
  }

  // ---- the ends no route was found for, and the lines between neighbours of one unit
  const scenePorts = new Map<string, NonNullable<Scene['ports']>[number]>()
  for (const p of ports) {
    scenePorts.set(p.id, {
      id: p.id,
      nodeId: p.nodeId,
      ...(p.label && { label: p.label }),
      at: portAt(p),
      side: p.side,
    })
  }
  const addPort = (end: End, at: Point, side: Side, line: Line, which: 'a' | 'b') => {
    const nodeId = end.node ?? end.item
    const id = portId(nodeId, end.port, line.id, which)
    if (scenePorts.has(id)) return
    scenePorts.set(id, { id, nodeId, ...(end.port && { label: end.port }), at, side })
  }
  for (const line of problem.lines) {
    if (line.role === 'inside' || wires.has(line.id)) continue
    const a = box(line.a)
    const b = box(line.b)
    if (!a || !b) continue
    const [sa, sb] = [facing(a, b), facing(b, a)]
    const stand = (r: Box, s: Side): Point =>
      s === 'top'
        ? { x: r.x + r.width / 2, y: r.y }
        : s === 'bottom'
          ? { x: r.x + r.width / 2, y: r.y + r.height }
          : s === 'left'
            ? { x: r.x, y: r.y + r.height / 2 }
            : { x: r.x + r.width, y: r.y + r.height / 2 }
    const [pa, pb] = [stand(a, sa), stand(b, sb)]
    const [la, lb] = [lead(pa, OUT[sa]), lead(pb, OUT[sb])]
    const vertical = sa === 'top' || sa === 'bottom'
    const mid = vertical ? (la.y + lb.y) / 2 : (la.x + lb.x) / 2
    wires.set(
      line.id,
      simplify(
        vertical
          ? [pa, la, { x: la.x, y: mid }, { x: lb.x, y: mid }, lb, pb]
          : [pa, la, { x: mid, y: la.y }, { x: mid, y: lb.y }, lb, pb],
      ),
    )
    addPort(line.a, pa, sa, line, 'a')
    addPort(line.b, pb, sb, line, 'b')
  }
  insideWires(problem, geometry, wires, addPort)

  // The ports in a chain of orders that still go straight out through a door, in the order of the
  // chain's values that fall shortest: a joint there parts the chain.
  const portsAt: Record<Axis, Map<number, PortEntity[]>> = { x: new Map(), y: new Map() }
  for (const [p, i] of unknownOf) {
    const axis = portAxis(p)
    const r = U[axis].find(i)
    portsAt[axis].set(r, [...(portsAt[axis].get(r) ?? []), p])
  }
  const straightOut = (p: PortEntity, e: { line: string; end: 'a' | 'b' }): boolean => {
    const route = byLine.get(e.line)?.route
    if (!route) return false
    const run = e.end === 'a' ? route.runs[0] : route.runs[route.runs.length - 1]
    return (
      run !== undefined &&
      run.hops.length > 0 &&
      (p.side === route.from.side || p.side === route.to.side)
    )
  }
  const endsOf = (axis: Axis, members: readonly number[]): string[] => {
    const out: string[] = []
    for (const k of members) {
      for (const p of portsAt[axis].get(U[axis].find(k)) ?? []) {
        for (const e of p.ends) {
          const key = lineEnd(e.line, e.end)
          if (!out.includes(key) && straightOut(p, e)) out.push(key)
        }
      }
    }
    return out
  }

  // What was not kept for want of room is asked of the layout, from the rooms that were too small
  // and not from the lines as they came out (the lines as drawn are checked by `demandsOf`).
  const demands: Demand[] = [
    ...wantX.asks.map((a): Demand => ({ axis: 'x', ...a })),
    ...wantY.asks.map((a): Demand => ({ axis: 'y', ...a })),
  ]
  return {
    wires,
    ports: [...scenePorts.values()],
    demands,
    squeezedAt: [
      ...wantX.where.map((w) => ({ axis: 'x' as const, ...w, ends: endsOf('x', w.members) })),
      ...wantY.where.map((w) => ({ axis: 'y' as const, ...w, ends: endsOf('y', w.members) })),
    ].map(({ members: _members, ...w }) => w),
    unmet: {
      squeezed: wantX.places + wantY.places,
      cycles: U.x.rejected + U.y.rejected,
      lanes: U.x.laneLost + U.y.laneLost,
      apart: U.x.apart + U.y.apart,
      separations: (solved.x.unmet[0] ?? 0) + (solved.y.unmet[0] ?? 0),
      bounds: (solved.x.unmet[1] ?? 0) + (solved.y.unmet[1] ?? 0),
    },
  }
}

/** A line between two neighbours of one unit runs straight across, level with their centres. */
function insideWires(
  problem: Problem,
  geometry: Geometry,
  wires: Map<string, Point[]>,
  addPort: (end: End, at: Point, side: Side, line: Line, which: 'a' | 'b') => void,
) {
  const boxOf = (end: End) =>
    geometry.boxes.get(end.node ?? end.item) ?? geometry.boxes.get(end.item)
  const pairs = new Map<string, Line[]>()
  for (const line of problem.lines) {
    if (line.role !== 'inside') continue
    const key = joinKey([line.a.node ?? line.a.item, line.b.node ?? line.b.item].sort(compare))
    pairs.set(key, [...(pairs.get(key) ?? []), line])
  }
  for (const group of pairs.values()) {
    // Neighbours stand a pitch apart, each pair by its own, and the row is centred.
    const offsets: number[] = []
    for (const [i, line] of group.entries()) {
      const before = group[i - 1]
      offsets.push(before ? (offsets[i - 1] ?? 0) + pitchOf(problem.metrics, before, line) : 0)
    }
    for (const [k, line] of group.entries()) {
      const a = boxOf(line.a)
      const b = boxOf(line.b)
      if (!a || !b) continue
      const [from, to] = centre(a).x <= centre(b).x ? [a, b] : [b, a]
      const level = (centre(a).y + centre(b).y) / 2 + (offsets[k] ?? 0) - (offsets.at(-1) ?? 0) / 2
      const p = { x: from.x + from.width, y: level }
      const q = { x: to.x, y: level }
      const [first, last] = from === a ? [p, q] : [q, p]
      wires.set(line.id, [first, last])
      addPort(line.a, first, from === a ? 'right' : 'left', line, 'a')
      addPort(line.b, last, from === a ? 'left' : 'right', line, 'b')
    }
  }
}
