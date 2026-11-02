// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type GlobalRoute, horizontal } from './global.js'
import { EPS } from './tolerance.js'

export type Axis = 'x' | 'y'

/**
 * A straight piece of a line: one of its runs, or the short run across that a joint makes before
 * a run. Its coordinate is along `axis`; a run's is across its heading, a joint's across is along
 * the heading of the run before it. `k` is its place among the line's pieces in order.
 */
export interface Piece {
  line: string
  k: number
  axis: Axis
  kind: 'run' | 'across'
  /** The run it is, or the run the joint's run across comes before. */
  i: number
}

/** The straight pieces of a route in order: each run, with a joint's run across before it. */
export function piecesOf(route: GlobalRoute): Piece[] {
  const out: Piece[] = []
  for (const [i, run] of route.runs.entries()) {
    const axis: Axis = horizontal(run.head) ? 'y' : 'x'
    if (i > 0 && run.kind === 'joint') {
      out.push({
        line: route.line,
        k: out.length,
        axis: axis === 'x' ? 'y' : 'x',
        kind: 'across',
        i,
      })
    }
    out.push({ line: route.line, k: out.length, axis, kind: 'run', i })
  }
  return out
}

/** Where a piece ends along the axis across it: an unknown of that axis, or a fixed coordinate (the edge of a box). */
export type Bound = { v: number } | { at: number }

/**
 * A leg off one end of a piece: the piece next to it, which runs along this piece's axis. Where it
 * lies is the end it leaves from; which way it runs is what the route says of the piece next to
 * it (`dir`), and 0 where the route does not say (a joint that turns back); where it ends is the
 * piece two along, or the edge of the box the line leaves from.
 */
export interface Leg {
  at: Bound
  dir: 1 | -1 | 0
  to: Bound
}

/** -1 where `a` is before `b`, 1 after, 0 the same place; undefined where nothing decides it yet. */
export type Relation = -1 | 0 | 1 | undefined

/** How the pieces are read, by what the orders made so far and the rooms say: no coordinate is estimated. */
export interface Reading {
  /** The unknown a piece is, if it has one. */
  unknownOf(p: Piece): number | undefined
  /** The two ends of a piece along the axis across it. */
  ends(p: Piece): readonly [Bound, Bound]
  /** The legs off a piece's ends. */
  legs(p: Piece): readonly Leg[]
  /** How two ends stand along `axis`, as far as the orders and the rooms of that axis say. */
  compare(axis: Axis, a: Bound, b: Bound): Relation
  /** The room a piece may lie in. */
  room(p: Piece): readonly [number, number]
  /** Whether two pieces are one value already. */
  same(p: Piece, q: Piece): boolean
  /** The pitch two pieces keep. */
  pitch(p: Piece, q: Piece): number
  /** The radius the corners of a piece's line are rounded with. */
  radius?(p: Piece): number
}

export interface LaneOrder {
  before: Piece
  after: Piece
  /** Whether the legs decided it, or only the rooms and the names: the solve may put a free pair the other way. */
  forced: boolean
}

/** What the lane layer says of the pieces along one axis. */
export interface Lanes {
  /** Pairs that run side by side, in the order the legs force, or (`forced` false) the order the rooms can keep and the names give, for the solve to put the other way. */
  orders: LaneOrder[]
  /**
   * Pairs that may run side by side: whether their extents overlap, or which is first, turns on
   * an order along the other axis that is not made yet. The orders of the other axis may decide
   * them; what they leave is the solve's.
   */
  undecided: [Piece, Piece][]
}

const other = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x')

/**
 * Whether the extents of two pieces along the axis across them overlap, read from the relations
 * of their ends: certainly, certainly not, or not decided yet. Which end of a piece is the lower
 * is not needed: the two are apart when every end of one is at or before every end of the other.
 */
