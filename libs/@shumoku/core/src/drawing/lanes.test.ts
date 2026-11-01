// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { GlobalRoute } from './global.js'
import {
  type Bound,
  forcedSide,
  type Leg,
  laneOrders,
  overlap,
  type Piece,
  piecesOf,
  type Reading,
} from './lanes.js'

const run = (head: number, kind: string) => ({ head, kind })
const routeOf = (line: string, runs: { head: number; kind: string }[]) =>
  ({ line, runs }) as unknown as GlobalRoute

const piece = (line: string, k: number, axis: 'x' | 'y'): Piece => ({
  line,
  k,
  axis,
  kind: 'run',
  i: k,
})

describe('piecesOf', () => {
  it('is a piece for each run, across its heading, with a joint adding the short run across before its own', () => {
    // down, then a joint to a run down again, then a turn onto a run across
    const pieces = piecesOf(routeOf('l', [run(1, 'start'), run(1, 'joint'), run(0, 'turn')]))
    expect(pieces).toEqual([
      { line: 'l', k: 0, axis: 'x', kind: 'run', i: 0 },
      { line: 'l', k: 1, axis: 'y', kind: 'across', i: 1 },
      { line: 'l', k: 2, axis: 'x', kind: 'run', i: 1 },
      { line: 'l', k: 3, axis: 'y', kind: 'run', i: 2 },
    ])
  })

  it('gives the first run no piece across, whatever its kind: the port is where it starts', () => {
    expect(piecesOf(routeOf('l', [run(0, 'joint')]))).toEqual([
      { line: 'l', k: 0, axis: 'y', kind: 'run', i: 0 },
    ])
  })
})

/**
 * A reading for tests: each piece along x is one unknown (its index), with the ends and legs
 * given; unknowns of y are named by number too, and how they stand is a table of what is known
 * (`before`), else their rooms. Nothing is estimated.
 */
function readingOf(spec: {
  ends: Record<string, [Bound, Bound]>
  legs?: Record<string, Leg[]>
  rooms?: Record<string, [number, number]>
  yRooms?: Record<number, [number, number]>
  before?: [number, number][]
  same?: boolean
}): Reading {
  const index = (p: Piece) => Number(p.line.replace(/\D/g, '')) || 0
  const roomsY = spec.yRooms ?? {}
  const precedes = (a: number, b: number) =>
    (spec.before ?? []).some(([i, j]) => i === a && j === b)
  return {
    unknownOf: (p) => index(p),
    ends: (p) => spec.ends[p.line] ?? [{ at: 0 }, { at: 0 }],
    legs: (p) => spec.legs?.[p.line] ?? [],
    compare: (axis, a, b) => {
      if ('at' in a && 'at' in b) return a.at < b.at ? -1 : a.at > b.at ? 1 : 0
      const roomOf = (v: number): [number, number] =>
        axis === 'y'
          ? (roomsY[v] ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY])
          : (spec.rooms?.[`L${v}`] ?? [0, 200])
      if ('at' in a) {
        const [lo, hi] = roomOf(b.v)
        return lo >= a.at ? (hi <= a.at ? 0 : -1) : hi <= a.at ? 1 : undefined
      }
      const [lo, hi] = roomOf(a.v)
      if ('at' in b) return hi <= b.at ? (lo >= b.at ? 0 : -1) : lo >= b.at ? 1 : undefined
      if (a.v === b.v) return 0
      if (precedes(a.v, b.v)) return -1
      if (precedes(b.v, a.v)) return 1
      const [lo2, hi2] = roomOf(b.v)
      return hi <= lo2 ? -1 : hi2 <= lo ? 1 : undefined
    },
    room: (p) => spec.rooms?.[p.line] ?? [0, 200],
    same: () => spec.same ?? false,
    pitch: () => 10,
  }
}

