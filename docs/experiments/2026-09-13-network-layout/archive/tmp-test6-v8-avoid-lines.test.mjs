import { expect, test } from 'bun:test'
import {
  measureLineAvoidance,
  refreshNodeEndpoints,
  segmentPenetration,
} from './tmp-test6-v8-line-avoidance.mjs'
import { nodeSideMidpoint } from './tmp-test6-v8-node-attachments.mjs'

test('penetration distinguishes intersections, boundary contact, and near misses', () => {
  const n = { x: 0, y: 0, w: 20, h: 20 }
  expect(segmentPenetration({ x: -30, y: 0 }, { x: 30, y: 0 }, n)).toBe(10)
  expect(segmentPenetration({ x: -30, y: 10 }, { x: 30, y: 10 }, n)).toBe(0)
  expect(segmentPenetration({ x: -30, y: 14 }, { x: 30, y: 14 }, n)).toBe(0)
  expect(segmentPenetration({ x: -30, y: 14 }, { x: 30, y: 14 }, n, 8)).toBe(4)
  expect(segmentPenetration({ x: -30, y: 30 }, { x: 30, y: 30 }, n, 8)).toBe(0)
})

test('own endpoints are excluded; unrelated node/link pairs count once', () => {
  const nodes = [
    { x: -30, y: 0, w: 10, h: 10 },
    { x: 30, y: 0, w: 10, h: 10 },
    { x: 0, y: 0, w: 10, h: 10 },
  ]
  const links = [
    {
      id: 'l',
      a: 0,
      b: 1,
      points: [
        { x: -30, y: 0 },
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
    },
  ]
  expect(measureLineAvoidance(nodes, links).hits).toBe(1)
  const moved = nodes.map((n) => ({ ...n }))
  moved[2].y = 20
  expect(measureLineAvoidance(moved, links).hits).toBe(0)
})

test('local avoidance improves intersections without moving groups, ports or exterior paths', async () => {
  const a = await Bun.file('tmp-test6-v8-side-centers-report.json').json()
  const b = await Bun.file('tmp-test6-v8-avoid-lines-report.json').json()
  for (const key of ['inputHash', 'counts', 'groups', 'terminals']) expect(b[key]).toEqual(a[key])
  expect(b.avoidance.after.hits).toBeLessThan(b.avoidance.before.hits)
  expect(measureLineAvoidance(b.nodes, b.links, b.avoidance.options.clearance)).toEqual(
    b.avoidance.after,
  )
  expect(b.links.map((l) => [l.id, l.a, l.b])).toEqual(a.links.map((l) => [l.id, l.a, l.b]))
  for (const [i, n] of b.nodes.entries()) {
    const original = a.nodes[i]
    expect([n.id, n.w, n.h, n.depth, n.parentNodes]).toEqual([
      original.id,
      original.w,
      original.h,
      original.depth,
      original.parentNodes,
    ])
    expect(Math.hypot(n.x - original.x, n.y - original.y)).toBeLessThanOrEqual(24 + 1e-6)
    const g = b.groups.find((g) => g.members.includes(i))
    expect(n.x - n.w / 2).toBeGreaterThanOrEqual(g.x - g.w / 2)
    expect(n.x + n.w / 2).toBeLessThanOrEqual(g.x + g.w / 2)
    expect(n.y - n.h / 2).toBeGreaterThanOrEqual(g.y - g.h / 2)
    expect(n.y + n.h / 2).toBeLessThanOrEqual(g.y + g.h / 2)
    if (n.id === 'test:internet') expect([n.x, n.y]).toEqual([original.x, original.y])
    for (const j of g.members) {
      if (j === i) continue
      const other = b.nodes[j]
      expect(
        Math.abs(n.x - other.x) >= (n.w + other.w) / 2 - 1e-6 ||
          Math.abs(n.y - other.y) >= (n.h + other.h) / 2 - 1e-6,
      ).toBe(true)
      if (n.depth < other.depth) expect(n.y + n.h / 2).toBeLessThan(other.y - other.h / 2)
    }
  }
  expect(refreshNodeEndpoints(a, b.nodes).map((l) => l.points)).toEqual(
    b.links.map((l) => l.points),
  )
  for (const [i, l] of b.links.entries()) {
    if (l.crossGroup) expect(l.points.slice(1, -1)).toEqual(a.links[i].points.slice(1, -1))
    expect(l.points[0]).toEqual(
      nodeSideMidpoint(b.nodes, b.nodes, l.a, l.crossGroup ? l.exit : b.nodes[l.b]),
    )
    expect(l.points.at(-1)).toEqual(
      nodeSideMidpoint(b.nodes, b.nodes, l.b, l.crossGroup ? l.entry : b.nodes[l.a]),
    )
  }
  const svg = await Bun.file('tmp-test6-v8-avoid-lines.svg').text()
  expect((svg.match(/<path data-link=/g) || []).length).toBe(160)
  expect((svg.match(/<g data-node=/g) || []).length).toBe(89)
  expect((svg.match(/transform="translate\(/g) || []).length).toBe(b.avoidance.moved.length)
})