export function overlap(r: Reading, p: Piece, q: Piece): boolean | undefined {
  const axis = other(p.axis)
  const pe = r.ends(p)
  const qe = r.ends(q)
  const allBefore = (xs: readonly Bound[], ys: readonly Bound[]): boolean | undefined => {
    let sure = true
    for (const x of xs) {
      for (const y of ys) {
        const c = r.compare(axis, x, y)
        if (c === 1) return false
        if (c === undefined) sure = false
      }
    }
    return sure ? true : undefined
  }
  const pq = allBefore(pe, qe)
  const qp = allBefore(qe, pe)
  if (pq === true || qp === true) return false
  const anyAfter = (xs: readonly Bound[], ys: readonly Bound[]) =>
    xs.some((x) => ys.some((y) => r.compare(axis, x, y) === 1))
  if (anyAfter(pe, qe) && anyAfter(qe, pe)) return true
  return undefined
}

/**
 * The side of `p` that `q` must lie on, because a leg of `p` runs into the extent of `q` and would
 * be crossed by `q` on the other side: 1 for after `p`, -1 for before, 0 where no leg decides, and
 * undefined where it turns on something not decided yet, or the two legs ask for opposite sides.
 * A leg that `q` lies beyond the end of does not reach `q` and asks nothing.
 */
export function forcedSide(r: Reading, p: Piece, q: Piece): Relation {
  const axis = p.axis
  const across = other(axis)
  const qe = r.ends(q)
  const qu = r.unknownOf(q)
  if (qu === undefined) return 0
  const qv: Bound = { v: qu }
  let want: -1 | 0 | 1 = 0
  for (const leg of r.legs(p)) {
    const c0 = r.compare(across, leg.at, qe[0])
    const c1 = r.compare(across, leg.at, qe[1])
    const inside = (c0 === 1 && c1 === -1) || (c0 === -1 && c1 === 1)
    const outside = c0 === 0 || c1 === 0 || (c0 !== undefined && c0 === c1)
    if (outside) continue
    if (leg.dir === 0) return undefined
    const beyond = leg.dir < 0 ? r.compare(axis, qv, leg.to) : r.compare(axis, leg.to, qv)
    if (beyond === -1 || beyond === 0) continue
    if (!inside) return undefined
    const side: -1 | 1 = leg.dir < 0 ? 1 : -1
    if (want !== 0 && want !== side) return undefined
    want = side
  }
  return want
}

/**
 * How many misreadings an order of two pieces makes, on a solution of both axes (`value`): each
 * leg it crosses, and each crossing that is also read as the lines running on into each other.
 * A crossed leg crosses the other piece where the two lines part, and its own piece turns at
 * once; the other piece runs on to its own leg. Where that leg runs the opposite way to the
 * crossed one, the two stand end to end across the pair, and if they are no farther apart than
 * the two lines' corner radii, the step from the one to the other is no bigger than the S that
 * one line's own step is drawn as: the two legs read as one line and the lines as swapped. That
 * is a misreading as much as the crossing is, and counts as one.
 */
export function misreadings(
  r: Reading,
  p: Piece,
  q: Piece,
  pFirst: boolean,
  value: (axis: Axis, b: Bound) => number,
): number {
  const axis = p.axis
  const across = other(axis)
  const pu = r.unknownOf(p)
  const qu = r.unknownOf(q)
  if (pu === undefined || qu === undefined) return 0
  const a = value(axis, { v: pu })
  const b = value(axis, { v: qu })
  const [lo, hi] = [Math.min(a, b), Math.max(a, b)]
  const crossed: [Piece, Leg, Piece][] = []
  for (const [x, z, xAt, zAt] of [
    [p, q, pFirst ? lo : hi, pFirst ? hi : lo],
    [q, p, pFirst ? hi : lo, pFirst ? lo : hi],
  ] as const) {
    const ze = r.ends(z).map((e) => value(across, e))
    const toward = zAt > xAt ? 1 : -1
    for (const leg of r.legs(x)) {
      if (leg.dir !== toward) continue
      const at = value(across, leg.at)
      if (at <= Math.min(...ze) + EPS || at >= Math.max(...ze) - EPS) continue
      if ((value(axis, leg.to) - zAt) * leg.dir <= EPS) continue
      crossed.push([x, leg, z])
    }
  }
  let n = crossed.length
  for (const [x, leg, z] of crossed) {
    const at = value(across, leg.at)
    const reach = (r.radius?.(x) ?? 0) + (r.radius?.(z) ?? 0)
    const readAsOne = r
      .legs(z)
      .some((own) => own.dir === -leg.dir && Math.abs(value(across, own.at) - at) <= reach + EPS)
    if (readAsOne) n++
  }
  return n
}

