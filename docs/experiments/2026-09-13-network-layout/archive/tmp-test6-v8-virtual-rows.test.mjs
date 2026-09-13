import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { connectionHalos } from './tmp-test6-v8-connection-halo.mjs'
import { haloOverlapPairs } from './tmp-test6-v8-hard-halo.mjs'
import { interiorPath, layoutVirtualRows } from './tmp-test6-v8-virtual-rows.mjs'

const read = (name) => Bun.file(`tmp-test6-v8-${name}-report.json`).json()
const rect = (n) => ({
  left: n.x - n.w / 2,
  right: n.x + n.w / 2,
  top: n.y - n.h / 2,
  bottom: n.y + n.h / 2,
})
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6

test('15% area bands widen spacing without disturbing dependency rows or wire safety', async () => {
  const baseline = await read('hard-halo'),
    display = await read('side-centers')
  const before = await read('virtual-rows'),
    saved = await read('virtual-rows-area-15')
  const r = layoutVirtualRows(baseline, display, { areaRatio: 0.15 })
  for (const key of ['nodes', 'groups', 'links', 'terminals', 'virtualNodes', 'rows'])
    expect(r[key]).toEqual(saved[key])
  expect(r.metrics).toEqual(saved.avoidance.after)
  expect(saved.avoidance.before).toEqual(before.avoidance.after)
  expect(saved.counts).toEqual(before.counts)
  expect(saved.inputHash).toBe(before.inputHash)
  expect(r.options.areaRatio).toBe(0.15)
  expect(r.metrics.nodeMinVisibleGap).toBeGreaterThan(before.avoidance.after.nodeMinVisibleGap)
  expect(r.metrics.groupMinVisibleGap).toBeGreaterThan(before.avoidance.after.groupMinVisibleGap)
  for (const k of [
    'hits',
    'nearPairs',
    'nodeHaloPairs',
    'groupHaloPairs',
    'nodeContactPairs',
    'groupContactPairs',
  ])
    expect(r.metrics[k]).toBe(0)
  for (const [gi, rows] of r.rows.entries())
    for (const [ri, row] of rows.entries()) {
      expect(row.members).toEqual(before.rows[gi][ri].members)
      for (const i of row.members) expect(r.nodes[i].y).toBeCloseTo(row.y, 8)
    }
  for (const l of r.links)
    for (const [i, p] of l.points.entries())
      if (i) for (const n of r.nodes) expect(segmentHits(l.points[i - 1], p, rect(n))).toBe(false)
}, 20000)

test('a distant same-row connection gets a wire lane, not a second device row', () => {
  const nodes = ['test:internet', 'middle', 'last'].map((id, i) => ({
    id,
    x: i * 60 - 60,
    y: 0,
    w: 30,
    h: 20,
    depth: 0,
  }))
  const baseline = {
    nodes,
    groups: [{ id: 'one', x: 0, y: 10, w: 198, h: 88, members: [0, 1, 2] }],
    links: [
      {
        id: 'peer',
        a: 0,
        b: 2,
        ga: 0,
        gb: 0,
        points: [
          { x: -45, y: 0 },
          { x: 45, y: 0 },
        ],
      },
    ],
    terminals: [],
    avoidance: { options: { nodeStroke: 1, frameStroke: 1.5, wireWidth: 1.6 } },
  }
  const result = layoutVirtualRows(baseline, baseline)
  expect(result.nodes.map((n) => n.y)).toEqual([0, 0, 0])
  expect(result.virtualNodes.map((n) => n.kind)).toEqual(['peer-lane'])
  expect(result.metrics.hits).toBe(0)
  expect(result.metrics.nearPairs).toBe(0)
})

test('interior routing leaves a direct segment alone, or goes around a real obstacle', () => {
  const frame = { x: 0, y: 0, w: 100, h: 100 }
  const nodes = [{ id: 'obstacle', x: 0, y: 0, w: 10, h: 10 }]
  const a = { x: -30, y: 0 },
    b = { x: 30, y: 0 }
  expect(interiorPath(a, b, [], frame, new Set(), 1)).toEqual([a, b])
  const path = interiorPath(a, b, nodes, frame, new Set(), 1)
  expect(path.length).toBeGreaterThan(2)
  for (const [i, p] of path.entries())
    if (i) expect(segmentHits(path[i - 1], p, rect({ ...nodes[0], w: 12, h: 12 }))).toBe(false)
})

test('virtual rows regenerate deterministically without changing the input', async () => {
  const baseline = await read('hard-halo'),
    display = await read('side-centers'),
    saved = await read('virtual-rows')
  const original = structuredClone({ baseline, display })
  const result = layoutVirtualRows(baseline, display)
  expect({ baseline, display }).toEqual(original)
  for (const key of ['nodes', 'groups', 'links', 'terminals', 'virtualNodes', 'rows'])
    expect(result[key]).toEqual(saved[key])
  expect(result.metrics).toEqual(saved.avoidance.after)
}, 20000)