describe('overlap', () => {
  const p = piece('L1', 0, 'x')
  const q = piece('L2', 0, 'x')
  const fixed = (a: number, b: number): [Bound, Bound] => [{ at: a }, { at: b }]

  it('is certain from fixed ends, and touching is apart', () => {
    expect(overlap(readingOf({ ends: { L1: fixed(0, 100), L2: fixed(50, 150) } }), p, q)).toBe(true)
    expect(overlap(readingOf({ ends: { L1: fixed(0, 100), L2: fixed(100, 200) } }), p, q)).toBe(
      false,
    )
    // whichever way round the ends are given
    expect(overlap(readingOf({ ends: { L1: fixed(100, 0), L2: fixed(150, 50) } }), p, q)).toBe(true)
  })

  it('is read from the orders of the other axis where an end is an unknown', () => {
    // p from the bottom edge (100) up to its turn (y unknown 7); q from the top (0) down to its turn (8)
    const ends: Record<string, [Bound, Bound]> = {
      L1: [{ at: 100 }, { v: 7 }],
      L2: [{ at: 0 }, { v: 8 }],
    }
    // both turns lie within the cell (0..100); nothing relates the two: not decided
    const inCell: Record<number, [number, number]> = { 7: [0, 100], 8: [0, 100] }
    expect(overlap(readingOf({ ends, yRooms: inCell }), p, q)).toBeUndefined()
    // p's turn above q's turn: the two legs share the stretch between the turns
    expect(overlap(readingOf({ ends, yRooms: inCell, before: [[7, 8]] }), p, q)).toBe(true)
    // q's turn above p's turn: apart
    expect(overlap(readingOf({ ends, yRooms: inCell, before: [[8, 7]] }), p, q)).toBe(false)
    // and the rooms decide where the orders do not
    expect(overlap(readingOf({ ends, yRooms: { 7: [60, 70], 8: [20, 30] } }), p, q)).toBe(false)
  })
})

describe('forcedSide', () => {
  // p (unknown 1) runs along x from y 0 to y 100 and is reached at y 0 by a leg that goes toward
  // lower x as far as x 10 (its box's edge); q (unknown 2) runs from y -50 to y 50
  const p = piece('L1', 0, 'x')
  const q = piece('L2', 0, 'x')
  const ends: Record<string, [Bound, Bound]> = {
    L1: [{ at: 0 }, { at: 100 }],
    L2: [{ at: -50 }, { at: 50 }],
  }
  it('asks for the other piece on the side the leg leaves from, where the leg runs into its extent', () => {
    const r = readingOf({ ends, legs: { L1: [{ at: { at: 0 }, dir: -1, to: { at: 10 } }] } })
    expect(forcedSide(r, p, q)).toBe(1)
    const toHigh = readingOf({ ends, legs: { L1: [{ at: { at: 0 }, dir: 1, to: { at: 190 } }] } })
    expect(forcedSide(toHigh, p, q)).toBe(-1)
  })
  it('asks nothing of a leg outside the other extent, or one the other piece lies beyond the end of', () => {
    const outside = readingOf({
      ends,
      legs: { L1: [{ at: { at: 100 }, dir: -1, to: { at: 10 } }] },
    })
    expect(forcedSide(outside, p, q)).toBe(0)
    // q's room lies below x 10, past the leg's end at 10
    const beyond = readingOf({
      ends,
      legs: { L1: [{ at: { at: 0 }, dir: -1, to: { at: 10 } }] },
      rooms: { L2: [0, 10] },
    })
    expect(forcedSide(beyond, p, q)).toBe(0)
  })
  it('is undecided where the route does not say which way the leg runs, or two legs disagree', () => {
    const unknown = readingOf({ ends, legs: { L1: [{ at: { at: 0 }, dir: 0, to: { at: 10 } }] } })
    expect(forcedSide(unknown, p, q)).toBeUndefined()
    const both = readingOf({
      ends: { L1: [{ at: 0 }, { at: 40 }], L2: [{ at: -50 }, { at: 50 }] },
      legs: {
        L1: [
          { at: { at: 0 }, dir: -1, to: { at: 10 } },
          { at: { at: 40 }, dir: 1, to: { at: 190 } },
        ],
      },
    })
    expect(forcedSide(both, p, q)).toBeUndefined()
  })
})

