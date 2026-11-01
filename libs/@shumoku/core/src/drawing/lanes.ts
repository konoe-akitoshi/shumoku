// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type GlobalRoute, horizontal } from './global.js'
import { EPS } from './tolerance.js'

type Axis = 'x' | 'y'

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

/** One line as its pieces, where each end's port stands (the edge of its box), and how each piece is read. */
export interface Laid {
  pieces: Piece[]
  /** The coordinate of the edge of the box each end stands on, along the axis of the piece next to it. */
  fromEdge: number
  toEdge: number
}

export interface LaneOrder {
  before: Piece
  after: Piece
  /** Whether the end pieces decided it, or only where the two were estimated. */
  forced: boolean
}

/**
 * The order of the pieces of different lines that run side by side in a cell and share no door:
 * nothing at a door says how they stand, yet they may lie within a pitch of each other. Two
 * pieces along `axis` whose extents overlap and whose rooms let them come that close are put in
 * order. A piece is reached from either end by a piece along the other axis, which leaves it to
 * one side; where one of those crosses the other piece's extent, the other must be passed on the
 * side it leaves from, so that none crosses. Where nothing decides, the order is the one the rooms
 * can keep, and where both or neither can, the one they were estimated in. `value` reads where a piece is (estimated, or solved where it is), `room` where it
 * may lie, `same` whether two pieces are one value already.
 */
export function laneOrders(
  axis: Axis,
  lines: readonly Laid[],
  pitch: (p: Piece, q: Piece) => number,
  value: (p: Piece) => number,
  room: (p: Piece) => readonly [number, number],
  same: (p: Piece, q: Piece) => boolean,
): LaneOrder[] {
  interface P {
    piece: Piece
    a: number
    b: number
    stubs: { at: number; dir: number; len: number }[]
  }
  const list: P[] = []
  for (const item of lines) {
    const ps = item.pieces
    const last = ps.length - 1
    for (const [k, p] of ps.entries()) {
      if (p.axis !== axis) continue
      const here = value(p)
      const prev = ps[k - 1]
      const next = ps[k + 1]
      const a = prev ? value(prev) : item.fromEdge
      const b = next ? value(next) : item.toEdge
      const stubs: P['stubs'] = []
      if (prev) {
        const before = ps[k - 2]
        const origin = k - 1 === 0 || !before ? item.fromEdge : value(before)
        stubs.push({ at: a, dir: Math.sign(origin - here), len: Math.abs(origin - here) })
      }
      if (next) {
        const after = ps[k + 2]
        const far = k + 1 === last || !after ? item.toEdge : value(after)
        stubs.push({ at: b, dir: Math.sign(far - here), len: Math.abs(far - here) })
      }
      list.push({ piece: p, a: Math.min(a, b), b: Math.max(a, b), stubs })
    }
  }
  const near: [P, P][] = []
  for (const [i, p] of list.entries()) {
    for (const q of list.slice(i + 1)) {
      if (p.piece.line === q.piece.line || same(p.piece, q.piece)) continue
      if (Math.min(p.b, q.b) - Math.max(p.a, q.a) <= EPS) continue
      const [pl, ph] = room(p.piece)
      const [ql, qh] = room(q.piece)
      const apart = pitch(p.piece, q.piece)
      if (ph + apart <= ql + EPS || qh + apart <= pl + EPS) continue
      near.push([p, q])
    }
  }
  // Each leg of p that enters the extent of q asks for q on the side it leaves toward: it is
  // crossed by q on any other. Legs that leave in opposite directions are not cancelled, which
  // would leave the order to chance: whichever order is kept crosses the other leg, unless q
  // lies beyond its end, and a shorter leg is the easier to lie beyond, so the longer leg's
  // order is the one kept. Where they are as long, nothing is decided here.
  const forced = (p: P, q: P): number => {
    let r = 0
    for (const s of p.stubs) {
      if (s.at > q.a + EPS && s.at < q.b - EPS && s.dir !== 0) r += (s.dir < 0 ? 1 : -1) * s.len
    }
    return r
  }
  const out: LaneOrder[] = []
  for (const [p, q] of near) {
    const after = forced(p, q) - forced(q, p)
    if (after > 0) out.push({ before: p.piece, after: q.piece, forced: true })
    else if (after < 0) out.push({ before: q.piece, after: p.piece, forced: true })
    else {
      // Where the ends decide nothing, the rooms do: of the two orders, the one the rooms can
      // keep; where both can, or neither, the one they were estimated in.
      const [pl, ph] = room(p.piece)
      const [ql, qh] = room(q.piece)
      const apart = pitch(p.piece, q.piece)
      const pFirst = pl + apart <= qh + EPS
      const qFirst = ql + apart <= ph + EPS
      const d = value(p.piece) - value(q.piece)
      const first =
        pFirst === qFirst ? d < 0 || (d === 0 && compare(p.piece.line, q.piece.line) < 0) : pFirst
      out.push(
        first
          ? { before: p.piece, after: q.piece, forced: false }
          : { before: q.piece, after: p.piece, forced: false },
      )
    }
  }
  return out
}
