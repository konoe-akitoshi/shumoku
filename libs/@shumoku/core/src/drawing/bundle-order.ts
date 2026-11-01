// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey, splitKey } from '../structure/keys.js'
import { laneOrder } from './crossing.js'
import {
  type Anchor,
  along,
  type Dir,
  type GlobalRoute,
  type GlobalRoutes,
  interleave,
  replay,
  SIDE,
  turnAround,
} from './global.js'
import { type Spacing, slotRow } from './kin.js'
import type { Point } from './metrics.js'
import { lineEnd, parseLineEnd } from './problem.js'
import type { RouteRooms } from './rooms.js'
import type { Cell, Space } from './space.js'

const EPS = 1e-6

/** Where a line is as it passes through a cell: at a door, or at the port it starts or ends at. */
interface Slot {
  /** For a port, which end of which line it is, such as `link:000001.a`. */
  port?: string
  door?: number
  /** For a port: its place along the perimeter of the cell it stands in. */
  pos?: number
  /** Where it was estimated to cross the door. */
  est: Point
}

/**
 * A route as the places it passes: slot `k` and `k + 1` are the two ends of the chord across
 * cell `k`. A run that goes straight on through several doors is one thing, not one for each
 * door: it lies on one line, so the order it has among the others is one and the same at every
 * door it goes through. `first` gives for each slot the first slot of the run it belongs to,
 * which is what names it, and `room` for such a first slot where across its heading the run may
 * lie, so far as the doors it goes through allow.
 */
export interface Path {
  line: string
  slots: Slot[]
  cells: number[]
  first: number[]
  room: Map<number, [number, number]>
}

export function pathOf(space: Space, r: GlobalRoute, rooms?: RouteRooms): Path {
  const { hops, last } = replay(space, r)
  const cells = [r.from.cell, ...r.steps.map((s) => s.into)]
  const tail = space.cells[last.cell] as Cell
  const first = Array.from({ length: r.steps.length + 2 }, (_, j) => j)
  const room = new Map<number, [number, number]>()
  for (const [i, run] of r.runs.entries()) {
    if (run.hops.length === 0) continue
    const at = Math.min(...run.hops) + 1
    let lo = Number.NEGATIVE_INFINITY
    let hi = Number.POSITIVE_INFINITY
    for (const h of run.hops) {
      first[h + 1] = at
      const d = space.doors[r.steps[h]?.door ?? -1]
      if (!d) continue
      lo = Math.max(lo, d.reach[0])
      hi = Math.min(hi, d.reach[1])
    }
    // The rooms the lines are placed in are the room it has, where they are known.
    const known = rooms?.runs[i]
    room.set(at, known ? [known.lo, known.hi] : [lo, hi])
  }
  return {
    line: r.line,
    cells,
    first,
    room,
    slots: [
      {
        port: `${r.line}.a`,
        pos: along(space.cells[r.from.cell] as Cell, turnAround(r.from.out), r.from.lead),
        est: r.from.lead,
      },
      ...hops.map((h) => ({ door: h.door.id, est: h.leave })),
      { port: `${r.line}.b`, pos: along(tail, turnAround(r.to.out), r.to.lead), est: r.to.lead },
    ],
  }
}

/**
 * A line at a door. A line may go through one door twice, up a column and back down it, and a run
 * goes through several doors, so what is ordered is a run's passing, named by the line and the
 * first slot of the run in its route; it is the same name at every door the run goes through.
 */
export const passing = (path: Path, j: number): string => `${path.line}@${path.first[j] ?? j}`

/** Which way the perimeter of a cell runs along a door on `side`, against the door's own low-to-high. */
const sgn = (side: Dir): 1 | -1 => (side === 3 || side === 0 ? 1 : -1)

/** What a run is, to the order: where it goes through doors, and where across it may lie. */
interface Piece {
  id: string
  /** The index of its line's path. */
  path: number
  /** Every slot it goes through, a door each. */
  slots: number[]
  /** The doors that have an order, each with the slot of this run's there. */
  doors: Map<number, number>
  room: [number, number]
}

export interface Ordering {
  /** The passings of lines at each door (see `passing`), from the low end of the door to the high end. */
  doors: Map<number, string[]>
  /** The bundles that were ordered by a search that is not exhaustive (more than eight lines). */
  approximated: number
  /** Where each port stands along the perimeter of its cell, once the ports follow the bundles. */
  ports: Map<string, number>
  /** How many pairs of lines cross inside a cell, counted from the orders. */
  crossings: number
  /** The same with the ports where they were. */
  crossingsBefore: number
  /** The same with every door's lines in the order of where they were estimated to cross it. */
  crossingsByEstimate: number
  /** The crossings in the cells before the orders were changed along the bundles (`climb`). */
  crossingsSettled: number
  /** What changing the orders along the bundles did. */
  climb: Climb
  perCell: Map<number, number>
  /** The lines of each crossing counted in `crossings`, one pair for each, with the cells' order. */
  pairs: [string, string][]
  /** Where each line runs across each cell, as places along the cell's perimeter, once ordered. */
  chords: Map<number, { line: string; p: number; q: number }[]>
  /**
   * The ports (`line.end`) that, in the order their side has, cannot stand a slot from the one
   * before within the window their line leaves them (the stretch the doors leave its first run).
   * The order is not changed for them: their lines are to be laid again so that the port is free
   * of the doors, which is the route layer's to do.
   */
  unfit: string[]
}

/** A line as it passes through a cell: the places along the cell's perimeter it enters and leaves at. */
interface Chord {
  line: string
  path: number
  /** Which cell of the route this is. */
  k: number
  cell: number
  /** The place in the order of all the chords, from which a pair is measured. */
  seq: number
  p: number
  q: number
}

