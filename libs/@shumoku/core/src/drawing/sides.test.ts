// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { ranksOf } from './ranks.js'
import { sidesByRank } from './sides.js'
import { problemOf } from './testing/support.js'

// top reaches a and b one cable away, and a and b are level; c hangs off a, and x and y are
// cabled to each other only.
const yaml = `
nodes:
  - { id: top }
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: x }
  - { id: y }
  - { id: p }
  - { id: q }
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
  - { endpoints: [{ node: x }, { node: y }] }
  - { endpoints: [{ node: p }, { node: q }], virtual: true }
`

describe('the sides a line leaves its boxes by, from the ranks of its ends', () => {
  const p = problemOf(yaml, ['top'])
  const { rank } = ranksOf(p)
  const line = (from: string, to: string, role: string) =>
    p.lines.find(
      (l) => l.role === role && [l.a.item, l.b.item].sort().join() === [from, to].sort().join(),
    )

  it('takes a line down the flow out of the bottom of the upper box and into the top of the lower', () => {
    const l = line('top', 'a', 'oriented')
    expect(l).toBeDefined()
    if (!l) return
    const sides = sidesByRank(l, rank)
    const upper = l.a.item === 'top' ? sides?.a : sides?.b
    const lower = l.a.item === 'top' ? sides?.b : sides?.a
    expect(upper).toEqual(['bottom'])
    expect(lower).toEqual(['top'])
  })

  it('takes a line between level boxes out by their sides, whichever faces the other', () => {
    const l = line('a', 'b', 'oriented')
    expect(l).toBeDefined()
    if (!l) return
    expect(sidesByRank(l, rank)).toEqual({ a: ['left', 'right'], b: ['left', 'right'] })
  })

  it('takes a line the structure leaves unrelated out by the ranks: the upper by its bottom, level by the sides', () => {
    for (const l of p.lines.filter((x) => x.role === 'unrelated')) {
      const [ra, rb] = [rank.get(l.a.item) ?? 0, rank.get(l.b.item) ?? 0]
      const sides = sidesByRank(l, rank)
      if (ra === rb) expect(sides).toEqual({ a: ['left', 'right'], b: ['left', 'right'] })
      else if (ra < rb) expect(sides).toEqual({ a: ['bottom'], b: ['top'] })
      else expect(sides).toEqual({ a: ['top'], b: ['bottom'] })
    }
  })

  it('routes no line inside a unit', () => {
    for (const l of p.lines.filter((x) => x.role === 'inside'))
      expect(sidesByRank(l, rank)).toBeUndefined()
  })
})
