// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { laneOrder } from './crossing.js'
import {
  along,
  type Dir,
  type GlobalRoute,
  type GlobalRoutes,
  interleave,
  replay,
  SIDE,
  turnAround,
} from './global.js'
import type { Point } from './metrics.js'
import type { Cell, Space } from './space.js'

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

/** A route as the places it passes: slot `k` and `k + 1` are the two ends of the chord across cell `k`. */
export interface Path {
  line: string
  slots: Slot[]
  cells: number[]
}

export function pathOf(space: Space, r: GlobalRoute): Path {
  const { hops, last } = replay(space, r)
  const cells = [r.from.cell, ...r.steps.map((s) => s.into)]
  const tail = space.cells[last.cell] as Cell
  return {
    line: r.line,
    cells,
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
 * A line at a door. A line may go through one door twice, up a column and back down it, so what
 * is ordered at a door is such a passing, named by the line and the place in its route.
 */
export const passing = (path: Path, j: number): string => `${path.line}@${j}`

/** Which way the perimeter of a cell runs along a door on `side`, against the door's own low-to-high. */
const sgn = (side: Dir): 1 | -1 => (side === 3 || side === 0 ? 1 : -1)

export interface Ordering {
  /** The passings of lines at each door (see `passing`), from the low end of the door to the high end. A band's door is left out. */
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
  perCell: Map<number, number>
  /** The lines of each crossing counted in `crossings`, one pair for each, with the cells' order. */
  pairs: [string, string][]
  /** Where each line runs across each cell, as places along the cell's perimeter, once ordered. */
  chords: Map<number, { line: string; p: number; q: number }[]>
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
 */
export function orderBundles(space: Space, routes: GlobalRoutes, pitch: number): Ordering {
  const paths = [...routes.routes.values()]
    .sort((p, q) => compare(p.line, q.line))
    .map((r) => ({ route: r, path: pathOf(space, r) }))
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
   * the door, which would put them nowhere near the ports and bands they are set against.
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
    for (let r = 1; r <= index; r++) v = Math.max(sorted[r] ?? 0, v + pitch)
    return at(v)
  }
  const isBand = (cell: number) => (cells[cell] as Cell).band !== undefined
  const bandDoor = (door: number | undefined) => {
    const d = door === undefined ? undefined : doors[door]
    return d !== undefined && (isBand(d.a) || isBand(d.b))
  }
  /**
   * Where the end of a chord that is at a band's door stands: the lines go straight up into a
   * band and straight down out of it, and the band chooses its own order, so the chord is taken
   * to stand over the place it comes from.
   */
  const mirror = (
    band: Slot,
    other: Slot,
    cell: number,
    ranked: readonly string[] | undefined,
    line: string,
  ): number => {
    const od = other.door === undefined ? undefined : doors[other.door]
    const bd = band.door === undefined ? undefined : doors[band.door]
    if (!od || !bd || od.normal !== 'y' || bandDoor(other.door)) return posOf(band, cell)
    const m = coordAt.get(other.door ?? -1)
    const i = ranked ? ranked.indexOf(line) : -1
    if (!m || !ranked || i < 0) return posOf(band, cell)
    const sorted = ranked.map((l) => m.get(l) ?? 0).sort((x, y) => x - y)
    let v = sorted[0] ?? 0
    for (let r = 1; r <= i; r++) v = Math.max(sorted[r] ?? 0, v + pitch)
    return along(cells[cell] as Cell, sideIn(cell, band.door ?? 0), { x: v, y: bd.at })
  }

  // ---- the order at each door
  const at = new Map<number, { e: string; path: Path; j: number }[]>()
  for (const { path } of paths) {
    for (const [j, s] of path.slots.entries()) {
      if (s.door === undefined) continue
      at.set(s.door, [...(at.get(s.door) ?? []), { e: passing(path, j), path, j }])
    }
  }
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
    const preferred = compare(passing(p, jp), passing(q, jq)) < 0 !== (parity.get(tmin) ?? false)
    const end = (t: number, before: boolean, forward: boolean): number => {
      const cell = forward ? (p.cells[jp + t] as number) : (p.cells[jp + t - 1] as number)
      if (isBand(cell)) return 0
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
      const other = (o: Slot, e: string) =>
        bandDoor(o.door) ? mirror(o, shared, cell, both, e) : posOf(o, cell)
      return interleave(ps, other(otherP, ep), qs, other(otherQ, eq)) ? 1 : 0
    }
    const cost = (before: boolean) => end(tmax, before, true) + end(tmin, before, false)
    const weigh = (before: boolean) => 2 * cost(before) + (before === preferred ? 0 : 1)
    return { before: weigh(true), after: weigh(false) }
  }

  const order = new Map<number, string[]>()
  let approximated = 0
  const orderDoors = () => {
    order.clear()
    approximated = 0
    for (const [door, list] of [...at].sort((a, b) => a[0] - b[0])) {
      const d = doors[door]
      if (!d || isBand(d.a) || isBand(d.b)) continue
      if (list.length < 2) {
        order.set(
          door,
          list.map((o) => o.e),
        )
        continue
      }
      const sorted = [...list].sort((x, y) => compare(x.e, y.e))
      const by = new Map(sorted.map((o) => [o.e, o]))
      const memo = new Map<string, { before: number; after: number }>()
      const cost = (a: string, b: string): number => {
        const [lo, hi] = compare(a, b) < 0 ? [a, b] : [b, a]
        const key = `${lo}\0${hi}`
        let c = memo.get(key)
        if (!c) {
          const p = by.get(lo)
          const q = by.get(hi)
          if (!p || !q) return 0
          c = pairCosts(p.path, q.path, p.j, q.j)
          memo.set(key, c)
        }
        return a === lo ? c.before : c.after
      }
      const result = laneOrder(
        sorted.map((o) => o.e),
        cost,
      )
      if (!result.exact) approximated++
      order.set(door, result.order)
    }
  }

  // ---- the crossings inside the cells, from the orders
  const count = () => {
    const chords = new Map<number, { line: string; p: number; q: number }[]>()
    for (const { path } of paths) {
      const n = path.slots.length
      for (let k = 0; k + 1 < n; k++) {
        const cell = path.cells[k] as number
        const slot = (j: number) => path.slots[j] as Slot
        const ranked = (j: number) => {
          const door = slot(j).door
          return door === undefined ? undefined : order.get(door)
        }
        const pos = (j: number, partner: number) =>
          bandDoor(slot(j).door)
            ? mirror(slot(j), slot(partner), cell, ranked(partner), passing(path, partner))
            : posOf(slot(j), cell, ranked(j), passing(path, j))
        const list = chords.get(cell) ?? []
        list.push({ line: path.line, p: pos(k, k + 1), q: pos(k + 1, k) })
        chords.set(cell, list)
      }
    }
    let total = 0
    const perCell = new Map<number, number>()
    const pairs: [string, string][] = []
    for (const [cell, list] of chords) {
      if (isBand(cell)) continue
      let n = 0
      for (const [i, a] of list.entries()) {
        for (const b of list.slice(i + 1)) {
          if (!interleave(a.p, a.q, b.p, b.q)) continue
          n++
          pairs.push([a.line, b.line])
        }
      }
      if (n > 0) perCell.set(cell, n)
      total += n
    }
    return { total, perCell, pairs, chords }
  }

  // ---- the ports: swapped among their places where that lets their lines cross less
  const groups = new Map<string, { line: string; end: 'a' | 'b'; pos: number }[]>()
  for (const { route, path } of paths) {
    for (const [end, anchor, j] of [
      ['a', route.from, 0],
      ['b', route.to, path.slots.length - 1],
    ] as const) {
      const key = `${anchor.cell}\0${anchor.box}\0${anchor.out}`
      groups.set(key, [
        ...(groups.get(key) ?? []),
        { line: path.line, end, pos: path.slots[j]?.pos ?? 0 },
      ])
    }
  }
  const reorderPorts = () => {
    for (const group of groups.values()) {
      if (group.length < 2) continue
      const exits = new Map<string, number>(
        group.map((g) => {
          const path = byLine.get(g.line)?.path as Path
          const j = g.end === 'a' ? 1 : path.slots.length - 2
          const cell = g.end === 'a' ? (path.cells[0] as number) : (path.cells.at(-1) as number)
          const slot = path.slots[j] as Slot
          const ranked = slot.door === undefined ? undefined : order.get(slot.door)
          return [`${g.line}.${g.end}`, posOf(slot, cell, ranked, passing(path, j))] as const
        }),
      )
      const slots = group.map((g) => g.pos).sort((p, q) => p - q)
      const now = (key: string) => portPos.get(key) ?? byKey.get(key)?.pos ?? 0
      const byKey = new Map(group.map((g) => [`${g.line}.${g.end}`, g]))
      const keys = [...byKey.keys()].sort((p, q) => now(p) - now(q))
      const cost = (a: string, b: string) => {
        const [lo, hi] = [Math.min(now(a), now(b)), Math.max(now(a), now(b))]
        return interleave(lo, exits.get(a) ?? 0, hi, exits.get(b) ?? 0) ? 1 : 0
      }
      const result = laneOrder(keys, cost)
      if (!result.exact) approximated++
      for (const [i, key] of result.order.entries()) portPos.set(key, slots[i] ?? 0)
    }
  }

  // For comparison: each door's lines in the order of where they were estimated to cross it.
  for (const [door, list] of at) {
    const d = doors[door]
    if (!d || isBand(d.a) || isBand(d.b)) continue
    const key = (o: { path: Path; j: number }) => {
      const e = o.path.slots[o.j]?.est
      return e ? (d.normal === 'x' ? e.y : e.x) : 0
    }
    order.set(
      door,
      [...list].sort((p, q) => key(p) - key(q) || compare(p.e, q.e)).map((o) => o.e),
    )
  }
  const byEstimate = count().total

  orderDoors()
  const before = count()
  // The orders at the doors depend on where the ports stand and the ports on the orders, so each
  // is settled for the other in turn, for as long as that crosses less.
  let after = before
  let kept = new Map(portPos)
  let keptOrder = new Map(order)
  for (let round = 0; round < paths.length; round++) {
    reorderPorts()
    orderDoors()
    const now = count()
    if (now.total >= after.total) break
    after = now
    kept = new Map(portPos)
    keptOrder = new Map(order)
  }
  portPos.clear()
  for (const [k, v] of kept) portPos.set(k, v)
  order.clear()
  for (const [k, v] of keptOrder) order.set(k, v)
  after = count()

  return {
    doors: order,
    approximated,
    ports: portPos,
    crossings: after.total,
    crossingsBefore: before.total,
    crossingsByEstimate: byEstimate,
    perCell: after.perCell,
    pairs: after.pairs,
    chords: after.chords,
  }
}

/**
 * The lanes of a band, which is one channel with its terminals all on one side: the lines are
 * stretches of it from where they come in to where they go out. A stretch inside another is in
 * a lane nearer the terminals, stretches apart share a lane, and two that interlock must be on
 * different lanes and cross once, whichever order they take. The lanes are given to the shortest
 * stretches first, each the nearest lane its inside neighbours and its overlapping ones leave.
 */
export function bandLanes(spans: readonly { line: string; lo: number; hi: number }[]): {
  lane: Map<string, number>
  lanes: number
  crossings: number
} {
  const order = [...spans].sort(
    (p, q) => p.hi - p.lo - (q.hi - q.lo) || p.lo - q.lo || compare(p.line, q.line),
  )
  const lane = new Map<string, number>()
  const placed: { line: string; lo: number; hi: number }[] = []
  let crossings = 0
  for (const s of order) {
    const overlapping = placed.filter((o) => s.lo < o.hi && o.lo < s.hi)
    const inside = overlapping.filter((o) => s.lo <= o.lo && o.hi <= s.hi)
    let l = inside.reduce((m, o) => Math.max(m, (lane.get(o.line) ?? 0) + 1), 0)
    while (overlapping.some((o) => lane.get(o.line) === l)) l++
    lane.set(s.line, l)
    for (const o of overlapping) {
      if (!inside.includes(o)) crossings++
    }
    placed.push(s)
  }
  return { lane, lanes: placed.length === 0 ? 0 : Math.max(...lane.values()) + 1, crossings }
}

/**
 * The stretches the lines laid over the drawing take in a band: where each comes up into it and
 * goes down out of it, as places along the band in the order of the doors they come through. Two
 * lines that come through one door at one place are told apart by their rank in the door before.
 */
export function bandSpans(
  space: Space,
  routes: GlobalRoutes,
  ordering: Ordering,
  band: 'top' | 'bottom',
): { line: string; lo: number; hi: number }[] {
  const id = space.bands[band]
  if (id === undefined) return []
  const keyed: { line: string; x: number; t: number }[] = []
  for (const r of routes.routes.values()) {
    const path = pathOf(space, r)
    const ends: { x: number; t: number }[] = []
    for (const [j, s] of path.slots.entries()) {
      if (s.door === undefined) continue
      const touches = path.cells[j] === id || path.cells[j - 1] === id
      if (!touches) continue
      const before = path.slots[j - 1]
      const list = before?.door === undefined ? undefined : ordering.doors.get(before.door)
      const t = list && j > 0 ? Math.max(0, list.indexOf(passing(path, j - 1))) : 0
      ends.push({ x: s.est.x, t })
    }
    if (ends.length >= 2) {
      const [a, b] = ends
      if (a && b) {
        keyed.push({ line: r.line, x: a.x, t: a.t }, { line: r.line, x: b.x, t: b.t })
      }
    }
  }
  const sorted = [...keyed.keys()].sort((p, q) => {
    const a = keyed[p] as (typeof keyed)[number]
    const b = keyed[q] as (typeof keyed)[number]
    return a.x - b.x || a.t - b.t || compare(a.line, b.line) || p - q
  })
  const ordinal = new Map(sorted.map((k, i) => [k, i]))
  const out = new Map<string, number[]>()
  for (const [k, e] of keyed.entries())
    out.set(e.line, [...(out.get(e.line) ?? []), ordinal.get(k) ?? 0])
  return [...out].map(([line, v]) => ({ line, lo: Math.min(...v), hi: Math.max(...v) }))
}