/** A change to the orders: two lines next to each other at a door, swapped at every door they go through together. The ports follow, and are never changed alone. */
export interface Move {
  kind: 'door'
  door: number
  at: number
}

export interface Climb {
  tried: number
  accepted: number
  passes: number
  from: number
  to: number
}

export interface OrderSession {
  moves(): Move[]
  /** Makes the change and counts only what it touches. Gives how to undo it, or nothing if it cannot be made. */
  apply(move: Move): (() => void) | undefined
  /** The crossings now, in the cells, as counted by the changes so far. */
  total(): number
  /** The same counted again from the orders alone. */
  recount(): number
  /** Makes the changes that cross less, for as long as there are some. */
  climb(): Climb
  ordering(): Ordering
}

/**
 * Where each line stands along every door it goes through. The routes only say which doors a line
 * passes; two lines through one door can take either order, and what the order costs is decided
 * where they part: the one that goes on to the left of the other must be on its left. A pair
 * that goes through several doors one after another is one bundle, and keeps its order through
 * them (the order flips or not at each cell by the way the cell's perimeter runs). So for each
 * door the order of its lines is the one, among all, in which the pairs cross least where they
 * part at either end of what they share (`laneOrder`); what that cannot tell apart is settled the
 * same way along a bundle, by id.
 *
 * The ports of the lines that leave one card by one side of one cell are then swapped among the
 * places they stand at, in the order that crosses least.
 *
 * Those are settled door by door and cell by cell, and a bundle runs through several. So the orders
 * are then changed along whole bundles (`climb`): two lines next to each other at a door are
 * swapped at every door of the doors they go through together, and two ports next to each other
 * are swapped, each for as long as the crossings in all the cells are fewer.
 * Nothing about a route changes, so no line is longer.
 */
