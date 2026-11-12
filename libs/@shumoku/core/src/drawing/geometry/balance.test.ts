// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../../fixtures/index.js'
import { readNetworkModel } from '../../models/network-model-graph.js'
import { solveAxis } from '../axis.js'
import { drawNetwork } from '../draw.js'
import { axesOf } from '../geometry.js'
import { planningOf } from '../testing/stages.js'
import { testMetrics } from '../testing/support.js'
import { BALANCE_WEIGHT, balanceOf } from './balance.js'

const fan = `
nodes:
  - { id: wan, type: external }
  - { id: core }
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - endpoints: [{ node: wan }, { node: core }]
  - endpoints: [{ node: core }, { node: a }]
  - endpoints: [{ node: core }, { node: b }]
  - endpoints: [{ node: core }, { node: c }]
`

describe('balanceOf', () => {
  it('draws the middle of every box to the middle of the one above it, weakly and in order', () => {
    const plan = planningOf(sampleNetworkYaml, [])
    const { xAxis } = axesOf(plan)
    const { pair } = balanceOf(plan, xAxis)
    expect(pair).toHaveLength(plan.problem.above.length)
    expect(pair.length).toBeGreaterThan(0)
    for (const [k, p] of pair.entries()) {
      const above = plan.problem.above[k]
      expect(p.w).toBe(BALANCE_WEIGHT)
      expect(p.w).toBeLessThan(1)
      expect(p.i).toBe(xAxis.midRef(above?.upper ?? '').v)
      expect(p.j).toBe(xAxis.midRef(above?.lower ?? '').v)
    }
  })

  it('asks nothing of a network with no flow', () => {
    const plan = planningOf('nodes:\n  - { id: a }\n  - { id: b }\nlinks: []\n', [])
    const { xAxis } = axesOf(plan)
    expect(balanceOf(plan, xAxis).pair).toEqual([])
  })

  it('brings a parent to the mean of its children in the least squares', () => {
    // 0 is the parent, 1..3 the children held 10 apart and pinned by bounds
    const v = solveAxis({
      n: 4,
      sep: [],
      equal: [],
      pull: [
        { i: 1, t: 0, w: 1000 },
        { i: 2, t: 10, w: 1000 },
        { i: 3, t: 40, w: 1000 },
      ],
      pair: [1, 2, 3].map((j) => ({ i: 0, j, w: BALANCE_WEIGHT, d: 0 })),
      tolerance: 0.001,
    })
    expect(v[0]).toBeCloseTo(((v[1] ?? 0) + (v[2] ?? 0) + (v[3] ?? 0)) / 3, 1)
  })
})

describe('a parent over its children', () => {
  it('stands within the span of the children it hands over to', () => {
    const scene = drawNetwork(readNetworkModel(fan), { metrics: () => testMetrics })
    const mid = (id: string) => {
      const b = scene.nodes.find((n) => n.node.id === id)?.box
      return (b?.x ?? Number.NaN) + (b?.width ?? 0) / 2
    }
    const kids = ['a', 'b', 'c'].map(mid)
    expect(mid('core')).toBeGreaterThanOrEqual(Math.min(...kids) - 1e-6)
    expect(mid('core')).toBeLessThanOrEqual(Math.max(...kids) + 1e-6)
    expect(mid('wan')).toBeCloseTo(mid('core'), 3)
  })

  it('is drawn the same every time', () => {
    const draw = () =>
      JSON.stringify(drawNetwork(readNetworkModel(fan), { metrics: () => testMetrics }).nodes)
    expect(draw()).toBe(draw())
  })
})
