import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import {
  areaHalo,
  haloPairs,
  haloSeparationMoves,
  measureHaloSpacing,
} from './tmp-test6-v8-area-halo.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { fitFrames, rebuildRoutes } from './tmp-test6-v8-elastic-frames.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

test('outer-band area is exactly the selected fraction of the painted rectangle', () => {
  for (const rect of [
    { x: 0, y: 0, w: 132, h: 48 },
    { x: 10, y: -20, w: 1067, h: 274 },
  ])
    for (const stroke of [0, 1, 1.5])
      for (const ratio of [0, 0.01, 0.1, 1]) {
        const h = areaHalo(rect, stroke, ratio)
        const area = (rect.w + stroke) * (rect.h + stroke)
        expect(h.w * h.h - area).toBeCloseTo(area * ratio, 7)
        expect(h.bandArea).toBeCloseTo(area * ratio, 7)
        expect(h.thickness).toBeGreaterThanOrEqual(0)
        expect([h.x, h.y]).toEqual([rect.x, rect.y])
      }
  expect(areaHalo({ w: 100, h: 100 }, 0, 0.21).thickness).toBe(5)
  expect(areaHalo({ w: 200, h: 50 }, 0, 0.1).thickness).toBeLessThan(
    areaHalo({ w: 100, h: 100 }, 0, 0.1).thickness,
  )
  expect(() => areaHalo({ w: 100, h: 100 }, 1, -1)).toThrow()
  expect(() => areaHalo({ w: 0, h: 100 }, 1, 0.1)).toThrow()
})

test('thickness scales linearly and relative overlap penalties are scale invariant', () => {
  const nodes = [
    { x: 0, y: 0, w: 132, h: 48 },
    { x: 134, y: 0, w: 132, h: 48 },
  ]
  const twice = nodes.map((n) => ({ x: n.x * 2, y: n.y * 2, w: n.w * 2, h: n.h * 2 }))
  expect(areaHalo(twice[0], 2, 0.1).thickness).toBeCloseTo(
    areaHalo(nodes[0], 1, 0.1).thickness * 2,
    10,
  )
  expect(haloPairs(twice, 2, 0.1).penalty).toBeCloseTo(haloPairs(nodes, 1, 0.1).penalty, 10)
})

test('painted contact is penalized; computed separation removes overlap without a pixel gap', () => {
  const nodes = [
    { x: 0, y: 0, w: 132, h: 48 },
    { x: 133, y: 0, w: 132, h: 48 },
  ]
  const before = structuredClone(nodes)
  const initial = haloPairs(nodes, 1, 0.1)
  expect(initial.contactPairs).toBe(1)
  expect(initial.minVisibleGap).toBe(0)
  expect(initial.penalty).toBeGreaterThan(0)
  const moves = haloSeparationMoves(nodes, 0, 1, 0.1)
  expect(moves).toHaveLength(2)
  for (const move of moves) {
    const updated = [{ ...nodes[0], x: nodes[0].x + move.dx, y: nodes[0].y + move.dy }, nodes[1]]
    expect(haloPairs(updated, 1, 0.1).penalty).toBe(0)
    const half = [
      { ...nodes[0], x: nodes[0].x + move.dx / 2, y: nodes[0].y + move.dy / 2 },
      nodes[1],
    ]
    expect(haloPairs(half, 1, 0.1).penalty).toBeLessThan(initial.penalty)
  }
  expect(nodes).toEqual(before)
  expect(haloPairs(nodes, 1, 0).penalty).toBe(0)
  expect(haloSeparationMoves(nodes, 0, 1, 0)).toEqual([])
})

test('area-based output retains topology and geometry while reducing crowding', async () => {
  const a = await Bun.file('tmp-test6-v8-elastic-frames-report.json').json()
  const b = await Bun.file('tmp-test6-v8-area-halo-report.json').json()
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
  expect(areaRatio).toBe(0.1)
  expect(insets).toEqual(a.avoidance.options.insets)
  const measure = (r) => ({
    ...measureLineAvoidance(r.nodes, r.links, clearance),
    ...measureWires(r.links),
    ...measureHaloSpacing(r.nodes, r.groups, nodeStroke, frameStroke, areaRatio),
  })
  expect(measure(a)).toEqual(b.avoidance.before)
  expect(measure(b)).toEqual(b.avoidance.after)
  const old = b.avoidance.before,
    after = b.avoidance.after
  expect(after.hits).toBeLessThanOrEqual(old.hits)
  expect(after.nodeHaloPenalty).toBeLessThan(old.nodeHaloPenalty)
  expect(after.groupHaloPenalty).toBeLessThan(old.groupHaloPenalty)
  expect(after.nodeContactPairs).toBeLessThan(old.nodeContactPairs)
  expect(after.groupContactPairs).toBeLessThan(old.groupContactPairs)
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
      expect(n.localX).toBeCloseTo(n.x - g.x, 8)
      expect(n.localY).toBeCloseTo(n.y - g.y, 8)
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
  const rects = b.groups.map((g) => ({
    left: g.x - g.w / 2,
    right: g.x + g.w / 2,
    top: g.y - g.h / 2,
    bottom: g.y + g.h / 2,
  }))
  for (const l of b.links)
    if (l.crossGroup) {
      const ps = l.points.slice(1, -1)
      for (const [i, p] of ps.entries())
        if (i) for (const r of rects) expect(segmentHits(ps[i - 1], p, r)).toBe(false)
    }
})
