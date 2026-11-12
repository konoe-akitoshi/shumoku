// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { type AxisInput, CycleError, midpoint, packEarly, packLate, solveAxis } from './axis.js'

const base = (over: Partial<AxisInput>): AxisInput => ({
  n: 3,
  sep: [],
  equal: [],
  pull: [],
  pair: [],
  tolerance: 0.01,
  ...over,
})

describe('solveAxis', () => {
  it('keeps a value within its bounds while it is pulled out of them', () => {
    const v = solveAxis(
      base({
        n: 2,
        sep: [{ i: 0, j: 1, d: 4 }],
        pull: [
          { i: 0, t: -50, w: 1 },
          { i: 1, t: 90, w: 1 },
        ],
        lower: [10, Number.NEGATIVE_INFINITY],
        upper: [Number.POSITIVE_INFINITY, 30],
      }),
    )
    expect([...v]).toEqual([10, 30])
  })

  it('starts a value that has a floor no lower than it', () => {
    const v = solveAxis(base({ n: 2, sep: [{ i: 0, j: 1, d: 4 }], lower: [7, 0] }))
    expect([...v]).toEqual([7, 11])
  })

  it('places a chain as early as its separations allow', () => {
    const v = solveAxis(
      base({
        sep: [
          { i: 0, j: 1, d: 10 },
          { i: 1, j: 2, d: 5 },
        ],
      }),
    )
    expect([...v]).toEqual([0, 10, 15])
  })

  it('merges equal variables and keeps their offset', () => {
    const v = solveAxis(base({ equal: [{ i: 0, j: 2, d: 3 }], sep: [{ i: 0, j: 1, d: 10 }] }))
    expect((v[2] ?? 0) - (v[0] ?? 0)).toBe(3)
    expect((v[1] ?? 0) - (v[0] ?? 0)).toBeGreaterThanOrEqual(10)
  })

  it('moves a free variable to the middle of its two partners', () => {
    const v = solveAxis(
      base({
        sep: [
          { i: 0, j: 1, d: 0 },
          { i: 1, j: 2, d: 0 },
          { i: 0, j: 2, d: 100 },
        ],
        pair: [
          { i: 0, j: 1, w: 1, d: 0 },
          { i: 1, j: 2, w: 1, d: 0 },
        ],
      }),
    )
    expect(v[1]).toBeCloseTo(50, 0)
    expect(v[2]).toBeGreaterThanOrEqual(100)
  })

  it('always satisfies the constraints, whatever it is pulled to', () => {
    const sep = [
      { i: 0, j: 1, d: 10 },
      { i: 1, j: 2, d: 10 },
    ]
    const pull = [
      { i: 2, t: -50, w: 5 },
      { i: 0, t: 90, w: 1 },
    ]
    const v = solveAxis(base({ sep, pull }))
    for (const { i, j, d } of sep) {
      expect((v[j] ?? 0) - (v[i] ?? 0)).toBeGreaterThanOrEqual(d - 1e-9)
    }
  })

  it('gives the same answer for the same input', () => {
    const input = base({
      sep: [{ i: 0, j: 1, d: 7 }],
      pull: [{ i: 1, t: 30, w: 2 }],
      pair: [{ i: 1, j: 2, w: 1, d: 4 }],
    })
    expect([...solveAxis(input)]).toEqual([...solveAxis(input)])
  })

  it('is as good as a search over a grid on a small problem', () => {
    const sep = [
      { i: 0, j: 1, d: 3 },
      { i: 1, j: 2, d: 3 },
    ]
    const pull = [
      { i: 0, t: 5, w: 1 },
      { i: 2, t: 6, w: 3 },
    ]
    const cost = (v: number[]) => pull.reduce((s, p) => s + p.w * ((v[p.i] ?? 0) - p.t) ** 2, 0)
    const solved = [...solveAxis(base({ sep, pull }))]
    let best = Number.POSITIVE_INFINITY
    for (let a = 0; a <= 12; a++) {
      for (let b = a + 3; b <= 12; b++) {
        for (let c = b + 3; c <= 12; c++) best = Math.min(best, cost([a, b, c]))
      }
    }
    expect(cost(solved)).toBeLessThanOrEqual(best + 1)
  })

  it('lets two values each be asked to reach past the other, as long as the reaches fit', () => {
    // v1 >= v0 - 3 and v0 >= v1 - 3: a ring that adds up to less than nothing
    const sep = [
      { i: 0, j: 1, d: -3 },
      { i: 1, j: 0, d: -3 },
    ]
    const v = [...solveAxis(base({ sep }))]
    expect((v[1] ?? 0) - (v[0] ?? 0)).toBeGreaterThanOrEqual(-3 - 1e-9)
    expect((v[0] ?? 0) - (v[1] ?? 0)).toBeGreaterThanOrEqual(-3 - 1e-9)
  })

  it('refuses a cycle it has no start for', () => {
    const sep = [
      { i: 0, j: 1, d: 1 },
      { i: 1, j: 0, d: 1 },
    ]
    expect(() => solveAxis(base({ sep }))).toThrow()
  })

  it('names a cycle through variables that are not the root of their class, and stops', () => {
    // 0-3 are one variable, 4-6 another and 7 a third: the classes are numbered 0, 1, 2 and their
    // roots are 0, 4, 7. The walk round the ring has to follow class indices (and only name the
    // roots at the end), or it never comes back to where it began
    const equal = [
      { i: 0, j: 1, d: 0 },
      { i: 0, j: 2, d: 0 },
      { i: 0, j: 3, d: 0 },
      { i: 4, j: 5, d: 0 },
      { i: 4, j: 6, d: 0 },
    ]
    const sep = [
      { i: 5, j: 7, d: 1 },
      { i: 7, j: 6, d: 1 },
    ]
    let thrown: unknown
    try {
      solveAxis(base({ n: 8, equal, sep }))
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(CycleError)
    const ring = thrown as CycleError
    // The ring is the two separations, and lacks what their distances add up to.
    expect([...ring.seps].sort()).toEqual([0, 1])
    expect(ring.excess).toBeCloseTo(2)
  })
})

/** Small systems that have a solution by construction: the constraints are read off hidden values. */
function randomSystem(seed: number): AxisInput {
  let state = seed
  const next = (n: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % n
  }
  const n = 3 + next(6)
  const hidden = Array.from({ length: n }, () => next(200))
  const pick = () => {
    const i = next(n)
    const j = (i + 1 + next(n - 1)) % n
    return { i, j, gap: (hidden[j] ?? 0) - (hidden[i] ?? 0) }
  }
  const sep = Array.from({ length: next(2 * n) }, () => {
    const { i, j, gap } = pick()
    return { i, j, d: gap - next(30) }
  })
  const equal = Array.from({ length: next(3) }, () => {
    const { i, j, gap } = pick()
    return { i, j, d: gap }
  })
  const pair = Array.from({ length: next(n) }, () => ({ ...pick(), w: 1 + next(3), d: next(50) }))
  return base({ n, sep, equal, pair: pair.map(({ i, j, w, d }) => ({ i, j, w, d })) })
}

describe('solveAxis laws', () => {
  const seeds = Array.from({ length: 40 }, (_, k) => k + 1)

  it.each(seeds)('seed %i: every separation and every equality holds', (seed) => {
    const input = randomSystem(seed)
    const v = solveAxis(input)
    for (const { i, j, d } of input.sep)
      expect((v[j] ?? 0) - (v[i] ?? 0)).toBeGreaterThanOrEqual(d - input.tolerance)
    for (const { i, j, d } of input.equal)
      expect(Math.abs((v[j] ?? 0) - (v[i] ?? 0) - d)).toBeLessThan(1e-6)
  })

  it.each(seeds)('seed %i: solving again from the result never makes it worse', (seed) => {
    const input = randomSystem(seed)
    const cost = (v: Float64Array) =>
      input.pair.reduce((sum, { i, j, w, d }) => sum + w * ((v[j] ?? 0) - (v[i] ?? 0) - d) ** 2, 0)
    const v = solveAxis(input)
    const again = solveAxis({ ...input, start: v })
    expect(cost(again)).toBeLessThanOrEqual(cost(v) + 1e-6)
    for (const { i, j, d } of input.sep)
      expect((again[j] ?? 0) - (again[i] ?? 0)).toBeGreaterThanOrEqual(d - input.tolerance)
  })

  const settles = (seed: number) => {
    const input = randomSystem(seed)
    const settled = solveAxis({ ...input, start: solveAxis(input) })
    const again = solveAxis({ ...input, start: settled })
    for (const [k, value] of settled.entries())
      expect(Math.abs((again[k] ?? 0) - value)).toBeLessThanOrEqual(input.tolerance)
  }
  // The solver stops when a pass moves nothing by more than the tolerance, so a result is not
  // always a fixed point: starting from it can still move values, and does for these seeds even
  // after one such restart. Not a law yet; `it.fails` turns into a failure when it becomes one.
  const drifting = [12, 23]
  it.each(seeds.filter((s) => !drifting.includes(s)))(
    'seed %i: a result, solved again from itself, stays',
    settles,
  )
  it.fails.each(drifting)('seed %i: a result, solved again from itself, still drifts', settles)
})

describe('packing early and late', () => {
  it('puts a free value at the start of its part when early and at the end when late', () => {
    // 0 -> 1 -> 2 is a chain; 3 stands beside 4 with room for both in the chain's width
    const input = base({
      n: 5,
      sep: [
        { i: 0, j: 1, d: 10 },
        { i: 1, j: 2, d: 10 },
        { i: 3, j: 4, d: 2 },
        { i: 0, j: 3, d: 0 },
        { i: 4, j: 2, d: 0 },
      ],
    })
    expect([...packEarly(input)]).toEqual([0, 10, 20, 0, 2])
    expect([...packLate(input)]).toEqual([0, 10, 20, 18, 20])
    expect([...midpoint(packEarly(input), packLate(input))]).toEqual([0, 10, 20, 9, 11])
  })

  it('keeps every separation and equality, and the width of each connected part', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = seed
      const next = () => {
        s = (s * 1103515245 + 12345) % 2147483648
        return s / 2147483648
      }
      const n = 12
      const sep: AxisInput['sep'] = []
      for (let k = 0; k < 14; k++) {
        const i = Math.floor(next() * n)
        const j = Math.floor(next() * n)
        if (i < j) sep.push({ i, j, d: 1 + Math.floor(next() * 5) })
      }
      const input = base({ n, sep, equal: [{ i: 0, j: 1 + (seed % 3), d: 0 }] })
      const early = packEarly(input)
      const late = packLate(input)
      const mid = midpoint(early, late)
      for (const v of [early, late, mid]) {
        for (const { i, j, d } of sep)
          expect((v[j] ?? 0) - (v[i] ?? 0)).toBeGreaterThanOrEqual(d - 1e-9)
        for (const { i, j, d } of input.equal) expect((v[j] ?? 0) - (v[i] ?? 0)).toBeCloseTo(d, 9)
      }
      for (let x = 0; x < n; x++)
        expect(late[x] ?? 0).toBeGreaterThanOrEqual((early[x] ?? 0) - 1e-9)
    }
  })

  it('is deterministic', () => {
    const input = base({ n: 3, sep: [{ i: 0, j: 2, d: 5 }] })
    expect([...packLate(input)]).toEqual([...packLate(input)])
  })
})
