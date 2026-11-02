// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { type Bound, type Lanes, type Leg, misreadings, type Piece, type Reading } from './lanes.js'
import { settle } from './realize-constraints.js'
import { Unknowns } from './unknowns.js'

const piece = (line: string): Piece => ({ line, k: 0, axis: 'x', kind: 'run', i: 0 })
const P = piece('L1')
const Q = piece('L2')

/**
 * Two vertical pieces in one corridor. P runs from y 0 to y 100, Q from y `left` to y 100 +
 * `right`; at the left end P leaves toward lower x and Q toward higher x, at the right end the
 * other way: they part to opposite sides at both ends. Both lines round their corners with
 * radius 5, so two legs within 10 of each other across stand as one line's S.
 */
function corridor(left: number, right: number): Reading {
  const legs: Record<string, Leg[]> = {
    L1: [
      { at: { at: 0 }, dir: -1, to: { at: -500 } },
      { at: { at: 100 }, dir: 1, to: { at: 500 } },
    ],
    L2: [
      { at: { at: left }, dir: 1, to: { at: 500 } },
      { at: { at: 100 + right }, dir: -1, to: { at: -500 } },
    ],
  }
  const ends: Record<string, [Bound, Bound]> = {
    L1: [{ at: 0 }, { at: 100 }],
    L2: [{ at: left }, { at: 100 + right }],
  }
  return {
    unknownOf: (p) => Number(p.line.slice(1)),
    ends: (p) => ends[p.line] ?? [{ at: 0 }, { at: 0 }],
    legs: (p) => legs[p.line] ?? [],
    compare: () => undefined,
    room: () => [0, 1000],
    same: () => false,
    pitch: () => 10,
    radius: () => 5,
  }
}

const read = (x: Record<number, number>) => (_axis: 'x' | 'y', e: Bound) =>
  'at' in e ? e.at : (x[e.v] ?? 0)

describe('misreadings', () => {
  it('counts a leg that crosses the other piece, and again a crossing read as the lines running on', () => {
    const value = read({ 1: 0, 2: 4 })
    // P first: its right leg crosses Q; Q's leg at that end is 50 off, so nothing runs on
    expect(misreadings(corridor(3, 50), P, Q, true, value)).toBe(1)
    // Q first: Q's left leg crosses P, and P's own leg 3 off stands end to end with it
    expect(misreadings(corridor(3, 50), P, Q, false, value)).toBe(2)
  })

  it('counts nothing for a leg that stops short of the other piece', () => {
    const r = corridor(3, 50)
    const short: Reading = {
      ...r,
      legs: (p) =>
        r.legs(p).map((l) => (l.dir === 1 && p.line === 'L1' ? { ...l, to: { at: 3 } } : l)),
    }
    expect(misreadings(short, P, Q, true, read({ 1: 0, 2: 4 }))).toBe(0)
  })

  it('counts the run-on at exactly the sum of the two radii and not beyond it', () => {
    const value = read({ 1: 0, 2: 4 })
    expect(misreadings(corridor(3, 10), P, Q, true, value)).toBe(2)
    expect(misreadings(corridor(3, 10.5), P, Q, true, value)).toBe(1)
  })
})

describe('settle by misreadings', () => {
  const orderOf = (reading: Reading, p: number, q: number) => {
    const u = new Unknowns()
    for (const name of ['none', 'L1', 'L2']) u.add(name, { lo: 0, hi: 1000 })
    const value = (_a: 'x' | 'y', i: number) => (i === 1 ? p : i === 2 ? q : 0)
    const lanes: Lanes = { pieces: [P, Q], reading }
    settle(u, 'x', lanes, [[P, Q]], value, new Set())
    return u.sep.map((s) => `${s.i}<${s.j}`)
  }

  it('puts the crossing at the end where the legs are far apart, against the solution', () => {
    // the solution has Q left of P; the left end would read as one line, so P goes first
    expect(orderOf(corridor(3, 50), 4, 0)).toEqual(['1<2'])
  })

  it('keeps the order the solution shows where both ends misread alike and are near', () => {
    expect(orderOf(corridor(3, 3), 4, 0)).toEqual(['2<1'])
    expect(orderOf(corridor(3, 3), 0, 4)).toEqual(['1<2'])
  })

  it('keeps the order the solution shows where both ends are far apart', () => {
    expect(orderOf(corridor(50, 50), 4, 0)).toEqual(['2<1'])
    expect(orderOf(corridor(50, 50), 0, 4)).toEqual(['1<2'])
  })
})
