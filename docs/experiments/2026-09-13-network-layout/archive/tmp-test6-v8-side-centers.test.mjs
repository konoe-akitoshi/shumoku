import { expect, test } from 'bun:test'
import { routeBoundaryConnections } from './tmp-test6-v7-boundary-routing.mjs'
import { nodeSideMidpoint } from './tmp-test6-v8-node-attachments.mjs'

test('all four sides use their exact midpoint, with aspect-ratio-aware side selection', () => {
  const nodes = [{ w: 100, h: 40 }],
    ps = [{ x: 10, y: 20 }]
  expect(nodeSideMidpoint(nodes, ps, 0, { x: 200, y: 30 })).toEqual({ x: 60, y: 20 })
  expect(nodeSideMidpoint(nodes, ps, 0, { x: -200, y: 30 })).toEqual({ x: -40, y: 20 })
  expect(nodeSideMidpoint(nodes, ps, 0, { x: 20, y: 200 })).toEqual({ x: 10, y: 40 })
  expect(nodeSideMidpoint(nodes, ps, 0, { x: 20, y: -200 })).toEqual({ x: 10, y: 0 })
  expect(nodeSideMidpoint(nodes, ps, 0, { x: 80, y: 80 })).toEqual({ x: 10, y: 40 })
  expect(nodeSideMidpoint(nodes, ps, 0, { x: 110, y: 60 })).toEqual({ x: 60, y: 20 })
})

test('V8 preserves every node/group and external polyline; every link attaches at a midpoint', async () => {
  const a = await Bun.file('tmp-test6-v7-direct-routing-report.json').json()
  const b = await Bun.file('tmp-test6-v8-side-centers-report.json').json()
  expect(b.version).toBe(8)
  for (const key of ['inputHash', 'counts', 'nodes', 'groups', 'terminals'])
    expect(b[key]).toEqual(a[key])
  expect(Object.values(b.routing.checks).every((v) => v === 0)).toBe(true)
  for (const [i, l] of b.links.entries()) {
    expect([l.id, l.a, l.b, l.exit, l.entry]).toEqual([
      a.links[i].id,
      a.links[i].a,
      a.links[i].b,
      a.links[i].exit,
      a.links[i].entry,
    ])
    if (l.crossGroup) expect(l.points.slice(1, -1)).toEqual(a.links[i].points.slice(1, -1))
    expect(l.points[0]).toEqual(
      nodeSideMidpoint(b.nodes, b.nodes, l.a, l.crossGroup ? l.exit : b.nodes[l.b]),
    )
    expect(l.points.at(-1)).toEqual(
      nodeSideMidpoint(b.nodes, b.nodes, l.b, l.crossGroup ? l.entry : b.nodes[l.a]),
    )
  }
  const actual = routeBoundaryConnections({
    nodes: b.nodes,
    groups: b.groups,
    positions: b.nodes,
    links: b.links,
    terminals: b.terminals,
    nodeAttachment: nodeSideMidpoint,
  })
  expect(actual.map((l) => l.points)).toEqual(b.links.map((l) => l.points))
  const svg = await Bun.file('tmp-test6-v8-side-centers.svg').text()
  expect(svg).toContain('V8 ·')
  expect((svg.match(/<path data-link=/g) || []).length).toBe(160)
})