export function orderSession(
  space: Space,
  routes: GlobalRoutes,
  /**
   * The pitch of each pair of neighbours and the slot of each box's ports. Of two orders that cost
   * the same, the one decided by the lines' names puts a family together first, so twins stand
   * side by side wherever the order is not asked for by the crossings.
   */
  { pitch, slots, family }: Spacing,
  rooms?: ReadonlyMap<string, RouteRooms>,
): OrderSession {
  const paths = [...routes.routes.values()]
    .sort((p, q) => compare(p.line, q.line))
    .map((r) => ({ route: r, path: pathOf(space, r, rooms?.get(r.line)) }))
  const byLine = new Map(paths.map((p) => [p.path.line, p]))
  const { cells, doors } = space

  const sideIn = (cell: number, door: number): Dir => {
    const side = (cells[cell] as Cell).doors.find((d) => d.door === door)?.side ?? 'top'
    return SIDE[side]
  }
  const interval = (cell: number, door: number): [number, number, Dir] => {
    const d = doors[door]
    const c = cells[cell] as Cell
    const side = sideIn(cell, door)
    if (!d) return [0, 0, side]
    const [p0, p1] =
      d.normal === 'x'
        ? [
            { x: d.at, y: d.lo },
            { x: d.at, y: d.hi },
          ]
        : [
            { x: d.lo, y: d.at },
            { x: d.hi, y: d.at },
          ]
    const a = along(c, side, p0)
    const b = along(c, side, p1)
    return [Math.min(a, b), Math.max(a, b), side]
  }
  /** Where the ports stand along their cells' perimeters, where that is not where they were. */
  const portPos = new Map<string, number>()
  /** Where each line was estimated to cross each door, along the door. */
  const coordAt = new Map<number, Map<string, number>>()
  for (const { path } of paths) {
    for (const [j, s] of path.slots.entries()) {
      if (s.door === undefined) continue
      const d = doors[s.door]
      const m = coordAt.get(s.door) ?? new Map<string, number>()
      m.set(passing(path, j), d?.normal === 'x' ? s.est.y : s.est.x)
      coordAt.set(s.door, m)
    }
  }
  /**
   * The place of a slot along a cell's perimeter. A port is where it stands. A door's lines are
   * where they were estimated to cross it, taken in the order given (`ranked`, from the low end of
   * the door) and held a pitch apart, so that an order is a place without being an even spread over
   * the door, which would put them nowhere near the ports they are set against.
   */
  const posOf = (slot: Slot, cell: number, ranked?: readonly string[], line?: string): number => {
    if (slot.door === undefined) {
      return (slot.port ? portPos.get(slot.port) : undefined) ?? slot.pos ?? 0
    }
    const d = doors[slot.door]
    const c = cells[cell] as Cell
    const side = sideIn(cell, slot.door)
    const at = (v: number) =>
      along(c, side, d?.normal === 'x' ? { x: d.at, y: v } : { x: v, y: d?.at ?? 0 })
    const m = coordAt.get(slot.door)
    const index = ranked && line !== undefined ? ranked.indexOf(line) : -1
    if (!ranked || index < 0 || !m) {
      return Math.min(
        Math.max(along(c, side, slot.est), interval(cell, slot.door)[0]),
        interval(cell, slot.door)[1],
      )
    }
    const sorted = ranked.map((l) => m.get(l) ?? 0).sort((x, y) => x - y)
    let v = sorted[0] ?? 0
    for (let r = 1; r <= index; r++)
      v = Math.max(sorted[r] ?? 0, v + apart(ranked[r - 1], ranked[r]))
    return at(v)
  }
  // ---- the passings: a run is one, however many doors it goes through
  const pieces = new Map<string, Piece>()
  /** The pitch of two passings, which are of lines. */
  const apart = (a: string | undefined, b: string | undefined): number => {
    const line = (id: string | undefined) =>
      paths[pieces.get(id ?? '')?.path ?? -1]?.path.line ?? ''
    return pitch(line(a), line(b))
  }
  /** The passings at each door. */
  const at = new Map<number, Piece[]>()
  for (const [pi, { path }] of paths.entries()) {
    for (const [j, s] of path.slots.entries()) {
      if (s.door === undefined) continue
      const id = passing(path, j)
      let piece = pieces.get(id)
      if (!piece) {
        piece = {
          id,
          path: pi,
          slots: [],
          doors: new Map(),
          room: path.room.get(path.first[j] ?? j) ?? [
            Number.NEGATIVE_INFINITY,
            Number.POSITIVE_INFINITY,
          ],
        }
        pieces.set(id, piece)
      }
      piece.slots.push(j)
      piece.doors.set(s.door, j)
      at.set(s.door, [...(at.get(s.door) ?? []), piece])
    }
  }
  // The doors that a run joins are one corridor, and everything that goes through any of them is
  // ordered together: one order for a corridor, of which each door has the part that goes through it.
  const dsu = new Map<number, number>()
  const find = (d: number): number => {
    const parent = dsu.get(d) ?? d
    if (parent === d) return d
    const root = find(parent)
    dsu.set(d, root)
    return root
  }
  for (const piece of pieces.values()) {
    const ds = [...piece.doors.keys()]
    const head = ds[0]
    if (head === undefined) continue
    for (const d of ds.slice(1)) {
      const a = find(head)
      const b = find(d)
      if (a !== b) dsu.set(b, a)
    }
  }
  const classOf = (piece: Piece): number | undefined => {
    const d = piece.doors.keys().next().value
    return d === undefined ? undefined : find(d)
  }
  const classes = new Map<number, Piece[]>()
  for (const piece of [...pieces.values()].sort((x, y) => compare(x.id, y.id))) {
    const c = classOf(piece)
    if (c !== undefined) classes.set(c, [...(classes.get(c) ?? []), piece])
  }
  /** The order of each corridor, and where each passing stands in it. */
  const classList = new Map<number, string[]>()
  const pos = new Map<string, number>()
  const flips = (cell: number, a: number, b: number) =>
    sgn(sideIn(cell, a)) * sgn(sideIn(cell, b)) === 1

  /** What it costs `p` to be before `q` at their door, and which of the two orders is the preferred one. */
  const pairCosts = (p: Path, q: Path, jp: number, jq: number) => {
    const sq = p.cells[jp] === q.cells[jq] ? 1 : -1
    const doorOf = (path: Path, j: number) => path.slots[j]?.door
    let tmax = 0
    while (
      doorOf(p, jp + tmax + 1) !== undefined &&
      doorOf(p, jp + tmax + 1) === doorOf(q, jq + sq * (tmax + 1))
    ) {
      tmax++
    }
    let tmin = 0
    while (
      doorOf(p, jp + tmin - 1) !== undefined &&
      doorOf(p, jp + tmin - 1) === doorOf(q, jq + sq * (tmin - 1))
    ) {
      tmin--
    }
    const parity = new Map<number, boolean>([[0, false]])
    for (let t = 0; t < tmax; t++) {
      const cell = p.cells[jp + t] as number
      const a = doorOf(p, jp + t) as number
      const b = doorOf(p, jp + t + 1) as number
      parity.set(t + 1, (parity.get(t) ?? false) !== flips(cell, a, b))
    }
    for (let t = 0; t > tmin; t--) {
      const cell = p.cells[jp + t - 1] as number
      const a = doorOf(p, jp + t - 1) as number
      const b = doorOf(p, jp + t) as number
      parity.set(t - 1, (parity.get(t) ?? false) !== flips(cell, a, b))
    }
    const named = (path: Path, j: number) => joinKey([family(path.line), passing(path, j)])
    const preferred = compare(named(p, jp), named(q, jq)) < 0 !== (parity.get(tmin) ?? false)
    const end = (t: number, before: boolean, forward: boolean): number => {
      const cell = forward ? (p.cells[jp + t] as number) : (p.cells[jp + t - 1] as number)
      const shared = p.slots[jp + t]
      const otherP = forward ? p.slots[jp + t + 1] : p.slots[jp + t - 1]
      const otherQ =
        sq > 0
          ? forward
            ? q.slots[jq + t + 1]
            : q.slots[jq + t - 1]
          : forward
            ? q.slots[jq - t - 1]
            : q.slots[jq - t + 1]
      if (!shared || !otherP || !otherQ) return 0
      const first = before !== (parity.get(t) ?? false)
      const ep = passing(p, jp + t)
      const eq = passing(q, jq + sq * t)
      const both = first ? [ep, eq] : [eq, ep]
      const ps = posOf(shared, cell, both, ep)
      const qs = posOf(shared, cell, both, eq)
      return interleave(ps, posOf(otherP, cell), qs, posOf(otherQ, cell)) ? 1 : 0
    }
    const cost = (before: boolean) => end(tmax, before, true) + end(tmin, before, false)
    const weigh = (before: boolean) => 2 * cost(before) + (before === preferred ? 0 : 1)
    return { before: weigh(true), after: weigh(false) }
  }

  const order = new Map<number, string[]>()
  let approximated = 0
  /** Whether `a` cannot come before `b`: the room of `a` begins too far on for `b` to follow it. */
  const infeasible = (a: Piece, b: Piece) => a.room[0] + apart(a.id, b.id) > b.room[1] + EPS
  /** Puts a corridor in an order, and each of its doors in the part of it that goes through it. */
  const setClass = (root: number, ids: readonly string[]) => {
    classList.set(root, [...ids])
    for (const [i, id] of ids.entries()) pos.set(id, i)
    for (const piece of classes.get(root) ?? [])
      for (const d of piece.doors.keys()) order.set(d, [])
    for (const id of ids) {
      for (const d of pieces.get(id)?.doors.keys() ?? []) order.get(d)?.push(id)
    }
  }
  const orderClasses = () => {
    order.clear()
    approximated = 0
    for (const [root, members] of [...classes].sort((a, b) => a[0] - b[0])) {
      if (members.length < 2) {
        setClass(
          root,
          members.map((m) => m.id),
        )
        continue
      }
      // What no order can pay for, such as a line that a room leaves no place for before another,
      // costs more than all the crossings the corridor can have.
      const big = 3 * members.length * members.length + 1
      const index = new Map(members.map((m, i) => [m.id, i]))
      const memo = new Map<number, { before: number; after: number }>()
      const cost = (a: string, b: string): number => {
        const ia = index.get(a) ?? 0
        const ib = index.get(b) ?? 0
        // the members are in id order, so the pair is named by the one that comes first
        const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia]
        const key = lo * members.length + hi
        let c = memo.get(key)
        if (!c) {
          const p = members[lo]
          const q = members[hi]
          if (!p || !q) return 0
          let jp: number | undefined
          let jq: number | undefined
          for (const [d, j] of p.doors) {
            if (q.doors.has(d)) {
              jp = j
              jq = q.doors.get(d)
              break
            }
          }
          const base =
            jp === undefined || jq === undefined
              ? { before: 0, after: 0 }
              : pairCosts(
                  (paths[p.path] as (typeof paths)[number]).path,
                  (paths[q.path] as (typeof paths)[number]).path,
                  jp,
                  jq,
                )
          c = {
            before: base.before + (infeasible(p, q) ? big : 0),
            after: base.after + (infeasible(q, p) ? big : 0),
          }
          memo.set(key, c)
        }
        return ia < ib ? c.before : c.after
      }
      const result = laneOrder(
        members.map((m) => m.id),
        cost,
      )
      if (!result.exact) approximated++
      setClass(root, result.order)
    }
  }

  // ---- the crossings inside the cells, from the orders
  const chordList: Chord[] = []
  const chordRows: Chord[][] = []
  const chordsIn = new Map<number, Chord[]>()
  for (const [pi, { path }] of paths.entries()) {
    const row: Chord[] = []
    for (const [k, cell] of path.cells.entries()) {
      const c: Chord = { line: path.line, path: pi, k, cell, seq: chordList.length, p: 0, q: 0 }
      chordList.push(c)
      row.push(c)
      chordsIn.set(cell, [...(chordsIn.get(cell) ?? []), c])
    }
    chordRows.push(row)
  }
  /** Sets where a chord stands at both its ends, from the orders and the ports as they are. */
  const place = (c: Chord) => {
    const path = (paths[c.path] as (typeof paths)[number]).path
    const slot = (j: number) => path.slots[j] as Slot
    const ranked = (j: number) => {
      const door = slot(j).door
      return door === undefined ? undefined : order.get(door)
    }
    const pos = (j: number) => posOf(slot(j), c.cell, ranked(j), passing(path, j))
    c.p = pos(c.k)
    c.q = pos(c.k + 1)
  }
  /** Two chords cross if their ends interleave, measured from the earlier chord. */
  const crosses = (a: Chord, b: Chord) =>
    a.seq < b.seq ? interleave(a.p, a.q, b.p, b.q) : interleave(b.p, b.q, a.p, a.q)
  const count = () => {
    for (const c of chordList) place(c)
    let total = 0
    const perCell = new Map<number, number>()
    const pairs: [string, string][] = []
    for (const [cell, list] of chordsIn) {
      let n = 0
      for (const [i, a] of list.entries()) {
        for (const b of list.slice(i + 1)) {
          if (!crosses(a, b)) continue
          n++
          pairs.push([a.line, b.line])
        }
      }
      if (n > 0) perCell.set(cell, n)
      total += n
    }
    const chords = new Map(
      [...chordsIn].map(([cell, list]) => [cell, list.map(({ line, p, q }) => ({ line, p, q }))]),
    )
    return { total, perCell, pairs, chords }
  }
  /** The crossings that these chords make with the chords in their cells, each pair once. */
  const crossingsOf = (set: ReadonlySet<Chord>): number => {
    let n = 0
    for (const c of set) {
      for (const o of chordsIn.get(c.cell) ?? []) {
        if (o === c || (set.has(o) && o.seq < c.seq)) continue
        if (crosses(c, o)) n++
      }
    }
    return n
  }

  // ---- the ports: where each stands is not chosen but follows from the lines that leave them
  const groups = new Map<string, { line: string; end: 'a' | 'b'; anchor: Anchor; est: Point }[]>()
  for (const { route, path } of paths) {
    for (const [end, anchor, j] of [
      ['a', route.from, 0],
      ['b', route.to, path.slots.length - 1],
    ] as const) {
      const key = joinKey([anchor.cell, anchor.box, anchor.out])
      groups.set(key, [
        ...(groups.get(key) ?? []),
        { line: path.line, end, anchor, est: path.slots[j]?.est ?? anchor.lead },
      ])
    }
  }
  /**
   * The ports that stand together on one side of one box, and the places they stand at, in order
   * along the cell's perimeter. The ports of a side keep a slot from each other, so they stand in a
   * row about where the lines were estimated to leave, not on one point: on one point no two of
   * their chords could cross, and the order of the ports would count for nothing.
   */
  const portGroups = [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => {
      const first = g[0] as (typeof g)[number]
      const { out } = first.anchor
      const cell = cells[first.anchor.cell] as Cell
      const across = out === 0 || out === 2
      const coordOf = (p: Point) => (across ? p.y : p.x)
      const pointAt = (v: number): Point =>
        across ? { x: first.anchor.lead.x, y: v } : { x: v, y: first.anchor.lead.y }
      const perimeter = (v: number) => along(cell, turnAround(out), pointAt(v))
      const slot = slots.get(first.anchor.box) ?? 0
      const valid = g.map((m) => m.anchor.span).filter((sp) => sp[0] <= sp[1] + EPS)
      const [lo, hi] =
        valid.length > 0
          ? [Math.min(...valid.map((sp) => sp[0])), Math.max(...valid.map((sp) => sp[1]))]
          : across
            ? [cell.y0, cell.y1]
            : [cell.x0, cell.x1]
      const mean = g.reduce((sum, m) => sum + coordOf(m.est), 0) / g.length
      const row = slotRow(g.length, slot)
      const start = Math.max(lo, Math.min(mean - row.length / 2, hi - row.length))
      return {
        keys: g.map((m) => lineEnd(m.line, m.end)),
        places: row.offsets.map((offset) => perimeter(start + offset)).sort((p, q) => p - q),
        own: new Map(g.map((m) => [lineEnd(m.line, m.end), perimeter(coordOf(m.est))])),
        out,
        slot,
      }
    })
  /** The slot of a line at the first door from a port, if it has one: where the line leaves the cell. */
  const firstSlot = (key: string): { path: Path; j: number; door: number } | undefined => {
    const { line, end } = parseLineEnd(key)
    const path = byLine.get(line)?.path
    if (!path) return undefined
    const j = end === 'a' ? 1 : path.slots.length - 2
    const door = path.slots[j]?.door
    return door === undefined ? undefined : { path, j, door }
  }
  /**
   * The ports of one group in the order their chords cross none: a port's chord runs from its
   * place to where the line leaves the cell, the door and its place in the order there. The chords
   * of ports that stand in a row cross none if the ones whose lines leave below the row come
   * first, the nearest first, then the ones that leave above it, the nearest first, so the chords
   * lie inside one another. Nothing but the orders at the doors decides it.
   */
  /** Where a line that goes through no door leaves its cell: by the port at its other end, in the same cell. */
  const otherEnd = (key: string): number => {
    const { line, end } = parseLineEnd(key)
    const path = byLine.get(line)?.path
    const slot = end === 'a' ? path?.slots.at(-1) : path?.slots[0]
    return slot ? posOf(slot, cellOfEnd(key)) : 0
  }
  const deriveGroup = (group: (typeof portGroups)[number]) => {
    const lo = group.places[0] ?? 0
    const exits = new Map(
      group.keys.map((key) => {
        const f = firstSlot(key)
        const exit = f
          ? posOf(
              f.path.slots[f.j] as Slot,
              cellOfEnd(key),
              order.get(f.door),
              passing(f.path, f.j),
            )
          : otherEnd(key)
        return [key, exit] as const
      }),
    )
    const exit = (key: string) => exits.get(key) ?? lo
    const above = (key: string) => (exit(key) < lo ? 0 : 1)
    const sorted = [...group.keys].sort(
      (p, q) => above(p) - above(q) || exit(q) - exit(p) || compare(p, q),
    )
    settle(group, sorted)
  }
  /** The ports in the order the lines were estimated to leave in, which is where they stood. */
  const keepPorts = () => {
    for (const group of portGroups) {
      const sorted = [...group.keys].sort(
        (p, q) => (group.own.get(p) ?? 0) - (group.own.get(q) ?? 0) || compare(p, q),
      )
      settle(group, sorted)
    }
  }
  const cellOfEnd = (key: string): number => {
    const { line, end } = parseLineEnd(key)
    const path = byLine.get(line)?.path as Path
    return end === 'a' ? (path.cells[0] as number) : (path.cells.at(-1) as number)
  }
  const derivePorts = () => {
    for (const group of portGroups) deriveGroup(group)
  }
  /** The room a port's line has where it leaves its box: the room of the run that starts at it. */
  const windowOf = (key: string): [number, number] => {
    const { line, end } = parseLineEnd(key)
    const runs = rooms?.get(line)?.runs
    const room = end === 'a' ? runs?.[0] : runs?.at(-1)
    return room ? [room.lo, room.hi] : [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
  }
  /** The ports that, in the order their side has, have no room within the window their line leaves them. */
  const unfit = new Set<string>()
  /**
   * Puts the ports of a group in the places along the side, in the order given, and says which of
   * them that order leaves no room. Along the side, from the low end, each port stands a slot from
   * the one before or at the start of its window, whichever is later, and must stand before its
   * window ends; a port whose line leaves by a joint has the whole side for a window. The fewest
   * ports to take out of the row for the rest to stand so are found by keeping, for each number
   * kept, the earliest the row can end; of two ways to keep as many, the one that keeps the earlier
   * port. The ports taken out are `unfit`: the order is not changed for them, which would cross
   * more; their lines are to be laid again so that a joint frees the port of its door.
   */
  const settle = (group: (typeof portGroups)[number], sorted: readonly string[]) => {
    for (const key of group.keys) unfit.delete(key)
    const forward = group.out === 1 || group.out === 2
    const row = forward ? sorted : [...sorted].reverse()
    const { slot } = group
    /** For each count kept so far, the earliest the last kept stands, and whether each port was kept to reach it. */
    let best: (number | undefined)[] = [Number.NEGATIVE_INFINITY]
    const kept: boolean[][] = []
    for (const key of row) {
      const [lo, hi] = windowOf(key)
      const next: (number | undefined)[] = [...best]
      const took: boolean[] = []
      for (const [k, at] of best.entries()) {
        if (at === undefined) continue
        const here = at === Number.NEGATIVE_INFINITY ? lo : Math.max(lo, at + slot)
        if (here > hi + EPS) continue
        const was = next[k + 1]
        if (was === undefined || here < was - EPS) {
          next[k + 1] = here
          took[k + 1] = true
        }
      }
      kept.push(took)
      best = next
    }
    let k = best.length - 1
    while (k > 0 && best[k] === undefined) k--
    for (let i = row.length - 1; i >= 0; i--) {
      const key = row[i] as string
      if (kept[i]?.[k]) k--
      else unfit.add(key)
    }
    for (const [i, key] of sorted.entries()) portPos.set(key, group.places[i] ?? 0)
  }
  /**
   * The ports that have no room once the rows of the sides are taken together: a straight line
   * (one run) makes its two ports one value, so the rows of its two sides are one chain of orders,
   * and each row may have room by itself while the chain has none. Over all the rows and the
   * lines that join them, the earliest each port can stand is found from the start of its window
   * and the ports before it, and the latest from the end of its window and the ports after it;
   * where the earliest passes the latest the chain does not fit. Of the ports that join two rows
   * in such a chain, the one that falls shortest is given up: laid again with a joint, its line is
   * no longer straight and the rows come apart. One at a time, since what remains is settled again.
   */
  const unfitAcross = (): string[] => {
    // A row is one side of one box, through every cell the side faces, the cells in the order
    // they lie along the side; in a cell, the ports in the order of their places.
    const sides = new Map<string, { cell: number; at: number; keys: string[]; slot: number }[]>()
    for (const [groupKey, members] of groups) {
      const first = members[0]
      if (!first) continue
      const forward = first.anchor.out === 1 || first.anchor.out === 2
      const cell = cells[first.anchor.cell] as Cell
      const across = first.anchor.out === 0 || first.anchor.out === 2
      const byPlace = [...members]
        .map((m) => lineEnd(m.line, m.end))
        .sort((p, q) => (portPos.get(p) ?? 0) - (portPos.get(q) ?? 0) || compare(p, q))
      const [, box = '', out = ''] = splitKey(groupKey)
      const side = joinKey([box, out])
      sides.set(side, [
        ...(sides.get(side) ?? []),
        {
          cell: first.anchor.cell,
          at: across ? cell.y0 : cell.x0,
          keys: forward ? byPlace : [...byPlace].reverse(),
          slot: slots.get(first.anchor.box) ?? 0,
        },
      ])
    }
    const rows = [...sides.values()].map((parts) => {
      const ordered = [...parts].sort((p, q) => p.at - q.at || p.cell - q.cell)
      return { keys: ordered.flatMap((p) => p.keys), slot: ordered[0]?.slot ?? 0 }
    })
    const index = new Map<string, number>()
    for (const row of rows) for (const key of row.keys) index.set(key, index.size)
    const n = index.size
    if (n === 0) return []
    // the two ends of a straight line are one value
    const parent = Array.from({ length: n }, (_, i) => i)
    const find = (i: number): number => {
      let r = i
      while (parent[r] !== r) r = parent[r] ?? r
      let c = i
      while (c !== r) {
        const next = parent[c] ?? r
        parent[c] = r
        c = next
      }
      return r
    }
    const joined = new Set<string>()
    for (const { route } of paths) {
      if (route.runs.length !== 1) continue
      const a = index.get(`${route.line}.a`)
      const b = index.get(`${route.line}.b`)
      if (a === undefined || b === undefined) continue
      parent[find(a)] = find(b)
      joined.add(`${route.line}.a`)
      joined.add(`${route.line}.b`)
    }
    const lo = new Array<number>(n).fill(Number.NEGATIVE_INFINITY)
    const hi = new Array<number>(n).fill(Number.POSITIVE_INFINITY)
    for (const [key, i] of index) {
      const [a, b] = windowOf(key)
      const r = find(i)
      lo[r] = Math.max(lo[r] ?? 0, a)
      hi[r] = Math.min(hi[r] ?? 0, b)
    }
    const edges: { from: number; to: number; d: number }[] = []
    for (const row of rows) {
      for (const [k, key] of row.keys.entries()) {
        const next = row.keys[k + 1]
        if (next === undefined) continue
        edges.push({ from: find(index.get(key) ?? 0), to: find(index.get(next) ?? 0), d: row.slot })
      }
    }
    // the earliest and the latest, relaxed until nothing moves; a ring that grows without end is
    // one that no position satisfies, and is left at the point it reached
    const early = [...lo]
    const late = [...hi]
    for (let pass = 0; pass <= n; pass++) {
      let moved = false
      for (const e of edges) {
        const need = (early[e.from] ?? 0) + e.d
        if (Number.isFinite(need) && need > (early[e.to] ?? 0) + EPS) {
          early[e.to] = need
          moved = true
        }
        const cap = (late[e.to] ?? 0) - e.d
        if (Number.isFinite(cap) && cap < (late[e.from] ?? 0) - EPS) {
          late[e.from] = cap
          moved = true
        }
      }
      if (!moved) break
    }
    // the components, by the rows and the joins; the shortfall of each
    const comp = Array.from({ length: n }, (_, i) => find(i))
    const union = (a: number, b: number) => {
      const ra = comp[a] ?? a
      const rb = comp[b] ?? b
      for (let i = 0; i < n; i++) if (comp[i] === rb) comp[i] = ra
    }
    for (const e of edges) union(e.from, e.to)
    const short = new Map<number, number>()
    for (let i = 0; i < n; i++) {
      const r = find(i)
      const gap = (early[r] ?? 0) - (late[r] ?? 0)
      if (gap > EPS) short.set(comp[r] ?? r, Math.max(short.get(comp[r] ?? r) ?? 0, gap))
    }
    const out: string[] = []
    for (const [c] of short) {
      let pick: { key: string; gap: number; width: number } | undefined
      for (const [key, i] of index) {
        if (!joined.has(key) || (comp[find(i)] ?? 0) !== c) continue
        const r = find(i)
        const gap = (early[r] ?? 0) - (late[r] ?? 0)
        const [a, b] = windowOf(key)
        const width = b - a
        if (
          !pick ||
          gap > pick.gap + EPS ||
          (Math.abs(gap - pick.gap) <= EPS &&
            (width < pick.width - EPS ||
              (Math.abs(width - pick.width) <= EPS && compare(key, pick.key) < 0)))
        ) {
          pick = { key, gap, width }
        }
      }
      if (pick) out.push(pick.key)
    }
    return out
  }
  /** The groups whose ports leave by a run, by the run's name. */
  const leavingBy = new Map<string, number[]>()
  for (const [gi, group] of portGroups.entries()) {
    for (const key of group.keys) {
      const f = firstSlot(key)
      if (f)
        leavingBy.set(passing(f.path, f.j), [...(leavingBy.get(passing(f.path, f.j)) ?? []), gi])
    }
  }

  // For comparison: each door's lines in the order of where they were estimated to cross it.
  for (const [door, list] of at) {
    const d = doors[door]
    if (!d) continue
    const key = (o: Piece) => {
      const e = paths[o.path]?.path.slots[o.doors.get(door) ?? -1]?.est
      return e ? (d.normal === 'x' ? e.y : e.x) : 0
    }
    order.set(
      door,
      [...list].sort((p, q) => key(p) - key(q) || compare(p.id, q.id)).map((o) => o.id),
    )
  }
  const byEstimate = count().total

  keepPorts()
  orderClasses()
  const before = count()
  // The orders at the doors depend on where the ports stand and the ports on the orders, so each
  // is settled for the other in turn, for as long as that crosses less.
  let after = before
  let kept = new Map(portPos)
  let keptOrder = new Map(classList)
  for (let round = 0; round < paths.length; round++) {
    derivePorts()
    orderClasses()
    const now = count()
    if (now.total >= after.total) break
    after = now
    kept = new Map(portPos)
    keptOrder = new Map(classList)
  }
  portPos.clear()
  for (const [k, v] of kept) portPos.set(k, v)
  order.clear()
  for (const [root, ids] of keptOrder) setClass(root, ids)

  // ---- the orders and the ports, changed together along the bundles they belong to
  const lineIndex = new Map(paths.map((p, i) => [p.path.line, i]))
  const chordOfPort = (key: string): Chord | undefined => {
    const { line, end } = parseLineEnd(key)
    const row = chordRows[lineIndex.get(line) ?? -1]
    return end === 'a' ? row?.[0] : row?.at(-1)
  }

  /**
   * The passings to swap to swap two next to each other at a door: those two, and, on along the
   * doors the two lines go through together, the same two lines' runs where they are also next to
   * each other, so that the pair stays one bundle and does not cross itself in between. A run is
   * one passing however many doors it goes through, so what comes after the pair is the next run.
   */
  const stretchOf = (
    door: number,
    i: number,
  ): { centre: [string, string]; along: [string, string][][] } | undefined => {
    const list = order.get(door)
    const x = list?.[i]
    const y = list?.[i + 1]
    if (x === undefined || y === undefined) return undefined
    const px = pieces.get(x)
    const py = pieces.get(y)
    const ja = px?.doors.get(door)
    const jb = py?.doors.get(door)
    const p = px ? paths[px.path]?.path : undefined
    const q = py ? paths[py.path]?.path : undefined
    if (!px || !py || !p || !q || ja === undefined || jb === undefined || px.path === py.path) {
      return undefined
    }
    const sq = p.cells[ja] === q.cells[jb] ? 1 : -1
    const along = [1, -1].map((dir) => {
      const out: [string, string][] = []
      let last: [string, string] = [x, y]
      for (let t = dir; ; t += dir) {
        const d = p.slots[ja + t]?.door
        if (d === undefined || d !== q.slots[jb + sq * t]?.door) break
        const a = passing(p, ja + t)
        const b = passing(q, jb + sq * t)
        if (a === last[0] && b === last[1]) continue
        last = [a, b]
        out.push(last)
      }
      return out
    })
    return { centre: [x, y], along }
  }
  const moves = (): Move[] => {
    const out: Move[] = []
    // two runs next to each other at several doors are one change, which is made at them all
    const seen = new Set<string>()
    for (const [door, list] of [...order].sort((p, q) => p[0] - q[0])) {
      for (const at of list.slice(1).keys()) {
        const key = `${list[at]}|${list[at + 1]}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ kind: 'door', door, at })
      }
    }
    return out
  }

  let cellTotal = 0
  const total = () => cellTotal
  const exchange = <T>(list: T[], i: number, k: number) => {
    const x = list[i] as T
    list[i] = list[k] as T
    list[k] = x
  }
  /** Whether a run has a door that the other has too. */
  const shares = (x: Piece, y: Piece) => [...x.doors.keys()].some((d) => y.doors.has(d))
  /**
   * Swaps two runs in the order of their corridor, and at every door they go through together,
   * where they must be next to each other. The corridor has one order, so the swap is made only if
   * nothing between the two in it has a door with either, which would be moved past; and only if
   * the rooms let each stand where it is put. Gives how to undo it, or nothing if it cannot be made.
   */
  const swapRuns = (a: string, b: string): (() => void) | undefined => {
    const pa = pieces.get(a)
    const pb = pieces.get(b)
    const ca = pa ? classOf(pa) : undefined
    if (!pa || !pb || ca === undefined || ca !== classOf(pb)) return undefined
    const list = classList.get(ca)
    const i = pos.get(a)
    const k = pos.get(b)
    if (!list || i === undefined || k === undefined) return undefined
    const shared = [...pa.doors.keys()].filter((d) => pb.doors.has(d))
    for (const d of shared) {
      const o = order.get(d)
      if (!o || Math.abs(o.indexOf(a) - o.indexOf(b)) !== 1) return undefined
    }
    const [lo, hi] = i < k ? [i, k] : [k, i]
    for (const id of list.slice(lo + 1, hi)) {
      const r = pieces.get(id)
      if (r && (shares(r, pa) || shares(r, pb))) return undefined
    }
    const [early, late] = i < k ? [pb, pa] : [pa, pb]
    if (infeasible(early, late)) return undefined
    const flip = () => {
      list[i] = b
      list[k] = a
      pos.set(a, k)
      pos.set(b, i)
      for (const d of shared) {
        const o = order.get(d)
        const x = o?.indexOf(a) ?? -1
        const y = o?.indexOf(b) ?? -1
        if (o && x >= 0 && y >= 0) exchange(o, x, y)
      }
    }
    flip()
    return () => {
      // the same swap again puts them back, with their places as they now are
      const x = list.indexOf(a)
      const y = list.indexOf(b)
      list[x] = b
      list[y] = a
      pos.set(a, y)
      pos.set(b, x)
      for (const d of shared) {
        const o = order.get(d)
        const u = o?.indexOf(a) ?? -1
        const v = o?.indexOf(b) ?? -1
        if (o && u >= 0 && v >= 0) exchange(o, u, v)
      }
    }
  }

  /**
   * Makes a change and counts only what it touches: a swap of two runs moves the chords of the two
   * lines in the cells on either side of every door they go through, a swap of ports one chord
   * each, and a chord crosses only chords of its own cell. Gives how to take the change back, or
   * nothing if it cannot be made.
   */
  const apply = (move: Move): (() => void) | undefined => {
    const stretch = stretchOf(move.door, move.at)
    if (!stretch) return undefined
    const touched = new Set<Chord>()
    const touch = (id: string) => {
      const piece = pieces.get(id)
      const row = piece ? chordRows[piece.path] : undefined
      for (const j of piece?.slots ?? []) {
        for (const c of [row?.[j - 1], row?.[j]]) if (c) touched.add(c)
      }
    }
    const wanted = [stretch.centre, ...stretch.along.flat()]
    // the ports follow: those of the lines that leave by a run that is swapped are placed again
    const followed = new Set<number>()
    for (const [a, b] of wanted) {
      touch(a)
      touch(b)
      for (const g of [...(leavingBy.get(a) ?? []), ...(leavingBy.get(b) ?? [])]) followed.add(g)
    }
    const ports = [...followed].flatMap((g) => portGroups[g]?.keys ?? [])
    for (const key of ports) {
      const c = chordOfPort(key)
      if (c) touched.add(c)
    }
    if (touched.size === 0) return undefined
    const was = cellTotal
    const old = [...touched].map((c) => [c, c.p, c.q] as const)
    const oldPorts = ports.map((key) => [key, portPos.get(key)] as const)
    const before = crossingsOf(touched)
    const undone: (() => void)[] = []
    const swap = (a: string, b: string) => {
      const undo = swapRuns(a, b)
      if (undo) undone.push(undo)
      return undo !== undefined
    }
    const made = swap(...stretch.centre)
    // each way on from the pair goes as far as the swaps can be made
    if (made) for (const way of stretch.along) for (const [a, b] of way) if (!swap(a, b)) break
    if (!made) {
      for (const undo of undone.reverse()) undo()
      return undefined
    }
    for (const g of followed) {
      const group = portGroups[g]
      if (group) deriveGroup(group)
    }
    for (const c of touched) place(c)
    cellTotal += crossingsOf(touched) - before
    return () => {
      for (const undo of undone.reverse()) undo()
      for (const [key, v] of oldPorts) if (v !== undefined) portPos.set(key, v)
      for (const [c, p, q] of old) {
        c.p = p
        c.q = q
      }
      cellTotal = was
    }
  }

  let climbed: Climb = { tried: 0, accepted: 0, passes: 0, from: 0, to: 0 }
  return {
    moves,
    apply,
    total,
    recount: () => count().total,
    climb() {
      // the lists are the session's own from here, as they are changed in place
      for (const [door, list] of order) order.set(door, [...list])
      for (const [root, list] of classList) classList.set(root, [...list])
      cellTotal = count().total
      const from = total()
      let tried = 0
      let accepted = 0
      let passes = 0
      let better = true
      while (better) {
        better = false
        passes++
        for (const move of moves()) {
          const was = total()
          const undo = apply(move)
          if (!undo) continue
          tried++
          if (total() < was) {
            accepted++
            better = true
          } else {
            undo()
          }
        }
      }
      climbed = { tried, accepted, passes, from, to: total() }
      return climbed
    },
    ordering() {
      const final = count()
      return {
        doors: order,
        approximated,
        ports: portPos,
        crossings: final.total,
        crossingsBefore: before.total,
        crossingsByEstimate: byEstimate,
        crossingsSettled: after.total,
        climb: climbed,
        perCell: final.perCell,
        pairs: final.pairs,
        chords: final.chords,
        unfit: [...new Set([...unfit, ...(unfit.size === 0 ? unfitAcross() : [])])].sort(compare),
      }
    },
  }
}

/**
 * Where each line stands along every door it goes through (see `orderSession`), settled in the
 * ways that make no line longer.
 */
export function orderBundles(
  space: Space,
  routes: GlobalRoutes,
  spacing: Spacing,
  /** Whether to change the orders along the bundles, which is most of the time spent. */
  climb = true,
  rooms?: ReadonlyMap<string, RouteRooms>,
): Ordering {
  const session = orderSession(space, routes, spacing, rooms)
  if (climb) session.climb()
  return session.ordering()
}
