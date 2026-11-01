// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { GlobalRoute } from './global.js'
import { type Laid, laneOrders, type Piece, piecesOf } from './lanes.js'

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

describe('laneOrders', () => {
  const pitch = () => 10
  const never = () => false
  const room = (r: Record<string, [number, number]>) => (p: Piece) => r[p.line] ?? [0, 200]
  const at = (v: Record<string, number>) => (p: Piece) => v[p.line] ?? 0
  const alone = (line: string, from: number, to: number): Laid => ({
    pieces: [piece(line, 0, 'x')],
    fromEdge: from,
    toEdge: to,
  })

  it('pairs only pieces of different lines that overlap along their length and may come within a pitch', () => {
    const lines = [alone('A', 0, 100), alone('B', 0, 100)]
    expect(laneOrders('x', lines, pitch, at({}), room({}), never)).toHaveLength(1)
    // the same line
    expect(
      laneOrders('x', [alone('A', 0, 100), alone('A', 0, 100)], pitch, at({}), room({}), never),
    ).toEqual([])
    // extents that only touch
    expect(
      laneOrders('x', [alone('A', 0, 100), alone('B', 100, 200)], pitch, at({}), room({}), never),
    ).toEqual([])
    // rooms more than a pitch apart
    expect(laneOrders('x', lines, pitch, at({}), room({ A: [0, 20], B: [60, 80] }), never)).toEqual(
      [],
    )
    // already one value
    expect(laneOrders('x', lines, pitch, at({}), room({}), () => true)).toEqual([])
    // pieces along the other axis
    expect(laneOrders('y', lines, pitch, at({}), room({}), never)).toEqual([])
  })

  it('orders pieces nothing forces by the estimates, and by the name where those are equal', () => {
    const lines = [alone('A', 0, 100), alone('B', 0, 100)]
    const order = (v: Record<string, number>) =>
      laneOrders('x', lines, pitch, at(v), room({}), never).map((o) => [o.before.line, o.forced])
    expect(order({ A: 100, B: 90 })).toEqual([['B', false]])
    expect(order({ A: 90, B: 100 })).toEqual([['A', false]])
    expect(order({ A: 100, B: 100 })).toEqual([['A', false]])
  })

  it('orders by the rooms where only one order can be kept, against the estimates', () => {
    const lines = [alone('A', 0, 100), alone('B', 0, 100)]
    // B has room only below A, though A is estimated lower
    const result = laneOrders(
      'x',
      lines,
      pitch,
      at({ A: 10, B: 20 }),
      room({ A: [30, 80], B: [0, 30] }),
      never,
    )
    expect(result.map((o) => [o.before.line, o.after.line, o.forced])).toEqual([['B', 'A', false]])
  })

  describe('with a leg that leaves one piece into the extent of the other', () => {
    // A: a leg in (a piece along y at y 50), the piece along x, a leg out (y 200); B: a piece along
    // x with the extent 0 to 120, which the leg in at y 50 enters and the leg out at y 200 does not
    const legIn = piece('A', 0, 'y')
    const mid = piece('A', 1, 'x')
    const legOut = piece('A', 2, 'y')
    const q = piece('B', 0, 'x')
    const value = (x: Piece) =>
      x === legIn ? 50 : x === legOut ? 200 : x === mid ? 105 : x === q ? 100 : 0
    const b: Laid = { pieces: [q], fromEdge: 0, toEdge: 120 }

    it('forces the order, against the estimates', () => {
      // A leaves its box at x 10, so the leg goes left of A's piece (105): B must be passed on the
      // side the leg leaves from, and A lies before B though it is estimated after
      const lines: Laid[] = [{ pieces: [legIn, mid, legOut], fromEdge: 10, toEdge: 190 }, b]
      expect(laneOrders('x', lines, pitch, value, room({}), never)).toEqual([
        { before: mid, after: q, forced: true },
      ])
    })

    it('asks for the other order of a leg that leaves toward the high side', () => {
      const lines: Laid[] = [{ pieces: [legIn, mid, legOut], fromEdge: 190, toEdge: 190 }, b]
      expect(laneOrders('x', lines, pitch, value, room({}), never)).toEqual([
        { before: q, after: mid, forced: true },
      ])
    })

    it('leaves legs that are as long and leave opposite ways to the rooms and the estimates', () => {
      // the leg in and the leg out are both inside B's extent, 55 long to the left and to the right
      const inside = (x: Piece) => (x === legOut ? 100 : value(x))
      const lines: Laid[] = [{ pieces: [legIn, mid, legOut], fromEdge: 50, toEdge: 160 }, b]
      const [only] = laneOrders('x', lines, pitch, inside, room({}), never)
      expect(only?.forced).toBe(false)
    })
  })
})
