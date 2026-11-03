// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { CycleError, solveAxis } from './axis.js'
import { ledgerOf } from './ledger.js'

/**
 * The slow answer: whether the values can be solved with the equality added, and every
 * separation holds in them (a separation between two values that became one is not looked at
 * by the solver, so it is looked at here).
 */
const solves = (
  n: number,
  sep: { i: number; j: number; d: number }[],
  equal: { i: number; j: number; d: number }[],
): boolean => {
  try {
    const v = solveAxis({ n, sep, equal, pull: [], pair: [], tolerance: 1e-3 })
    return (
      sep.every((c) => (v[c.j] ?? 0) - (v[c.i] ?? 0) >= c.d - 1e-6) &&
      equal.every((c) => Math.abs((v[c.j] ?? 0) - (v[c.i] ?? 0) - c.d) <= 1e-6)
    )
  } catch (e) {
    if (e instanceof CycleError) return false
    throw e
  }
}

describe('the ledger of equalities agrees with solving the values', () => {
  it('on separations that run both ways and equalities between random variables', () => {
    let seed = 7
    const next = (k: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % k
    }
    for (let round = 0; round < 40; round++) {
      const n = 6 + next(10)
      // a base that holds: separations along an order, and a few caps that give room back
      const sep: { i: number; j: number; d: number }[] = []
      for (let k = 0; k < n * 2; k++) {
        const a = next(n)
        const b = next(n)
        if (a < b) sep.push({ i: a, j: b, d: 1 + next(5) })
      }
      for (let k = 0; k < 3; k++) {
        const a = next(n)
        const b = next(n)
        if (a < b) sep.push({ i: b, j: a, d: -(20 + next(10)) })
      }
      if (!solves(n, sep, [])) continue
      const held: { i: number; j: number; d: number }[] = []
      const ledger = ledgerOf(n, sep, [])
      for (let k = 0; k < 30; k++) {
        const i = next(n)
        const j = next(n)
        if (i === j) continue
        const e = { i, j, d: next(12) - 3 }
        const slow = solves(n, sep, [...held, e])
        expect(ledger.admits(e)).toBe(slow)
        if (slow) {
          ledger.add(e)
          held.push(e)
        }
      }
    }
  })
})
