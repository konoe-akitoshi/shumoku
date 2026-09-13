import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { connectionHalos } from './tmp-test6-v8-connection-halo.mjs'
import { haloOverlapPairs } from './tmp-test6-v8-hard-halo.mjs'
import {
  allocateWireLanes,
  layoutWireChannels,
  splitRowGaps,
} from './tmp-test6-v8-wire-channels.mjs'

const read = (name) => Bun.file(`tmp-test6-v8-${name}-report.json`).json()
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
const rect = (n) => ({
  left: n.x - n.w / 2,
  right: n.x + n.w / 2,
  top: n.y - n.h / 2,
  bottom: n.y + n.h / 2,
})

test('larger wire clearance reserves more channel capacity while retaining rows and node safety', async () => {
  const baseline = await read('virtual-rows-area-15'),
    before = await read('wire-channels')
  const saved = await read('wire-channels-clearance-1.5')
  const result = layoutWireChannels(baseline, { wireClearanceScale: 1.5 })
  for (const k of ['nodes', 'groups', 'links', 'terminals', 'rows', 'virtualNodes', 'wireChannels'])
    expect(result[k]).toEqual(saved[k])
  expect(result.metrics).toEqual(saved.avoidance.after)
  expect(saved.avoidance.before).toEqual(before.avoidance.after)
  expect(saved.counts).toEqual(before.counts)
  expect(saved.inputHash).toBe(before.inputHash)
  expect(result.options.wireClearanceScale).toBe(1.5)
  expect(result.options.lanePitch).toBe(5.5)
  expect(result.options.areaRatio).toBe(0.15)
  for (const [i, c] of result.wireChannels.entries()) {
    expect(c.height).toBeGreaterThanOrEqual(before.wireChannels[i].height)
    expect(c.height).toBeGreaterThanOrEqual(c.lanes * 5.5)
  }
  for (const [gi, rows] of result.rows.entries())
    for (const [ri, r] of rows.entries()) {
      expect(r.members).toEqual(before.rows[gi][ri].members)
      for (const i of r.members) expect(result.nodes[i].y).toBeCloseTo(r.y, 8)
    }
  for (const k of ['hits', 'nearPairs', 'nodeHaloPairs', 'groupHaloPairs'])
    expect(result.metrics[k]).toBe(0)
  for (const l of result.links)
    for (const [i, p] of l.points.entries())
      if (i)
        for (const n of result.nodes) expect(segmentHits(l.points[i - 1], p, rect(n))).toBe(false)
  expect(() => layoutWireChannels(baseline, { wireClearanceScale: 0 })).toThrow('Expected positive')
}, 20000)

test('capacity follows local overlapping spans, not total link count', () => {
  const rs = [
    { id: 'a', left: 0, right: 10 },
    { id: 'b', left: 20, right: 30 },
    { id: 'c', left: 40, right: 50 },
  ]
  const original = structuredClone(rs)
  expect(allocateWireLanes(rs, 4).lanes).toBe(1)
  expect(allocateWireLanes(rs, 4).requiredHeight).toBe(4)
  expect(allocateWireLanes(rs, 4).requests.every((r) => r.routing === 'preserved')).toBe(true)
  const crowded = rs.map((r) => ({ ...r, left: 0, right: 10 }))
  expect(allocateWireLanes(crowded, 4).lanes).toBe(3)
  expect(allocateWireLanes(crowded, 4).requiredHeight).toBe(12)
  expect(allocateWireLanes(crowded, 4).requests.every((r) => r.routing === 'lane')).toBe(true)
  const scaled = crowded.map((r) => ({ ...r, left: r.left * 2, right: r.right * 2 }))
  expect(allocateWireLanes(scaled, 8).requiredHeight).toBe(24)
  expect(allocateWireLanes([], 4).requiredHeight).toBe(0)
  expect(rs).toEqual(original)
})

test('split paths exactly at row boundaries, keeping device-row portions separate', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 20, y: 20 },
  ]
  const original = structuredClone(path)
  const pieces = splitRowGaps(path, [{ top: 5, bottom: 15 }])
  expect(pieces.map((p) => p.gap)).toEqual([-1, 0, -1])
  expect(pieces[1].points).toEqual([
    { x: 5, y: 5 },
    { x: 15, y: 15 },
  ])
  expect(path).toEqual(original)
})

