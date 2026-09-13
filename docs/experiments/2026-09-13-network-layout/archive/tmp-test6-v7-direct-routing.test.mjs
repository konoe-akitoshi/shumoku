import { expect, test } from 'bun:test'
import { routeBoundaryConnections, segmentHits } from './tmp-test6-v7-boundary-routing.mjs'

test('diagonal visible boundary points connect directly without normal stubs', () => {
  const groups = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 300, y: 100, w: 100, h: 100 },
  ]
  const nodes = [
      { w: 20, h: 20 },
      { w: 20, h: 20 },
    ],
    positions = [
      { x: 0, y: 0 },
      { x: 300, y: 100 },
    ]
  const links = [{ id: 'a', a: 0, b: 1, ga: 0, gb: 1 }]
  const terminals = [
    { li: 0, end: 'a', x: 50, y: 10, nx: 1, ny: 0 },
    { li: 0, end: 'b', x: 250, y: 90, nx: -1, ny: 0 },
  ]
  const [r] = routeBoundaryConnections({ groups, nodes, positions, links, terminals })
  expect(r.points.slice(1, -1)).toEqual([
    { x: 50, y: 10 },
    { x: 250, y: 90 },
  ])
})

test('real obstacle still requires a detour, but boundary contact is allowed', () => {
  const groups = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 300, y: 0, w: 100, h: 100 },
    { x: 150, y: 0, w: 40, h: 80 },
  ]
  const nodes = [
      { w: 20, h: 20 },
      { w: 20, h: 20 },
    ],
    positions = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]
  const links = [{ id: 'a', a: 0, b: 1, ga: 0, gb: 1 }]
  const terminals = [
    { li: 0, end: 'a', x: 50, y: 0 },
    { li: 0, end: 'b', x: 250, y: 0 },
  ]
  const [r] = routeBoundaryConnections({ groups, nodes, positions, links, terminals })
  const ps = r.points.slice(1, -1)
  expect(ps.length).toBeGreaterThan(2)
  for (const [i, p] of ps.entries())
    if (i)
      expect(segmentHits(ps[i - 1], p, { left: 130, right: 170, top: -40, bottom: 40 })).toBe(false)
  expect(
    segmentHits(
      { x: 130, y: -40 },
      { x: 170, y: -40 },
      { left: 130, right: 170, top: -40, bottom: 40 },
    ),
  ).toBe(false)
})

test('rerender changes only paths, fixes all 44 avoidable bends, and keeps every boundary endpoint', async () => {
  const a = await Bun.file('tmp-test6-v7-free-groups-report.json').json()
  const b = await Bun.file('tmp-test6-v7-direct-routing-report.json').json()
  for (const key of ['inputHash', 'counts', 'nodes', 'groups', 'terminals'])
    expect(b[key]).toEqual(a[key])
  expect(b.links.map((l) => [l.id, l.a, l.b, l.exit, l.entry])).toEqual(
    a.links.map((l) => [l.id, l.a, l.b, l.exit, l.entry]),
  )
  expect(b.routing.previousClearButBent).toBe(44)
  expect(Object.values(b.routing.checks).every((v) => v === 0)).toBe(true)
  const actual = routeBoundaryConnections({
    groups: b.groups,
    nodes: b.nodes,
    positions: b.nodes,
    links: b.links,
    terminals: b.terminals,
  })
  expect(actual.map((l) => l.points)).toEqual(b.links.map((l) => l.points))
  expect(b.routing.after.totalLength).toBeLessThan(b.routing.before.totalLength)
})
