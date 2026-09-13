import { expect, test } from 'bun:test'
import { areaHalo, haloPairs } from './tmp-test6-v8-area-halo.mjs'
import {
  connectionCounts,
  connectionHalos,
  directionalHalo,
  endpointSide,
  haloProfiles,
  measureConnectionHaloSpacing,
} from './tmp-test6-v8-connection-halo.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { fitFrames, rebuildRoutes } from './tmp-test6-v8-elastic-frames.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

test('connection multiplier preserves the exact total band area, including corners', () => {
  const r = { x: 20, y: 30, w: 132, h: 48 }
  for (const counts of [
    { left: 0, right: 0, top: 0, bottom: 0 },
    { left: 0, right: 0, top: 0, bottom: 20 },
    { left: 4, right: 8, top: 2, bottom: 10 },
  ])
    for (const ratio of [0, 0.01, 0.1, 1]) {
      const h = directionalHalo(r, 1, ratio, counts)
      const area = 133 * 49,
        base = areaHalo(r, 1, ratio)
      expect(h.effectiveRatio).toBeCloseTo(
        ratio * Math.sqrt(1 + Object.values(counts).reduce((a, b) => a + b, 0)),
        10,
      )
      expect(h.w * h.h - area).toBeCloseTo(area * h.effectiveRatio, 7)
      for (const side of ['left', 'right', 'top', 'bottom']) {
        expect(h.sides[side]).toBeGreaterThanOrEqual(base.thickness)
        if (!counts[side]) expect(h.sides[side]).toBe(base.thickness)
      }
    }
  const h = directionalHalo(r, 1, 0.1, { left: 0, right: 0, top: 0, bottom: 20 })
  expect(h.sides.bottom).toBeGreaterThan(h.sides.top)
  expect(h.x).toBe(r.x)
  expect(h.y).toBeGreaterThan(r.y)
  expect(() => directionalHalo(r, 1, 0.1, {})).toThrow()
})

test('side allocation follows counts per edge length and scales with geometry', () => {
  const rects = [
    { x: 0, y: 0, w: 132, h: 48 },
    { x: 134, y: 0, w: 132, h: 48 },
  ]
  const counts = { left: 2, right: 4, top: 1, bottom: 3 }
  const halos = rects.map((r) => directionalHalo(r, 1, 0.1, counts))
  const h = halos[0]
  expect((h.sides.right - h.baseThickness) / (h.sides.left - h.baseThickness)).toBeCloseTo(2)
  expect((h.sides.bottom - h.baseThickness) / (h.sides.top - h.baseThickness)).toBeCloseTo(3)
  const twice = rects.map((r) => ({ x: r.x * 2, y: r.y * 2, w: r.w * 2, h: r.h * 2 }))
  const scaled = twice.map((r) => directionalHalo(r, 2, 0.1, counts))
  for (const side of Object.keys(counts))
    expect(scaled[0].sides[side]).toBeCloseTo(h.sides[side] * 2, 9)
  expect(haloPairs(twice, 2, 0.1, scaled).penalty).toBeCloseTo(
    haloPairs(rects, 1, 0.1, halos).penalty,
    9,
  )
})

test('count actual node endpoints and boundary terminals; do not count internal links twice', () => {
  const nodes = [
    { x: 0, y: 0, w: 20, h: 20 },
    { x: 40, y: 0, w: 20, h: 20 },
    { x: 40, y: 100, w: 20, h: 20 },
  ]
  const internal = {
    a: 0,
    b: 1,
    ga: 0,
    gb: 0,
    points: [
      { x: 10, y: 0 },
      { x: 30, y: 0 },
    ],
  }
  const external = {
    a: 1,
    b: 2,
    ga: 0,
    gb: 1,
    points: [
      { x: 40, y: 10 },
      { x: 40, y: 90 },
    ],
  }
  const links = [internal, external, { ...external }]
  const terminals = [
    { g: 0, side: 'bottom' },
    { g: 1, side: 'top' },
    { g: 0, side: 'bottom' },
    { g: 1, side: 'top' },
  ]
  const { nodeCounts, groupCounts } = connectionCounts(nodes, [{}, {}], links, terminals)
  expect(nodeCounts).toEqual([
    { left: 0, right: 1, top: 0, bottom: 0 },
    { left: 1, right: 0, top: 0, bottom: 2 },
    { left: 0, right: 0, top: 2, bottom: 0 },
  ])
  expect(groupCounts).toEqual([
    { left: 0, right: 0, top: 0, bottom: 2 },
    { left: 0, right: 0, top: 2, bottom: 0 },
  ])
  expect(endpointSide(nodes[0], { x: -10, y: 0 })).toBe('left')
  expect(() => endpointSide(nodes[0], { x: 0, y: 0 })).toThrow()
})

