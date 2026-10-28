// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { cutKey, cutsOf, liftFlows } from './lift.js'
import { frameKey, type Problem } from './problem.js'
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

const allOff = (p: Problem): Problem => ({
  ...p,
  stack: Object.fromEntries(
    liftFlows(p).flatMap((s) =>
      Array.from({ length: cutsOf(s) }, (_, k) => [cutKey(s.frame, k), false] as const),
    ),
  ),
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

  it('lets frames overlap vertically when the cut between them is off', () => {
    const y = solveVertical(allOff(on))
    expect(y.stacked).toEqual([])
    expect(top(y, 'gb')).toBeLessThan(bottom(y, 'ga'))
  })

  it('keeps every flow whichever way the frames are stacked', () => {
    for (const p of [on, allOff(on)]) {
      const y = solveVertical(p)
      for (const { upper, lower } of p.above) {
        expect(y.top.get(lower) ?? 0).toBeGreaterThan(y.bottom.get(upper) ?? 0)
      }
    }
  })
})
