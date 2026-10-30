// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { orderBundles } from './bundle-order.js'
import { createRouter } from './global.js'
import { layoutParts } from './layout.js'
import { rerouteForCrossings } from './reroute.js'
import { buildSpace } from './space.js'
import { networkOf, testMetrics } from './testing.js'

const yaml = `
nodes:
  - { id: top }
  - { id: a, group: g }
  - { id: b, group: g }
  - { id: c }
  - { id: d }
  - { id: x }
  - { id: y }
groups: [{ id: g }]
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
  - { endpoints: [{ node: b }, { node: c }] }
  - { endpoints: [{ node: a }, { node: d }] }
  - { endpoints: [{ node: b }, { node: d }] }
  - { endpoints: [{ node: top }, { node: c }], virtual: true }
  - { endpoints: [{ node: top }, { node: d }], virtual: true }
  - { endpoints: [{ node: x }, { node: y }] }
`

function run() {
  const { network, structure } = networkOf(yaml, ['top'])
  const { problem, geometry } = layoutParts(network, structure, testMetrics)
  const space = buildSpace(problem, geometry)
  const router = createRouter(problem, geometry, space)
  const before = orderBundles(space, router.result, testMetrics.pitch)
  const stepsBefore = new Map([...router.result.routes].map(([k, r]) => [k, r.steps]))
  const done = rerouteForCrossings(problem, space, router)
  return { problem, space, router, before, stepsBefore, done }
}

describe('laying lines again for the crossings the orders count', () => {
  const { problem, space, router, before, stepsBefore, done } = run()

  it('never ends with more crossings than it began with', () => {
    expect(done.ordering.crossings).toBeLessThanOrEqual(before.crossings)
  })

  it('keeps no route that it did not count fewer crossings for, or as many and shorter', () => {
    expect(done.accepted).toBeLessThanOrEqual(done.tried)
    if (done.accepted === 0) {
      for (const [k, r] of router.result.routes) expect(r.steps).toEqual(stepsBefore.get(k))
    }
  })

  it('leaves the orders as those of the routes that are left', () => {
    const again = orderBundles(space, router.result, testMetrics.pitch)
    expect(again.crossings).toBe(done.ordering.crossings)
    expect([...again.doors]).toEqual([...done.ordering.doors])
  })

  it('leaves every line routed and the count of lines through each door as the routes say', () => {
    expect(router.result.unroutable).toEqual([])
    const used = new Map<number, number>()
    for (const r of router.result.routes.values()) {
      for (const s of r.steps) used.set(s.door, (used.get(s.door) ?? 0) + 1)
    }
    for (const [door, n] of used) expect(router.result.used[door]).toBe(n)
    const total = [...router.result.used].reduce((a, b) => a + b, 0)
    expect(total).toBe([...used.values()].reduce((a, b) => a + b, 0))
    for (const l of problem.lines) {
      if (l.role !== 'inside') expect(router.result.routes.has(l.id)).toBe(true)
    }
  })

  it('is the same for the same input', () => {
    const again = run()
    expect(again.done.accepted).toBe(done.accepted)
    expect(again.done.ordering.crossings).toBe(done.ordering.crossings)
  })
})
