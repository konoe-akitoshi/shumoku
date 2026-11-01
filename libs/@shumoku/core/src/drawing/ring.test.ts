// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { CycleError, solveAxis } from './axis.js'
import type { Item } from './problem.js'
import { after, grownBy, type Ref, RingError, ringOf } from './ring.js'

describe('ringOf', () => {
  // A box A (variable 0, width 10) and a box B (variable 1, width 4) under it: B's left edge is
  // asked 3 past A's left, and A's right edge 5 past B's right. The ring adds up to 3 + 4 + 5 = 12
  // against A's width 10: it lacks 2, and A, whose width the ring runs against, grows by it.
  const left = (v: number): Ref => ({ v, off: 0 })
  const right = (v: number, width: number, key: string): Ref => ({ v, off: width, farOf: key })
  const seps = [after(left(0), left(1), 3), after(right(1, 4, 'B'), right(0, 10, 'A'), 5)]
  const keyOf = (v: number) => ['A', 'B'][v]

  it('grows the box whose extent the ring takes away from, by what the ring lacks', () => {
    let thrown: unknown
    try {
      solveAxis({ n: 2, sep: seps, equal: [], pull: [], pair: [], tolerance: 1e-6 })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(CycleError)
    const ring = ringOf('x', thrown as CycleError, seps, keyOf, () => true)
    expect(ring.axis).toBe('x')
    expect([...ring.keys].sort()).toEqual(['A', 'B'])
    expect([...ring.grow]).toEqual([['A', expect.closeTo(2, 6)]])
  })

  it('grows no box that may not grow, and names the ring still', () => {
    let thrown: unknown
    try {
      solveAxis({ n: 2, sep: seps, equal: [], pull: [], pair: [], tolerance: 1e-6 })
    } catch (e) {
      thrown = e
    }
    const ring = ringOf('x', thrown as CycleError, seps, keyOf, (key) => key !== 'A')
    expect(ring.grow.size).toBe(0)
    expect([...ring.keys].sort()).toEqual(['A', 'B'])
  })

  it('grows nothing where the ring runs with and against a width alike', () => {
    // A's right edge asked 8 past B's and B's 8 past A's: no width can meet it, the ring lacks 16.
    const two = [
      after(right(1, 10, 'B'), right(0, 10, 'A'), 8),
      after(right(0, 10, 'A'), right(1, 10, 'B'), 8),
    ]
    let thrown: unknown
    try {
      solveAxis({ n: 2, sep: two, equal: [], pull: [], pair: [], tolerance: 1e-6 })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(CycleError)
    expect((thrown as CycleError).excess).toBeCloseTo(16)
    const ring = ringOf('x', thrown as CycleError, two, keyOf, () => true)
    // Each width is both added (the ring leaves by its far edge) and taken away (it arrives
    // there): neither can break the ring by growing.
    expect(ring.grow.size).toBe(0)
  })
})

describe('grownBy', () => {
  const item = (id: string, width: number, height: number): Item => ({
    id,
    kind: 'card',
    frame: 'root',
    size: { width, height },
  })
  const items = [item('A', 10, 6), item('B', 4, 3)]

  it('gives each box the ring runs against its own extent along the axis, and what the ring lacks', () => {
    const ring = new RingError('x', ['A', 'B'], new Map([['A', 2]]))
    expect([...grownBy(items, ring, 'x')]).toEqual([['A', 12]])
    expect([...grownBy(items, ring, 'y')]).toEqual([['A', 8]])
  })
})
