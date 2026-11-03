// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layerStagesOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'
import { inversions } from './cost.js'
import { flatten } from './flatten.js'

type Pairs = { p: number; q: number; w: number }[]

const randomPairs = (seed: number, count: number): Pairs => {
  let state = seed
  const next = (n: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % n
  }
  return Array.from({ length: count }, () => ({ p: next(6), q: next(6), w: 1 + next(3) }))
}

/** Every pair looked at once: both ends must stand strictly the other way round. */
const bruteForce = (pairs: Pairs) => {
  let count = 0
  for (const [i, x] of pairs.entries())
    for (const y of pairs.slice(i + 1)) if ((x.p - y.p) * (x.q - y.q) < 0) count += x.w * y.w
  return count
}

describe('counting inversions', () => {
  it('agrees with looking at every pair, ties included', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const pairs = randomPairs(seed, seed % 12)
      expect(inversions(pairs)).toBe(bruteForce(pairs))
    }
  })

  it('counts nothing for lines that keep their order', () => {
    const keep = [
      { p: 0, q: 0, w: 1 },
      { p: 1, q: 1, w: 1 },
      { p: 2, q: 5, w: 4 },
    ]
    expect(inversions(keep)).toBe(0)
  })

  it('counts one crossing, weighed by both lines, for two lines that swap', () => {
    expect(
      inversions([
        { p: 0, q: 1, w: 2 },
        { p: 1, q: 0, w: 3 },
      ]),
    ).toBe(6)
  })
})

describe('judging an order', () => {
  it('counts the crossings of each gap as the brute-force count of its segments', () => {
    const { lookup, initial, judge } = layerStagesOf(generatedYaml(30), ['top'])
    const flat = flatten(lookup, initial)
    for (const [g, list] of lookup.gapSegs.entries()) {
      const place = (key: string, port: string) =>
        (port ? flat.end.get(port) : undefined) ?? (flat.pos.get(key) ?? 0) + 0.5
      const pairs = list.map((s) => ({ p: place(s.a, s.pa), q: place(s.b, s.pb), w: s.w }))
      expect(judge.gapCost(g, flat)).toBe(bruteForce(pairs))
    }
  })
})
