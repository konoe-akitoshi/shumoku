import { describe, expect, test } from 'bun:test'
import { routeBoundaryConnections, segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { boundaryTerminals, connectionMetrics } from './tmp-test6-v7-boundary-search.mjs'

describe('boundary-aware dependency placement', () => {
  const groups = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 300, y: 0, w: 100, h: 100 },
  ]
  const positions = [
    { x: 0, y: 25 },
    { x: 300, y: 25 },
  ]
  const links = [{ id: 'edge', a: 0, b: 1, ga: 0, gb: 1 }]
  test('terminals follow actual endpoint nodes, not group centres', () => {
    const ts = boundaryTerminals(groups, links, positions)
    expect(ts.map((t) => [t.x, t.y])).toEqual([
      [50, 25],
      [250, 25],
    ])
  })
  test('parallel records keep distinct boundary points', () => {
    const ts = boundaryTerminals(groups, [...links, { ...links[0], id: 'parallel' }], positions)
    expect(ts.length).toBe(4)
    expect(new Set(ts.map((t) => [t.g, t.x, t.y].join(':'))).size).toBe(4)
  })
  test('proper link-pair crossings are counted, shared-node branches excluded', () => {
    const ps = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    ]
    const ls = [
      { a: 0, b: 1, ga: 0, gb: 1 },
      { a: 2, b: 3, ga: 2, gb: 3 },
    ]
    const ts = [
      { li: 0, end: 'a', ...ps[0] },
      { li: 0, end: 'b', ...ps[1] },
      { li: 1, end: 'a', ...ps[2] },
      { li: 1, end: 'b', ...ps[3] },
    ]
    expect(connectionMetrics(ls, ps, ts).crossings).toBe(1)
    expect(connectionMetrics([{ ...ls[0] }, { ...ls[1], a: 0 }], ps, ts).crossings).toBe(0)
  })
  test('final renderer avoids intervening frames and does not mutate inputs', () => {
    const gs = [...groups, { x: 150, y: 0, w: 60, h: 120 }]
    const ns = positions.map((p) => ({ ...p, w: 20, h: 20 }))
    const ts = boundaryTerminals(gs, links, positions)
    const snapshot = JSON.stringify({ gs, ns, ts })
    const [route] = routeBoundaryConnections({
      groups: gs,
      nodes: ns,
      links,
      positions,
      terminals: ts,
    })
    expect(route).toBeDefined()
    expect(route.exit).toEqual({ x: 50, y: 25 })
    expect(route.entry).toEqual({ x: 250, y: 25 })
    const exterior = route.points.slice(1, -1)
    for (const [i, p] of exterior.entries())
      if (i)
        expect(
          segmentHits(exterior[i - 1], p, { left: 120, right: 180, top: -60, bottom: 60 }),
        ).toBe(false)
    expect(JSON.stringify({ gs, ns, ts })).toBe(snapshot)
  })
  test('removing forced stubs never lengthens the saved baseline routes', async () => {
    const r = await Bun.file('tmp-test6-v7-tree-report.json').json()
    const actual = routeBoundaryConnections({
      groups: r.groups,
      nodes: r.nodes,
      links: r.links,
      positions: r.nodes,
      terminals: r.terminals,
    })
    const length = (ps) =>
      ps.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - ps[i].x, p.y - ps[i].y), 0)
    for (const [i, l] of actual.entries()) {
      expect(length(l.points)).toBeLessThanOrEqual(length(r.links[i].points) + 1e-6)
      expect(l.points[0]).toEqual(r.links[i].points[0])
      expect(l.points.at(-1)).toEqual(r.links[i].points.at(-1))
    }
  })
  test('full output preserves input, dimensions, depths and selected route metrics', async () => {
    const a = await Bun.file('tmp-test6-v7-tree-report.json').json()
    const b = await Bun.file('tmp-test6-v7-boundary-optimized-report.json').json()
    expect(b.inputHash).toBe(a.inputHash)
    for (const key of ['nodes', 'links'])
      expect(b[key].map((n) => n.id)).toEqual(a[key].map((n) => n.id))
    expect(b.groups.map((g) => [g.id, g.w, g.h])).toEqual(a.groups.map((g) => [g.id, g.w, g.h]))
    expect(b.nodes.map((n) => [n.w, n.h, n.depth])).toEqual(a.nodes.map((n) => [n.w, n.h, n.depth]))
    expect(Object.values(b.checks).every((v) => v === 0)).toBe(true)
    const measured = connectionMetrics(b.links, b.nodes, b.terminals, b.links)
    expect(measured).toEqual(b.macro.boundarySearch.selectedRouted)
    expect(measured.crossings).toBeLessThan(b.macro.boundarySearch.originalRouted.crossings)
    expect(measured.totalLength).toBeLessThan(b.macro.boundarySearch.originalRouted.totalLength)
    const svg = await Bun.file('tmp-test6-v7-boundary-optimized.svg').text()
    expect((svg.match(/<path data-link=/g) || []).length).toBe(160)
    expect((svg.match(/<circle/g) || []).length).toBe(196)
  })
})
