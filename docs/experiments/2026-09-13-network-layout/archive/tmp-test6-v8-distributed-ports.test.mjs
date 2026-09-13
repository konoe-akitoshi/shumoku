import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { connectionCounts, connectionHalos, endpointSide } from './tmp-test6-v8-connection-halo.mjs'
import {
  distributeNodePorts,
  layoutDistributedPorts,
  spreadNodeAttachments,
} from './tmp-test6-v8-distributed-ports.mjs'
import { haloOverlapPairs } from './tmp-test6-v8-hard-halo.mjs'

const read = (name) => Bun.file(`tmp-test6-v8-${name}-report.json`).json()
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
const rect = (n) => ({
  left: n.x - n.w / 2,
  right: n.x + n.w / 2,
  top: n.y - n.h / 2,
  bottom: n.y + n.h / 2,
})

test('all four sides distribute around the center using wire pitch and opposite-center direction', () => {
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const horizontal = side === 'top' || side === 'bottom',
      sign = side === 'top' || side === 'left' ? -1 : 1
    const nodes = [
      { id: 'hub', x: 0, y: 0, w: 100, h: 100 },
      ...[-30, 0, 30].map((v, i) => ({
        id: `n${i}`,
        x: horizontal ? v : sign * 200,
        y: horizontal ? sign * 200 : v,
        w: 40,
        h: 40,
      })),
    ]
    const links = nodes.slice(1).map((n, i) => ({
      id: `l${i}`,
      a: 0,
      b: i + 1,
      points: [
        { x: horizontal ? 0 : sign * 50, y: horizontal ? sign * 50 : 0 },
        { x: horizontal ? n.x : n.x - sign * 20, y: horizontal ? n.y - sign * 20 : n.y },
      ],
    }))
    const original = structuredClone({ nodes, links })
    const ports = distributeNodePorts(nodes, links, 5.5)
    const hub = ports.filter((p) => p.node === 0)
    expect(hub.map((p) => p.offset)).toEqual([-5.5, 0, 5.5])
    expect(hub.map((p) => p.linkId)).toEqual(['l0', 'l1', 'l2'])
    for (const p of hub) expect(endpointSide(nodes[0], p)).toBe(side)
    for (const p of ports.filter((p) => p.node !== 0)) expect(p.offset).toBe(0)
    expect(
      distributeNodePorts(nodes, links, 11)
        .filter((p) => p.node === 0)
        .map((p) => p.offset),
    ).toEqual([-11, 0, 11])
    expect(() => distributeNodePorts(nodes, links, 40)).toThrow('Insufficient edge capacity')
    expect({ nodes, links }).toEqual(original)
  }
})

test('parallel connections leave from distinct points without merging immediately into a shared stem', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, w: 80, h: 40 },
    { id: 'b', x: 120, y: 0, w: 80, h: 40 },
  ]
  const baseline = {
    nodes,
    groups: [{ x: 60, y: 0, w: 240, h: 100, members: [0, 1] }],
    virtualNodes: [],
    links: ['a', 'b', 'c'].map((id) => ({
      id,
      a: 0,
      b: 1,
      ga: 0,
      gb: 0,
      crossGroup: false,
      points: [
        { x: 40, y: 0 },
        { x: 80, y: 0 },
      ],
    })),
    avoidance: { options: { clearance: 1.3 } },
  }
  const r = spreadNodeAttachments(baseline, 5.5)
  expect(r.links.map((l) => l.points)).toEqual(
    [-5.5, 0, 5.5].map((y) => [
      { x: 40, y },
      { x: 80, y },
    ]),
  )
  expect(r.portRepairs).toBe(0)
})

