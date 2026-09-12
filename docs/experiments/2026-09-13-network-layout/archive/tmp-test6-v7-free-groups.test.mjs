import { expect, test } from 'bun:test'
import { connectionMetrics } from './tmp-test6-v7-boundary-search.mjs'
import { interiorMetrics } from './tmp-test6-v7-interior-objective.mjs'
import { upstreamContext } from './tmp-test6-v7-upstream.mjs'

test('disabling whole-frame order permits adjacent and reversed non-root groups', () => {
  const groups = [0, 1, 2].map((i) => ({ members: [i], w: 100, h: 50 }))
  const links = [
    { a: 0, b: 1, ga: 0, gb: 1 },
    { a: 1, b: 2, ga: 1, gb: 2 },
  ]
  const seed = Float64Array.from([0, 0, -150, 120, 150, 120])
  const free = upstreamContext(groups, links, 3, 0, 0, seed, false)
  const constrained = upstreamContext(groups, links, 3, 0, 0, seed, true)
  expect(free.project(seed)).toEqual(seed)
  expect(free.violations(seed)).toBe(0)
  expect(constrained.violations(seed)).toBeGreaterThan(0)
  const reversed = Float64Array.from([0, 0, -150, 220, 150, 120])
  expect(free.project(reversed)).toEqual(reversed)
  const above = Float64Array.from([0, 0, -150, -120, 150, 120])
  expect(free.project(above)[3]).toBeGreaterThan(0)
  expect(free.parents).toEqual(constrained.parents)
})

test('free-group render retains topology, interior hierarchy, geometry and scoring reference', async () => {
  const before = await Bun.file('tmp-test6-v7-rooted-interior-refined-report.json').json()
  const after = await Bun.file('tmp-test6-v7-free-groups-report.json').json()
  expect(after.enforceGroupOrder).toBe(false)
  expect(after.macro.boundarySearch.enforceGroupOrder).toBe(false)
  expect(after.inputHash).toBe(before.inputHash)
  expect(after.counts).toEqual(before.counts)
  expect(after.groups.map((g) => [g.id, g.w, g.h, g.hierarchy])).toEqual(
    before.groups.map((g) => [g.id, g.w, g.h, g.hierarchy]),
  )
  expect(after.nodes.map((n) => [n.id, n.w, n.h, n.depth, n.rootDistance, n.parentNodes])).toEqual(
    before.nodes.map((n) => [n.id, n.w, n.h, n.depth, n.rootDistance, n.parentNodes]),
  )
  expect(after.links.map((l) => [l.id, l.a, l.b])).toEqual(
    before.links.map((l) => [l.id, l.a, l.b]),
  )
  expect(Object.values(after.checks).every((v) => v === 0)).toBe(true)
  const d = after.macro.boundarySearch
  expect(d.normalizationRouted).toEqual(before.macro.boundarySearch.normalizationRouted)
  expect(d.normalizationFast).toEqual(before.macro.boundarySearch.normalizationFast)
  expect(d.finalScore).toBeLessThanOrEqual(d.initialRoutedScore)
  expect(d.selectedRouted).toEqual({
    ...connectionMetrics(after.links, after.nodes, after.terminals, after.links),
    ...interiorMetrics(after.nodes, after.groups, after.links, after.nodes, after.terminals),
  })
  const svg = await Bun.file('tmp-test6-v7-free-groups.svg').text()
  expect((svg.match(/<path data-link=/g) || []).length).toBe(160)
  expect((svg.match(/<circle/g) || []).length).toBe(196)
})