describe('laneOrders', () => {
  const p = piece('L1', 0, 'x')
  const q = piece('L2', 0, 'x')
  const fixed = (a: number, b: number): [Bound, Bound] => [{ at: a }, { at: b }]
  const both: Record<string, [Bound, Bound]> = { L1: fixed(0, 100), L2: fixed(0, 100) }

  it('pairs only pieces of different lines that overlap along their length and may come within a pitch', () => {
    expect(laneOrders('x', [p, q], readingOf({ ends: both })).orders).toHaveLength(1)
    // the same line
    expect(laneOrders('x', [p, piece('L1', 1, 'x')], readingOf({ ends: both })).orders).toEqual([])
    // extents that only touch
    expect(
      laneOrders('x', [p, q], readingOf({ ends: { L1: fixed(0, 100), L2: fixed(100, 200) } })),
    ).toEqual({ orders: [], undecided: [] })
    // rooms more than a pitch apart
    expect(
      laneOrders('x', [p, q], readingOf({ ends: both, rooms: { L1: [0, 20], L2: [60, 80] } })),
    ).toEqual({ orders: [], undecided: [] })
    // already one value
    expect(laneOrders('x', [p, q], readingOf({ ends: both, same: true })).orders).toEqual([])
    // pieces along the other axis
    expect(laneOrders('y', [p, q], readingOf({ ends: both })).orders).toEqual([])
  })

  it('leaves a pair undecided where its overlap turns on an order of the other axis not made yet', () => {
    const ends: Record<string, [Bound, Bound]> = {
      L1: [{ at: 100 }, { v: 7 }],
      L2: [{ at: 0 }, { v: 8 }],
    }
    const yRooms: Record<number, [number, number]> = { 7: [0, 100], 8: [0, 100] }
    expect(laneOrders('x', [p, q], readingOf({ ends, yRooms }))).toEqual({
      orders: [],
      undecided: [[p, q]],
    })
    expect(
      laneOrders('x', [p, q], readingOf({ ends, yRooms, before: [[7, 8]] })).orders,
    ).toHaveLength(1)
    expect(laneOrders('x', [p, q], readingOf({ ends, yRooms, before: [[8, 7]] }))).toEqual({
      orders: [],
      undecided: [],
    })
  })

  it('orders pieces nothing forces by the rooms where only one order can be kept, else by the name', () => {
    const named = laneOrders('x', [p, q], readingOf({ ends: both })).orders
    expect(named).toEqual([{ before: p, after: q, forced: false }])
    // q has room only below p
    const roomed = laneOrders(
      'x',
      [p, q],
      readingOf({ ends: both, rooms: { L1: [30, 80], L2: [0, 30] } }),
    ).orders
    expect(roomed).toEqual([{ before: q, after: p, forced: false }])
  })

  it('takes the order a leg forces', () => {
    const r = readingOf({
      ends: { L1: fixed(0, 100), L2: fixed(-50, 50) },
      legs: { L1: [{ at: { at: 0 }, dir: -1, to: { at: 10 } }] },
    })
    expect(laneOrders('x', [p, q], r).orders).toEqual([{ before: p, after: q, forced: true }])
    const high = readingOf({
      ends: { L1: fixed(0, 100), L2: fixed(-50, 50) },
      legs: { L1: [{ at: { at: 0 }, dir: 1, to: { at: 190 } }] },
    })
    expect(laneOrders('x', [p, q], high).orders).toEqual([{ before: q, after: p, forced: true }])
  })

  it('leaves a pair whose legs are not decided yet undecided, and one whose legs disagree to the rooms and the names', () => {
    const unknown = readingOf({
      ends: { L1: fixed(0, 100), L2: fixed(-50, 50) },
      legs: { L1: [{ at: { at: 0 }, dir: 0, to: { at: 10 } }] },
    })
    expect(laneOrders('x', [p, q], unknown)).toEqual({ orders: [], undecided: [[p, q]] })
  })
})