test('distributed output regenerates without mutation, preserving topology and dependency rows', async () => {
  const baseline = await read('virtual-rows-area-15'),
    before = await read('wire-channels-clearance-1.5'),
    saved = await read('distributed-ports')
  const original = structuredClone(baseline),
    r = layoutDistributedPorts(baseline)
  expect(baseline).toEqual(original)
  for (const k of [
    'nodes',
    'groups',
    'links',
    'terminals',
    'rows',
    'virtualNodes',
    'wireChannels',
    'nodePorts',
    'portRepairs',
  ])
    expect(r[k]).toEqual(saved[k])
  expect(r.metrics).toEqual(saved.avoidance.after)
  expect(saved.avoidance.before).toEqual(before.avoidance.after)
  expect(saved.inputHash).toBe(before.inputHash)
  expect(saved.counts).toEqual(before.counts)
  expect(saved.nodes.map((n) => [n.id, n.w, n.h, n.depth])).toEqual(
    before.nodes.map((n) => [n.id, n.w, n.h, n.depth]),
  )
  expect(saved.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb])).toEqual(
    before.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb]),
  )
  expect(connectionCounts(saved.nodes, saved.groups, saved.links, saved.terminals)).toEqual(
    connectionCounts(before.nodes, before.groups, before.links, before.terminals),
  )
  const root = r.nodes.findIndex((n) => n.id === 'test:internet')
  expect([r.nodes[root].x, r.nodes[root].y]).toEqual([before.nodes[root].x, before.nodes[root].y])
  for (const [gi, rows] of r.rows.entries())
    for (const [ri, row] of rows.entries()) {
      expect(row.members).toEqual(before.rows[gi][ri].members)
      for (const i of row.members) {
        expect(r.nodes[i].y).toBeCloseTo(row.y, 8)
        expect(r.nodes[i].x - r.groups[gi].x).toBeCloseTo(
          before.nodes[i].x - before.groups[gi].x,
          8,
        )
      }
    }
}, 20000)

test('every actual node endpoint uses its unique recorded port and channel capacity remains sufficient', async () => {
  const r = await read('distributed-ports'),
    seen = new Set()
  expect(r.nodePorts).toHaveLength(r.links.length * 2)
  for (const p of r.nodePorts) {
    const n = r.nodes[p.node],
      l = r.links[p.li],
      actual = p.end === 'a' ? l.points[0] : l.points.at(-1)
    expect(same(p, actual)).toBe(true)
    expect(endpointSide(n, p)).toBe(p.side)
    expect(p.pitch).toBe(5.5)
    expect(p.offset).toBe((p.rank - (p.count - 1) / 2) * p.pitch)
    const key = `${p.node}:${p.x.toFixed(6)}:${p.y.toFixed(6)}`
    expect(seen.has(key)).toBe(false)
    seen.add(key)
    const horizontal = p.side === 'top' || p.side === 'bottom'
    expect(horizontal ? p.x - n.x : p.y - n.y).toBeCloseTo(p.offset, 8)
    for (const q of r.nodePorts)
      if (q.node === p.node && q.side === p.side && q.rank === p.rank + 1)
        expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeCloseTo(5.5, 8)
  }
  for (const c of r.wireChannels) {
    expect(c.height).toBeGreaterThanOrEqual(c.lanes * 5.5)
    for (const q of c.requests)
      if (q.routing === 'lane') {
        const points = r.links[q.li].points
        expect(
          points.some(
            (p, i) =>
              i &&
              Math.abs(p.y - q.y) < 1e-6 &&
              Math.abs(points[i - 1].y - q.y) < 1e-6 &&
              Math.min(p.x, points[i - 1].x) <= q.left + 1e-6 &&
              Math.max(p.x, points[i - 1].x) >= q.right - 1e-6,
          ),
        ).toBe(true)
      }
  }
})

test('distributed routes still avoid real devices and external paths stay outside frames', async () => {
  const r = await read('distributed-ports'),
    o = r.avoidance.options
  const halos = connectionHalos(
    r.nodes,
    r.groups,
    r.links,
    r.terminals,
    o.nodeStroke,
    o.frameStroke,
    o.areaRatio,
  )
  expect(haloOverlapPairs(halos.nodes)).toHaveLength(0)
  expect(haloOverlapPairs(halos.groups)).toHaveLength(0)
  for (const l of r.links) {
    for (const [i, p] of l.points.entries())
      if (i) for (const n of r.nodes) expect(segmentHits(l.points[i - 1], p, rect(n))).toBe(false)
    if (l.crossGroup) {
      const start = l.points.findIndex((p) => same(p, l.exit)),
        end = l.points.findIndex((p) => same(p, l.entry))
      expect(start).toBeGreaterThan(0)
      expect(end).toBeGreaterThan(start)
      const outside = l.points.slice(start, end + 1)
      for (const [i, p] of outside.entries())
        if (i) for (const g of r.groups) expect(segmentHits(outside[i - 1], p, rect(g))).toBe(false)
    }
  }
})