test('wire-capacity layout regenerates without changing inputs, topology or node-band parameters', async () => {
  const baseline = await read('virtual-rows-area-15'),
    original = structuredClone(baseline),
    saved = await read('wire-channels')
  const result = layoutWireChannels(baseline)
  expect(baseline).toEqual(original)
  for (const k of ['nodes', 'groups', 'links', 'terminals', 'rows', 'virtualNodes', 'wireChannels'])
    expect(result[k]).toEqual(saved[k])
  expect(result.metrics).toEqual(saved.avoidance.after)
  expect(saved.inputHash).toBe(baseline.inputHash)
  expect(saved.counts).toEqual(baseline.counts)
  expect(saved.nodes.map((n) => [n.id, n.w, n.h, n.depth])).toEqual(
    baseline.nodes.map((n) => [n.id, n.w, n.h, n.depth]),
  )
  expect(saved.groups.map((g) => [g.id, g.members])).toEqual(
    baseline.groups.map((g) => [g.id, g.members]),
  )
  expect(saved.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb])).toEqual(
    baseline.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb]),
  )
  expect(result.options.areaRatio).toBe(0.15)
  expect(result.options.lanePitch).toBe(4.2)
  const root = result.nodes.findIndex((n) => n.id === 'test:internet')
  expect([result.nodes[root].x, result.nodes[root].y]).toEqual([
    baseline.nodes[root].x,
    baseline.nodes[root].y,
  ])
  for (const [gi, rows] of result.rows.entries()) {
    expect(result.groups[gi].w).toBe(baseline.groups[gi].w)
    for (const [ri, row] of rows.entries()) {
      expect(row.members).toEqual(baseline.rows[gi][ri].members)
      for (const i of row.members) {
        expect(result.nodes[i].y).toBeCloseTo(row.y, 8)
        expect(result.nodes[i].x - result.groups[gi].x).toBeCloseTo(
          baseline.nodes[i].x - baseline.groups[gi].x,
          8,
        )
      }
    }
  }
}, 20000)

test('every reserved channel has sufficient capacity and each requested horizontal lane is rendered', async () => {
  const r = await read('wire-channels'),
    pitch = r.avoidance.options.lanePitch
  expect(r.wireChannels.some((c) => c.height > c.oldHeight + 1e-6)).toBe(true)
  for (const c of r.wireChannels) {
    expect(c.height).toBe(Math.max(c.oldHeight, c.requiredHeight))
    expect(c.requiredHeight).toBe(c.lanes * pitch)
    expect(c.bottom - c.top).toBeCloseTo(c.height, 8)
    for (const request of c.requests) {
      expect(request.y - c.top).toBeGreaterThanOrEqual(pitch / 2 - 1e-6)
      expect(c.bottom - request.y).toBeGreaterThanOrEqual(pitch / 2 - 1e-6)
      const points = r.links[request.li].points
      if (request.routing === 'lane')
        expect(
          points.some(
            (p, i) =>
              i &&
              Math.abs(p.y - request.y) < 1e-6 &&
              Math.abs(points[i - 1].y - request.y) < 1e-6 &&
              Math.min(p.x, points[i - 1].x) <= request.left + 1e-6 &&
              Math.max(p.x, points[i - 1].x) >= request.right - 1e-6,
          ),
        ).toBe(true)
      for (const other of c.requests)
        if (other.id !== request.id && other.lane === request.lane)
          expect(
            request.right + pitch <= other.left + 1e-6 ||
              other.right + pitch <= request.left + 1e-6,
          ).toBe(true)
    }
  }
})

test('rendered routes avoid every real node and attach at four-side midpoints', async () => {
  const r = await read('wire-channels'),
    options = r.avoidance.options
  const halos = connectionHalos(
    r.nodes,
    r.groups,
    r.links,
    r.terminals,
    options.nodeStroke,
    options.frameStroke,
    options.areaRatio,
  )
  expect(haloOverlapPairs(halos.nodes)).toHaveLength(0)
  expect(haloOverlapPairs(halos.groups)).toHaveLength(0)
  const boxes = r.nodes.map(rect),
    frames = r.groups.map(rect)
  for (const [li, l] of r.links.entries()) {
    for (const [i, p] of l.points.entries())
      if (i) for (const box of boxes) expect(segmentHits(l.points[i - 1], p, box)).toBe(false)
    for (const [n, p] of [
      [r.nodes[l.a], l.points[0]],
      [r.nodes[l.b], l.points.at(-1)],
    ])
      expect(
        [
          { x: n.x - n.w / 2, y: n.y },
          { x: n.x + n.w / 2, y: n.y },
          { x: n.x, y: n.y - n.h / 2 },
          { x: n.x, y: n.y + n.h / 2 },
        ].some((m) => same(m, p)),
      ).toBe(true)
    if (l.crossGroup) {
      const begin = l.points.findIndex((p) => same(p, l.exit)),
        end = l.points.findIndex((p) => same(p, l.entry))
      expect(begin).toBeGreaterThan(0)
      expect(end).toBeGreaterThan(begin)
      expect(
        same(
          l.exit,
          r.terminals.find((t) => t.li === li && t.end === 'a'),
        ),
      ).toBe(true)
      expect(
        same(
          l.entry,
          r.terminals.find((t) => t.li === li && t.end === 'b'),
        ),
      ).toBe(true)
      const outside = l.points.slice(begin, end + 1)
      for (const [i, p] of outside.entries())
        if (i) for (const box of frames) expect(segmentHits(outside[i - 1], p, box)).toBe(false)
    }
  }
})