/**
 * The order of the pieces of different lines that run side by side in a cell and share no door:
 * nothing at a door says how they stand, yet they may lie within a pitch of each other. Whether
 * two pieces along `axis` run side by side is whether their extents along the other axis
 * overlap, which is read from the orders of that axis and the rooms (`overlap`), not from where
 * anything was estimated. A piece is reached from either end by a leg along the other axis; where
 * a leg runs into the other piece's extent, the other must be passed on the side the leg leaves
 * from, so that none crosses (`forcedSide`). Where nothing decides, the order is the one the
 * rooms can keep, and where both or neither can, the one the names give; the solve may put such
 * a pair the other way. Where what decides is an order along the other axis that is not made
 * yet, the pair is left undecided.
 */
export function laneOrders(
  axis: Axis,
  pieces: readonly Piece[],
  r: Reading,
  /**
   * The pairs to look at, where not every pair: the orders only grow, so a pair once decided
   * stays decided, and after a first look only the pairs it left open need another.
   */
  candidates?: readonly [Piece, Piece][],
): Lanes {
  const list = pieces.filter((p) => p.axis === axis)
  // each piece is read once: its ends, legs and room do not change while the pairs are looked at
  const ends = new Map(list.map((p) => [p, r.ends(p)]))
  const legs = new Map(list.map((p) => [p, r.legs(p)]))
  const rooms = new Map(list.map((p) => [p, r.room(p)]))
  const read: Reading = {
    ...r,
    ends: (p) => ends.get(p) ?? r.ends(p),
    legs: (p) => legs.get(p) ?? r.legs(p),
    room: (p) => rooms.get(p) ?? r.room(p),
  }
  const orders: LaneOrder[] = []
  const undecided: [Piece, Piece][] = []
  const pairs: Iterable<readonly [Piece, Piece]> =
    candidates ??
    (function* () {
      for (const [i, p] of list.entries()) for (const q of list.slice(i + 1)) yield [p, q] as const
    })()
  for (const [p, q] of pairs) {
    {
      const [pl, ph] = read.room(p)
      if (p.line === q.line) continue
      const [ql, qh] = read.room(q)
      const apart = read.pitch(p, q)
      if (ph + apart <= ql + EPS || qh + apart <= pl + EPS || read.same(p, q)) continue
      const over = overlap(read, p, q)
      if (over === false) continue
      if (over === undefined) {
        undecided.push([p, q])
        continue
      }
      const fp = forcedSide(read, p, q)
      const fq = forcedSide(read, q, p)
      if (fp === undefined || fq === undefined) {
        undecided.push([p, q])
        continue
      }
      // each leg's ask, as the side of the pair's first piece: both may ask, and must agree
      const pFirst = fp === 1 || fq === -1
      const qFirst = fp === -1 || fq === 1
      if (pFirst !== qFirst) {
        orders.push(
          pFirst ? { before: p, after: q, forced: true } : { before: q, after: p, forced: true },
        )
        continue
      }
      // nothing decides, or the two legs disagree: of the two orders, the one the rooms can
      // keep; where both can, or neither, the one the names give
      const pFits = pl + apart <= qh + EPS
      const qFits = ql + apart <= ph + EPS
      const first = pFits === qFits ? compare(p.line, q.line) < 0 : pFits
      orders.push(
        first ? { before: p, after: q, forced: false } : { before: q, after: p, forced: false },
      )
    }
  }
  return { orders, undecided }
}
