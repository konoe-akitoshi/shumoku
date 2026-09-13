import { expect, test } from 'bun:test'
import { measureWires, separationMoves } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { measureLineAvoidance, refreshNodeEndpoints } from './tmp-test6-v8-line-avoidance.mjs'

test('wire metrics measure actual crossings, overlap length and polyline length', () => {
  const links = [
    {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    },
    {
      points: [
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
    },
  ]
  expect(measureWires(links).crossings).toBe(1)
  expect(measureWires(links).overlapLength).toBe(0)
  expect(measureWires(links).length).toBeCloseTo(Math.sqrt(200) * 2)
  expect(
    measureWires([
      {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      },
      {
        points: [
          { x: 5, y: 0 },
          { x: 15, y: 0 },
        ],
      },
    ]).overlapLength,
  ).toBe(5)
})

test('required movement is derived from penetration and scales with geometry', () => {
  const a = { x: -100, y: 0 },
    b = { x: 100, y: 0 },
    n = { x: 0, y: 2, w: 40, h: 20 }
  const moves = separationMoves(a, b, n, 1)
  expect(moves).toContainEqual({ dx: 0, dy: 9 })
  const twice = separationMoves(
    { x: -200, y: 0 },
    { x: 200, y: 0 },
    { x: 0, y: 4, w: 80, h: 40 },
    2,
  )
  expect(twice).toEqual(moves.map((m) => ({ dx: m.dx * 2, dy: m.dy * 2 })))
})

test('dynamic output uses measured stroke widths and preserves hard geometry', async () => {
  const a = await Bun.file('tmp-test6-v8-side-centers-report.json').json()
  const b = await Bun.file('tmp-test6-v8-dynamic-avoidance-report.json').json()
  for (const key of ['inputHash', 'counts', 'groups', 'terminals']) expect(b[key]).toEqual(a[key])
  expect(b.avoidance.options.maxMove).toBeUndefined()
  expect(b.avoidance.options.clearance).toBe(
    (b.avoidance.options.wireWidth + b.avoidance.options.nodeStroke) / 2,
  )
  const metrics = {
    ...measureLineAvoidance(b.nodes, b.links, b.avoidance.options.clearance),
    ...measureWires(b.links),
  }
  expect(metrics).toEqual(b.avoidance.after)
  expect(metrics.hits).toBeLessThan(b.avoidance.before.hits)
  expect(refreshNodeEndpoints(a, b.nodes).map((l) => l.points)).toEqual(
    b.links.map((l) => l.points),
  )
  for (const [i, n] of b.nodes.entries()) {
    const g = b.groups.find((g) => g.members.includes(i))
    expect(n.x - n.w / 2).toBeGreaterThanOrEqual(g.x - g.w / 2 - 1e-6)
    expect(n.x + n.w / 2).toBeLessThanOrEqual(g.x + g.w / 2 + 1e-6)
    expect(n.y - n.h / 2).toBeGreaterThanOrEqual(g.y - g.h / 2 - 1e-6)
    expect(n.y + n.h / 2).toBeLessThanOrEqual(g.y + g.h / 2 + 1e-6)
    if (n.id === 'test:internet') expect([n.x, n.y]).toEqual([a.nodes[i].x, a.nodes[i].y])
    for (const j of g.members) {
      if (i === j) continue
      const m = b.nodes[j]
      expect(
        Math.abs(n.x - m.x) >= (n.w + m.w) / 2 - 1e-6 ||
          Math.abs(n.y - m.y) >= (n.h + m.h) / 2 - 1e-6,
      ).toBe(true)
      if (n.depth < m.depth) expect(n.y + n.h / 2).toBeLessThanOrEqual(m.y - m.h / 2)
    }
  }
  for (const [i, l] of b.links.entries())
    if (l.crossGroup) expect(l.points.slice(1, -1)).toEqual(a.links[i].points.slice(1, -1))
})
