// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey } from '../structure/keys.js'
import { laneOrder } from './crossing.js'
import { interleave } from './global.js'
import type { Spacing } from './kin.js'
import { type Path, type Paths, type Piece, passing, posOf, sgn, sideIn } from './order-paths.js'
import { EPS } from './tolerance.js'

/**
 * The second stage of the order: the doors that a run joins are one corridor, and everything that
 * goes through any of them is ordered together. Read once from the paths and never written after.
 */
export interface Corridors {
  /** The runs of each corridor, by the corridor's first door, in the order of their names. */
  classes: Map<number, Piece[]>
  /** The corridor a run is in. */
  classOf(piece: Piece): number | undefined
}

export function corridorsOf(g: Paths): Corridors {
  const parents = new Map<number, number>()
  const rootOf = (d: number): number => {
    const parent = parents.get(d) ?? d
    if (parent === d) return d
    const root = rootOf(parent)
    parents.set(d, root)
    return root
  }
  for (const piece of g.pieces.values()) {
    const ds = [...piece.doors.keys()]
    const head = ds[0]
    if (head === undefined) continue
    for (const d of ds.slice(1)) {
      const a = rootOf(head)
      const b = rootOf(d)
      if (a !== b) parents.set(b, a)
    }
  }
  const classOf = (piece: Piece): number | undefined => {
    const d = piece.doors.keys().next().value
    return d === undefined ? undefined : rootOf(d)
  }
  const classes = new Map<number, Piece[]>()
  for (const piece of [...g.pieces.values()].sort((x, y) => compare(x.id, y.id))) {
    const c = classOf(piece)
    if (c !== undefined) classes.set(c, [...(classes.get(c) ?? []), piece])
  }
  return { classes, classOf }
}

/** The orders of the lines: what this stage gives, and what the climb after it changes in place. */
export interface Orders {
  /** The passings at each door, from the low end of the door to the high end. */
  order: Map<number, string[]>
  /** The order of each corridor. */
  classList: Map<number, string[]>
  /** Where each passing stands in its corridor's order. */
  pos: Map<string, number>
  /** How many corridors were ordered by a search that is not exhaustive. */
  approximated: number
}

/** Each door's lines in the order of where they were estimated to cross it. */
export function orderByEstimate(g: Paths): Map<number, string[]> {
  const order = new Map<number, string[]>()
  for (const [door, list] of g.at) {
    const d = g.space.doors[door]
    if (!d) continue
    const key = (o: Piece) => {
      const e = g.lines[o.path]?.path.slots[o.doors.get(door) ?? -1]?.est
      return e ? (d.normal === 'x' ? e.y : e.x) : 0
    }
    order.set(
      door,
      [...list].sort((p, q) => key(p) - key(q) || compare(p.id, q.id)).map((o) => o.id),
    )
  }
  return order
}

/** Whether `a` cannot come before `b`: the room of `a` begins too far on for `b` to follow it. */
export const infeasible = (g: Paths, a: Piece, b: Piece) =>
  a.room[0] + g.apart(a.id, b.id) > b.room[1] + EPS

/** Puts a corridor in an order, and each of its doors in the part of it that goes through it. */
function setClass(g: Paths, c: Corridors, orders: Orders, root: number, ids: readonly string[]) {
  orders.classList.set(root, [...ids])
  for (const [i, id] of ids.entries()) orders.pos.set(id, i)
  for (const piece of c.classes.get(root) ?? [])
    for (const d of piece.doors.keys()) orders.order.set(d, [])
  for (const id of ids) {
    for (const d of g.pieces.get(id)?.doors.keys() ?? []) orders.order.get(d)?.push(id)
  }
}

const flips = (g: Paths, cell: number, a: number, b: number) =>
  sgn(sideIn(g, cell, a)) * sgn(sideIn(g, cell, b)) === 1

/** What it costs `p` to be before `q` at their door, and which of the two orders is the preferred one. */
function pairCosts(
  g: Paths,
  ports: ReadonlyMap<string, number>,
  family: Spacing['family'],
  p: Path,
  q: Path,
  jp: number,
  jq: number,
) {
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
    parity.set(t + 1, (parity.get(t) ?? false) !== flips(g, cell, a, b))
  }
  for (let t = 0; t > tmin; t--) {
    const cell = p.cells[jp + t - 1] as number
    const a = doorOf(p, jp + t - 1) as number
    const b = doorOf(p, jp + t) as number
    parity.set(t - 1, (parity.get(t) ?? false) !== flips(g, cell, a, b))
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
    const ps = posOf(g, ports, shared, cell, both, ep)
    const qs = posOf(g, ports, shared, cell, both, eq)
    return interleave(ps, posOf(g, ports, otherP, cell), qs, posOf(g, ports, otherQ, cell)) ? 1 : 0
  }
  const cost = (before: boolean) => end(tmax, before, true) + end(tmin, before, false)
  const weigh = (before: boolean) => 2 * cost(before) + (before === preferred ? 0 : 1)
  return { before: weigh(true), after: weigh(false) }
}

/**
 * Puts each corridor in the order that crosses least with the ports where `ports` has them, and
 * each of its doors in the part of it that goes through it. Of two orders that cost the same, the
 * one decided by the lines' names puts a family together first, so twins stand side by side
 * wherever the order is not asked for by the crossings.
 */
export function orderClasses(
  g: Paths,
  c: Corridors,
  ports: ReadonlyMap<string, number>,
  family: Spacing['family'],
): Orders {
  const orders: Orders = {
    order: new Map(),
    classList: new Map(),
    pos: new Map(),
    approximated: 0,
  }
  for (const [root, members] of [...c.classes].sort((a, b) => a[0] - b[0])) {
    if (members.length < 2) {
      setClass(
        g,
        c,
        orders,
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
      let cached = memo.get(key)
      if (!cached) {
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
                g,
                ports,
                family,
                (g.lines[p.path] as (typeof g.lines)[number]).path,
                (g.lines[q.path] as (typeof g.lines)[number]).path,
                jp,
                jq,
              )
        cached = {
          before: base.before + (infeasible(g, p, q) ? big : 0),
          after: base.after + (infeasible(g, q, p) ? big : 0),
        }
        memo.set(key, cached)
      }
      return ia < ib ? cached.before : cached.after
    }
    const result = laneOrder(
      members.map((m) => m.id),
      cost,
    )
    if (!result.exact) orders.approximated++
    setClass(g, c, orders, root, result.order)
  }
  return orders
}
