// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { liftFlows } from './lift.js'
import { frameKey } from './problem.js'
import { problemOf, testMetrics } from './testing.js'
import { solveVertical } from './vertical.js'

// ga holds the head of the flow and a leaf beside the row gb starts at, so that gb, when it is
// not stacked, shares a row with the leaf and the frames overlap vertically.
const yaml = `
groups: [{ id: ga }, { id: gb }, { id: gc }]
nodes:
  - { id: top, group: ga }
  - { id: leaf, group: ga }
  - { id: b1, group: gb }
  - { id: c1, group: gc }
links:
  - { endpoints: [{ node: top }, { node: leaf }] }
  - { endpoints: [{ node: top }, { node: b1 }] }
  - { endpoints: [{ node: top }, { node: c1 }] }
`

// Two sites under a head, each holding a branch of its own, so that the frames to stack are
// siblings at two depths.
const deep = `
groups: [{ id: site }, { id: ha }, { id: hb }, { id: sa }, { id: sb }]
nodes:
  - { id: top, group: site }
  - { id: a1, group: ha }
  - { id: b1, group: hb }
  - { id: a2, group: sa }
  - { id: b2, group: sb }
links:
  - { endpoints: [{ node: top }, { node: a1 }] }
  - { endpoints: [{ node: top }, { node: b1 }] }
  - { endpoints: [{ node: a1 }, { node: a2 }] }
  - { endpoints: [{ node: b1 }, { node: b2 }] }
`

describe('a room asked between the edges of two boxes', () => {
  const on = problemOf(yaml, ['top'])
  it('is between the far edge of the first and the near edge of the second unless said otherwise', () => {
    const y = solveVertical(on, [{ axis: 'y', before: 'top', after: 'c1', min: 500 }])
    expect((y.top.get('c1') ?? 0) - (y.bottom.get('top') ?? 0)).toBeGreaterThanOrEqual(500 - 1e-6)
  })
  it('is between the edges it names: how far the second reaches past the first', () => {
    const y = solveVertical(on, [
      { axis: 'y', before: 'top', after: 'c1', min: 500, beforeAt: 'low', afterAt: 'low' },
    ])
    expect((y.top.get('c1') ?? 0) - (y.top.get('top') ?? 0)).toBeGreaterThanOrEqual(500 - 1e-6)
  })
})

describe('what the form of the height constraints says of two things', () => {
  const on = problemOf(yaml, ['top'])
  it('puts the head of a flow above its leaves, and says nothing of siblings the flows do not relate', () => {
    const y = solveVertical(on)
    expect(y.ordered('top', 'b1')).toBe(true)
    expect(y.ordered('b1', 'top')).toBe(true)
    expect(y.ordered('b1', 'c1')).toBe(false)
    expect(y.ordered(frameKey('gb'), frameKey('gc'))).toBe(false)
  })
  it('does not change with the room the wiring asks for', () => {
    const plain = solveVertical(on)
    const asked = solveVertical(on, [
      { axis: 'y', before: 'top', after: 'c1', min: 900 },
      { axis: 'y', before: frameKey('gb'), after: frameKey('gc'), min: 300 },
    ])
    const keys = [...plain.top.keys()]
    for (const a of keys)
      for (const b of keys) expect(asked.ordered(a, b)).toBe(plain.ordered(a, b))
    // the heights did move
    expect(asked.top.get('c1')).not.toBeCloseTo(plain.top.get('c1') ?? 0)
  })
})

describe('solveVertical', () => {
  const on = problemOf(yaml, ['top'])
  const top = (y: ReturnType<typeof solveVertical>, id: string) => y.top.get(frameKey(id)) ?? 0
  const bottom = (y: ReturnType<typeof solveVertical>, id: string) =>
    y.bottom.get(frameKey(id)) ?? 0

  it('holds a stacked frame a group gap below the frame above it', () => {
    const y = solveVertical(on)
    expect(y.stacked).toContainEqual([frameKey('ga'), frameKey('gb')])
    expect(top(y, 'gb')).toBeGreaterThanOrEqual(bottom(y, 'ga') + testMetrics.groupGap - 1e-6)
    expect(top(y, 'gc')).toBeGreaterThanOrEqual(bottom(y, 'ga') + testMetrics.groupGap - 1e-6)
  })

  it('does not stack frames the flows do not relate', () => {
    const y = solveVertical(on)
    const pairs = y.stacked.map((s) => s.join('|'))
    expect(pairs).not.toContain([frameKey('gb'), frameKey('gc')].join('|'))
    expect(pairs).not.toContain([frameKey('gc'), frameKey('gb')].join('|'))
    expect(Math.abs(top(y, 'gb') - top(y, 'gc'))).toBeLessThan(1e-6)
  })

  it('stacks every pair of sibling frames the flows put in order, nested ones too', () => {
    const nested = problemOf(deep, ['top'])
    const y = solveVertical(nested)
    const pairs = liftFlows(nested).flatMap((s) => s.pairs)
    expect(pairs.length).toBeGreaterThan(0)
    for (const { upper, lower } of pairs) {
      const isFrame = (k: string) => y.top.has(k) && y.bottom.has(k)
      if (!isFrame(upper) || !isFrame(lower)) continue
      expect(y.stacked).toContainEqual([upper, lower])
      expect((y.top.get(lower) ?? 0) - (y.bottom.get(upper) ?? 0)).toBeGreaterThanOrEqual(
        testMetrics.groupGap - 1e-6,
      )
    }
  })

  it('keeps every flow', () => {
    const y = solveVertical(on)
    for (const { upper, lower } of on.above) {
      expect(y.top.get(lower) ?? 0).toBeGreaterThan(y.bottom.get(upper) ?? 0)
    }
  })
})
