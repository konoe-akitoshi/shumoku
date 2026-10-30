// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { bandLanes, bandSpans, orderBundles } from './bundle-order.js'
import { routeGlobal } from './global.js'
import { layoutParts } from './layout.js'
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
  const routes = routeGlobal(problem, geometry, space)
  const ordering = orderBundles(space, routes, testMetrics.pitch)
  return { problem, space, routes, ordering }
}

describe('the order of lines at the doors', () => {
  const { space, routes, ordering } = run()

  it('has at each door exactly the lines that pass it, once for each time', () => {
    for (const [door, passings] of ordering.doors) {
      const through = [...routes.routes.values()].flatMap((r) =>
        r.steps.filter((s) => s.door === door).map(() => r.line),
      )
      expect(passings.map((e) => e.split('@')[0]).sort()).toEqual(through.sort())
    }
  })

  it('leaves out the doors of a band, which has its own order', () => {
    for (const id of Object.values(space.bands)) {
      for (const d of space.cells[id]?.doors ?? []) expect(ordering.doors.has(d.door)).toBe(false)
    }
  })

  it('crosses no more than lines put at each door in the order they were estimated to cross it', () => {
    expect(ordering.crossings).toBeLessThanOrEqual(ordering.crossingsByEstimate)
  })

  it('never crosses more once the ports follow the bundles', () => {
    expect(ordering.crossings).toBeLessThanOrEqual(ordering.crossingsBefore)
  })

  it('searches every order, for bundles of up to eight lines', () => {
    expect(ordering.approximated).toBe(0)
  })

  it('is the same for the same input', () => {
    const again = run().ordering
    expect([...again.doors]).toEqual([...ordering.doors])
    expect(again.crossings).toBe(ordering.crossings)
  })
})

describe('the lanes of a band', () => {
  const span = (line: string, lo: number, hi: number) => ({ line, lo, hi })

  it('puts a span inside another nearer the terminals', () => {
    const { lane, lanes, crossings } = bandLanes([
      span('out', 0, 9),
      span('mid', 2, 7),
      span('in', 3, 5),
    ])
    expect(lane.get('in')).toBe(0)
    expect(lane.get('mid')).toBe(1)
    expect(lane.get('out')).toBe(2)
    expect(lanes).toBe(3)
    expect(crossings).toBe(0)
  })

  it('lets spans that are apart share a lane', () => {
    const { lane, lanes } = bandLanes([span('a', 0, 2), span('b', 3, 5), span('c', 6, 8)])
    expect([...lane.values()]).toEqual([0, 0, 0])
    expect(lanes).toBe(1)
  })

  it('puts two that interlock in different lanes and counts one crossing', () => {
    const { lane, crossings } = bandLanes([span('a', 0, 5), span('b', 3, 8)])
    expect(lane.get('a')).not.toBe(lane.get('b'))
    expect(crossings).toBe(1)
  })

  it('uses as many lanes as lines are side by side at most, for spans none of which interlock', () => {
    const spans = [
      span('a', 0, 10),
      span('b', 1, 4),
      span('c', 5, 9),
      span('d', 6, 8),
      span('e', 2, 3),
    ]
    const { lanes } = bandLanes(spans)
    let most = 0
    for (const s of spans) {
      most = Math.max(most, spans.filter((o) => o.lo <= s.lo && s.lo < o.hi).length)
    }
    expect(lanes).toBe(most)
  })

  it('uses the fewest lanes that keep inner spans nearer and overlapping ones apart', () => {
    // a small deterministic sweep of span sets, against every assignment of lanes
    let seed = 7
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    for (let round = 0; round < 40; round++) {
      const n = 2 + next(4)
      const spans = Array.from({ length: n }, (_, i) => {
        const a = next(8)
        return span(`s${i}`, a, a + 1 + next(6))
      })
      const { lanes, crossings } = bandLanes(spans)
      let best = Number.POSITIVE_INFINITY
      const assign = new Array<number>(n).fill(0)
      const ok = () =>
        spans.every((s, i) =>
          spans.every((o, j) => {
            if (i === j || !(s.lo < o.hi && o.lo < s.hi)) return true
            const inside = s.lo <= o.lo && o.hi <= s.hi
            const outside = o.lo <= s.lo && s.hi <= o.hi
            if (inside && outside) return assign[i] !== assign[j]
            if (inside) return (assign[j] ?? 0) < (assign[i] ?? 0)
            if (outside) return (assign[i] ?? 0) < (assign[j] ?? 0)
            return assign[i] !== assign[j]
          }),
        )
      const walk = (i: number) => {
        if (i === n) {
          if (ok()) best = Math.min(best, Math.max(...assign) + 1)
          return
        }
        for (let l = 0; l < n; l++) {
          assign[i] = l
          walk(i + 1)
        }
      }
      walk(0)
      expect(lanes).toBe(best)
      let interlock = 0
      for (const [i, s] of spans.entries()) {
        for (const o of spans.slice(i + 1)) {
          if (
            (s.lo < o.lo && o.lo < s.hi && s.hi < o.hi) ||
            (o.lo < s.lo && s.lo < o.hi && o.hi < s.hi)
          ) {
            interlock++
          }
        }
      }
      expect(crossings).toBe(interlock)
    }
  })

  it('finds a band for the lines laid over the drawing', () => {
    const { space, routes, ordering } = run()
    const spans = bandSpans(space, routes, ordering, 'top')
    expect(spans.length).toBe(2)
    expect(bandSpans(space, routes, ordering, 'bottom').length).toBe(1)
  })
})