test('saved output uses current routed side counts and reproducible geometry and metrics', async () => {
  const a = await Bun.file('tmp-test6-v8-area-halo-report.json').json()
  const b = await Bun.file('tmp-test6-v8-connection-halo-report.json').json()
  expect(b.inputHash).toBe(a.inputHash)
  expect(b.counts).toEqual(a.counts)
  expect(b.nodes.map((n) => [n.id, n.depth, n.w, n.h])).toEqual(
    a.nodes.map((n) => [n.id, n.depth, n.w, n.h]),
  )
  expect(b.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb])).toEqual(
    a.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb]),
  )
  expect(b.groups.map((g) => [g.id, g.members])).toEqual(a.groups.map((g) => [g.id, g.members]))
  const { nodeStroke, frameStroke, clearance, areaRatio, insets } = b.avoidance.options
  expect(b.avoidance.options.connectionAware).toBe(true)
  expect(areaRatio).toBe(0.1)
  expect(insets).toEqual(a.avoidance.options.insets)
  const measure = (r) => ({
    ...measureLineAvoidance(r.nodes, r.links, clearance),
    ...measureWires(r.links),
    ...measureConnectionHaloSpacing(
      r.nodes,
      r.groups,
      r.links,
      r.terminals,
      nodeStroke,
      frameStroke,
      areaRatio,
    ),
  })
  expect(measure(a)).toEqual(b.avoidance.before)
  expect(measure(b)).toEqual(b.avoidance.after)
  const profiles = (r) =>
    haloProfiles(
      connectionHalos(r.nodes, r.groups, r.links, r.terminals, nodeStroke, frameStroke, areaRatio),
    )
  expect(profiles(a)).toEqual(b.avoidance.haloProfiles.before)
  expect(profiles(b)).toEqual(b.avoidance.haloProfiles.after)
  expect(b.avoidance.haloProfiles.after.nodes.reduce((s, h) => s + h.connections, 0)).toBe(
    b.links.length * 2,
  )
  expect(b.avoidance.haloProfiles.after.groups.reduce((s, h) => s + h.connections, 0)).toBe(
    b.terminals.length,
  )
  const fitted = fitFrames(b.groups, b.nodes, insets)
  for (const [gi, g] of b.groups.entries()) {
    for (const k of ['x', 'y', 'w', 'h']) expect(g[k]).toBeCloseTo(fitted[gi][k], 8)
    for (const other of b.groups.slice(gi + 1))
      expect(
        Math.abs(g.x - other.x) >= (g.w + other.w) / 2 + frameStroke - 1e-6 ||
          Math.abs(g.y - other.y) >= (g.h + other.h) / 2 + frameStroke - 1e-6,
      ).toBe(true)
    for (const i of g.members) {
      const n = b.nodes[i]
      if (n.id === 'test:internet') expect([n.x, n.y]).toEqual([a.nodes[i].x, a.nodes[i].y])
      for (const j of g.members)
        if (i !== j) {
          const m = b.nodes[j]
          expect(
            Math.abs(n.x - m.x) >= (n.w + m.w) / 2 + nodeStroke - 1e-6 ||
              Math.abs(n.y - m.y) >= (n.h + m.h) / 2 + nodeStroke - 1e-6,
          ).toBe(true)
          if (n.depth < m.depth) expect(n.y + n.h / 2).toBeLessThanOrEqual(m.y - m.h / 2)
        }
    }
  }
  const routing = rebuildRoutes(b.groups, b.nodes, b.links)
  expect(routing.links).toEqual(b.links)
  expect(routing.terminals).toEqual(b.terminals)
  expect(b.avoidance.after.hits).toBeLessThanOrEqual(b.avoidance.before.hits)
  const objective = (m) =>
    [
      'penalty',
      'crossings',
      'overlapLength',
      'length',
      'nodeHaloPenalty',
      'groupHaloPenalty',
    ].reduce((s, k) => s + m[k] / Math.max(1, b.avoidance.before[k]), 0)
  expect(objective(b.avoidance.after)).toBeLessThanOrEqual(objective(b.avoidance.before))
})
