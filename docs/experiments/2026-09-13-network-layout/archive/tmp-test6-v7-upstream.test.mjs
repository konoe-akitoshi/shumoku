import { expect, test } from 'bun:test'
import { upstreamContext } from './tmp-test6-v7-upstream.mjs'

test('explicit root orders connected groups without ordering peer links or mutating input', () => {
  const groups = [0, 1, 2, 3].map((i) => ({ members: [i], w: 100, h: 50 }))
  const links = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
  ].map(([a, b]) => ({ a, b, ga: a, gb: b }))
  const previous = Float64Array.from([20, 0, 20, -100, -20, -200, 0, -300])
  const snapshot = previous.slice()
  const context = upstreamContext(groups, links, 4, 0, 0, previous)
  expect(context.rank).toEqual([0, 1, 1, 2])
  expect(context.parents).toEqual([[], [0], [0], [1, 2]])
  expect(context.violations(context.initial)).toBe(0)
  expect(context.violations(context.project(previous))).toBe(0)
  expect(previous).toEqual(snapshot)
})

test('Internet-rooted output preserves topology and unfolded interiors', async () => {
  const a = await Bun.file('tmp-test6-v7-boundary-optimized-report.json').json()
  const b = await Bun.file('tmp-test6-v7-internet-upstream-report.json').json()
  expect(b.userSelectedUpstream).toBe('test:internet')
  expect(b.inputHash).toBe(a.inputHash)
  expect(b.counts).toEqual(a.counts)
  expect(b.links.map((l) => [l.id, l.a, l.b])).toEqual(a.links.map((l) => [l.id, l.a, l.b]))
  expect(b.groups.map((g) => [g.id, g.w, g.h])).toEqual(a.groups.map((g) => [g.id, g.w, g.h]))
  expect(b.nodes.map((n) => [n.id, n.depth, n.parentNode])).toEqual(
    a.nodes.map((n) => [n.id, n.depth, n.parentNode]),
  )
  expect(Object.values(b.checks).every((v) => v === 0)).toBe(true)
  expect(b.macro.boundarySearch.upstream.violations).toBe(0)
  const root = b.nodes.find((n) => n.id === 'test:internet')
  expect(root).toBeDefined()
  expect(b.nodes.every((n) => n.y >= root.y)).toBe(true)
  const svg = await Bun.file('tmp-test6-v7-internet-upstream.svg').text()
  expect((svg.match(/<path data-link=/g) || []).length).toBe(160)
  expect((svg.match(/<circle/g) || []).length).toBe(196)
})