test('real nodes retain the original dependency rows and left-to-right order', async () => {
  const before = await read('hard-halo'),
    original = await read('side-centers'),
    result = await read('virtual-rows')
  expect(result.inputHash).toBe(before.inputHash)
  expect(result.counts).toEqual(before.counts)
  expect(result.nodes).toHaveLength(89)
  expect(result.links).toHaveLength(160)
  expect(result.groups).toHaveLength(31)
  expect(result.terminals).toHaveLength(196)
  expect(result.nodes.map((n) => [n.id, n.w, n.h, n.depth])).toEqual(
    original.nodes.map((n) => [n.id, n.w, n.h, n.depth]),
  )
  expect(result.groups.map((g) => [g.id, g.members])).toEqual(
    original.groups.map((g) => [g.id, g.members]),
  )
  expect(result.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb])).toEqual(
    before.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb]),
  )
  const root = result.nodes.findIndex((n) => n.id === 'test:internet')
  expect([result.nodes[root].x, result.nodes[root].y]).toEqual([
    before.nodes[root].x,
    before.nodes[root].y,
  ])
  for (const [gi, rows] of result.rows.entries()) {
    const group = result.groups[gi]
    expect(rows.flatMap((r) => r.members).sort((a, b) => a - b)).toEqual(
      [...group.members].sort((a, b) => a - b),
    )
    for (const r of rows) {
      expect(r.members).toEqual(
        group.members
          .filter((i) => original.nodes[i].depth === r.depth)
          .sort((a, b) => original.nodes[a].x - original.nodes[b].x),
      )
      for (const [j, i] of r.members.entries()) {
        expect(result.nodes[i].y).toBeCloseTo(r.y, 8)
        if (j) expect(result.nodes[i].x).toBeGreaterThan(result.nodes[r.members[j - 1]].x)
      }
    }
  }
})

test('virtual slots belong to wires, remain empty of devices and are actually traversed', async () => {
  const r = await read('virtual-rows'),
    real = new Set(r.nodes.map((n) => n.id))
  expect(r.virtualNodes.length).toBeGreaterThan(0)
  for (const d of r.virtualNodes) {
    expect(real.has(d.id)).toBe(false)
    expect(r.links[d.li].virtualIds).toContain(d.id)
    const g = r.groups[d.gi],
      box = rect(g)
    expect(d.x).toBeGreaterThanOrEqual(box.left)
    expect(d.x).toBeLessThanOrEqual(box.right)
    expect(d.y).toBeGreaterThanOrEqual(box.top)
    expect(d.y).toBeLessThanOrEqual(box.bottom)
    const points = r.links[d.li].points
    if (d.kind === 'row-transit') {
      expect(points.some((p) => same(p, { x: d.x, y: d.y - d.h / 2 }))).toBe(true)
      expect(points.some((p) => same(p, { x: d.x, y: d.y + d.h / 2 }))).toBe(true)
      expect(
        haloOverlapPairs([d, ...g.members.map((i) => r.nodes[i])]).filter((p) => p.j === 0),
      ).toHaveLength(0)
    } else expect(points.some((p) => same(p, d))).toBe(true)
  }
})

test('all rendered segments avoid devices; cross-group paths pass through their frame terminals', async () => {
  const r = await read('virtual-rows'),
    opts = r.avoidance.options
  const halos = connectionHalos(
    r.nodes,
    r.groups,
    r.links,
    r.terminals,
    opts.nodeStroke,
    opts.frameStroke,
    opts.areaRatio,
  )
  expect(haloOverlapPairs(halos.nodes)).toHaveLength(0)
  expect(haloOverlapPairs(halos.groups)).toHaveLength(0)
  expect(r.avoidance.after.hits).toBe(0)
  expect(r.avoidance.after.nearPairs).toBe(0)
  const boxes = r.nodes.map(rect),
    frames = r.groups.map(rect)
  for (const l of r.links) {
    for (const [i, p] of l.points.entries())
      if (i) for (const b of boxes) expect(segmentHits(l.points[i - 1], p, b)).toBe(false)
    for (const [n, p] of [
      [r.nodes[l.a], l.points[0]],
      [r.nodes[l.b], l.points.at(-1)],
    ]) {
      expect(
        [
          { x: n.x - n.w / 2, y: n.y },
          { x: n.x + n.w / 2, y: n.y },
          { x: n.x, y: n.y - n.h / 2 },
          { x: n.x, y: n.y + n.h / 2 },
        ].some((midpoint) => same(midpoint, p)),
      ).toBe(true)
    }
    if (l.crossGroup) {
      const start = l.points.findIndex((p) => same(p, l.exit)),
        end = l.points.findIndex((p) => same(p, l.entry))
      expect(start).toBeGreaterThan(0)
      expect(end).toBeGreaterThan(start)
      const outside = l.points.slice(start, end + 1)
      for (const [i, p] of outside.entries())
        if (i) for (const box of frames) expect(segmentHits(outside[i - 1], p, box)).toBe(false)
    }
  }
})
