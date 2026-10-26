import { describe, expect, it } from 'vitest'
import { InfeasibleError, type Separation, solveVpsc } from './vpsc.js'

const near = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length)
  for (const [i, e] of expected.entries()) expect(actual[i]).toBeCloseTo(e, 6)
}

describe('vpsc: known optima', () => {
  it('leaves variables that already satisfy the constraints where they want to be', () => {
    near(solveVpsc({ desired: [0, 5], separations: [{ left: 0, right: 1, gap: 2 }] }), [0, 5])
  })

  it('pushes two variables apart symmetrically', () => {
    near(solveVpsc({ desired: [0, 0], separations: [{ left: 0, right: 1, gap: 2 }] }), [-1, 1])
  })

  it('moves the lighter variable further', () => {
    // minimise 1 x0^2 + 3 x1^2 with x1 - x0 = 4: x0 = -3, x1 = 1
    near(
      solveVpsc({
        desired: [0, 0],
        weight: [1, 3],
        separations: [{ left: 0, right: 1, gap: 4 }],
      }),
      [-3, 1],
    )
  })

  it('spreads a chain', () => {
    near(
      solveVpsc({
        desired: [0, 0, 0],
        separations: [
          { left: 0, right: 1, gap: 1 },
          { left: 1, right: 2, gap: 1 },
        ],
      }),
      [-1, 0, 1],
    )
  })

  it('merges blocks across a violated constraint and settles at the weighted mean', () => {
    // minimise (a - 10)^2 + b^2 + c^2 with b, c >= a + 1: a = 8/3, b = c = 11/3
    near(
      solveVpsc({
        desired: [10, 0, 0],
        separations: [
          { left: 0, right: 1, gap: 1 },
          { left: 0, right: 2, gap: 1 },
        ],
      }),
      [8 / 3, 11 / 3, 11 / 3],
    )
  })

  it('splits a block when a constraint holds two variables together that want to part', () => {
    // a wants 0, b wants 0, c wants 10; a -> b gap 4 and b -> c gap 4. Satisfying the first
    // merges a and b (a = -2, b = 2); c at 10 is clear of b, so the chain stays split.
    near(
      solveVpsc({
        desired: [0, 0, 10],
        separations: [
          { left: 0, right: 1, gap: 4 },
          { left: 1, right: 2, gap: 4 },
        ],
      }),
      [-2, 2, 10],
    )
  })

  it('merges only the blocks that must touch', () => {
    // a wants 6, b and c want 0; a >= b + 1 holds already and b >= c + 1 does not: b and c part
    // symmetrically about 0 and a stays.
    near(
      solveVpsc({
        desired: [6, 0, 0],
        separations: [
          { left: 1, right: 0, gap: 1 },
          { left: 2, right: 1, gap: 1 },
        ],
      }),
      [6, 0.5, -0.5],
    )
  })

  it('honours weights and a diamond of constraints', () => {
    const x = solveVpsc({
      desired: [0, 5, 5, 0],
      weight: [1, 1, 1, 1],
      separations: [
        { left: 0, right: 1, gap: 2 },
        { left: 0, right: 2, gap: 2 },
        { left: 1, right: 3, gap: 2 },
        { left: 2, right: 3, gap: 2 },
      ],
    })
    // the middle two want to be at 5 but the ends want 0 and need 4 between them: any
    // symmetric solution has x1 = x2.
    expect(x[1]).toBeCloseTo(x[2] ?? Number.NaN, 6)
    expect((x[3] ?? 0) - (x[0] ?? 0)).toBeGreaterThanOrEqual(4 - 1e-9)
  })

  it('refuses separations that form a cycle', () => {
    expect(() =>
      solveVpsc({
        desired: [0, 0],
        separations: [
          { left: 0, right: 1, gap: 1 },
          { left: 1, right: 0, gap: 1 },
        ],
      }),
    ).toThrow(InfeasibleError)
  })

  it('returns an empty answer for no variables', () => {
    expect(solveVpsc({ desired: [], separations: [] })).toEqual([])
  })
})

describe('vpsc: optimality on random instances', () => {
  // A small deterministic generator, so a failure can be reproduced.
  const random = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const cost = (x: readonly number[], d: readonly number[], w: readonly number[]) =>
    x.reduce((sum, v, i) => sum + (w[i] ?? 1) * (v - (d[i] ?? 0)) ** 2, 0)
  const feasible = (x: readonly number[], seps: readonly Separation[], eps = 1e-9) =>
    seps.every((s) => (x[s.right] ?? 0) - (x[s.left] ?? 0) >= s.gap - eps)

  it('satisfies the constraints and no feasible nearby point is better', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rnd = random(seed)
      const n = 3 + Math.floor(rnd() * 8)
      const desired = Array.from({ length: n }, () => rnd() * 20 - 10)
      const weight = Array.from({ length: n }, () => 0.5 + rnd() * 3)
      // only forward constraints (left < right), so there is no cycle
      const separations: Separation[] = []
      for (let k = 0; k < n * 2; k++) {
        const a = Math.floor(rnd() * (n - 1))
        const b = a + 1 + Math.floor(rnd() * (n - 1 - a))
        separations.push({ left: a, right: b, gap: rnd() * 4 })
      }
      const x = solveVpsc({ desired, weight, separations })
      expect(feasible(x, separations)).toBe(true)
      const best = cost(x, desired, weight)
      for (let t = 0; t < 300; t++) {
        const step = 10 ** -(1 + Math.floor(rnd() * 3))
        const y = x.map((v) => v + (rnd() - 0.5) * 2 * step)
        if (feasible(y, separations, 0)) {
          expect(cost(y, desired, weight)).toBeGreaterThanOrEqual(best - 1e-9)
        }
      }
    }
  })
})
