import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import {
  fitFrames,
  measuredInsets,
  rebuildRoutes,
  settleFrames,
} from './tmp-test6-v8-elastic-frames.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'
import { nodeSideMidpoint } from './tmp-test6-v8-node-attachments.mjs'

test('frame dimensions grow and shrink with content, with no previous-size cap', () => {
  const groups = [{ id: 'a', x: 0, y: 0, w: 100, h: 100, members: [0, 1] }]
  const nodes = [
    { x: -20, y: 0, w: 20, h: 20 },
    { x: 20, y: 0, w: 20, h: 20 },
  ]
  const insets = [{ left: 10, right: 10, top: 30, bottom: 10 }]
  expect(fitFrames(groups, nodes, insets)[0].w).toBe(80)
  expect(fitFrames(groups, [{ ...nodes[0], x: -1000 }, nodes[1]], insets)[0].w).toBe(1060)
  expect(groups[0].w).toBe(100)
})

test('expanding content moves neighboring groups without moving Internet', () => {
  const nodes = [
    { x: 0, y: 0, w: 40, h: 40 },
    { x: 35, y: 0, w: 40, h: 40 },
    { x: 70, y: 0, w: 40, h: 40 },
  ]
  const original = structuredClone(nodes)
  const groups = nodes.map((_, i) => ({ id: String(i), members: [i] }))
  const insets = groups.map(() => ({ left: 10, right: 10, top: 10, bottom: 10 }))
  const result = settleFrames(nodes, groups, insets, 0, 1.5)
  expect(result).not.toBeNull()
  expect(result.nodes[0]).toEqual(nodes[0])
  expect(result.nodes[1].x).toBeGreaterThan(nodes[1].x)
  expect(result.nodes[2].x).toBeGreaterThan(nodes[2].x)
  expect(nodes).toEqual(original)
  for (const [i, a] of result.groups.entries())
    for (const b of result.groups.slice(i + 1)) {
      expect(
        Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 1.5 - 1e-6 ||
          Math.abs(a.y - b.y) >= (a.h + b.h) / 2 + 1.5 - 1e-6,
      ).toBe(true)
    }
})

test('elastic artifact preserves input, fits content, and has no frame/node overlap', async () => {
  const a = await Bun.file('tmp-test6-v8-dynamic-avoidance-report.json').json()
  const b = await Bun.file('tmp-test6-v8-elastic-frames-report.json').json()
  const source = await Bun.file('tmp-test6-v8-side-centers-report.json').json()
  expect(b.inputHash).toBe(a.inputHash)
  expect(b.counts).toEqual(a.counts)
  expect(b.nodes.map((n) => n.id)).toEqual(a.nodes.map((n) => n.id))
  expect(b.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb])).toEqual(
    a.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb]),
  )
  expect(b.groups.map((g) => [g.id, g.members])).toEqual(a.groups.map((g) => [g.id, g.members]))
  expect(b.avoidance.options.insets).toEqual(measuredInsets(source))
  const fitted = fitFrames(b.groups, b.nodes, b.avoidance.options.insets)
  for (const [gi, g] of b.groups.entries()) {
    for (const k of ['x', 'y', 'w', 'h']) expect(g[k]).toBeCloseTo(fitted[gi][k], 8)
    for (const other of b.groups.slice(gi + 1))
      expect(
        Math.abs(g.x - other.x) >= (g.w + other.w) / 2 + b.avoidance.options.frameStroke - 1e-6 ||
          Math.abs(g.y - other.y) >= (g.h + other.h) / 2 + b.avoidance.options.frameStroke - 1e-6,
      ).toBe(true)
    for (const i of g.members) {
      const n = b.nodes[i]
      expect(n.x - n.w / 2).toBeGreaterThanOrEqual(g.x - g.w / 2)
      expect(n.x + n.w / 2).toBeLessThanOrEqual(g.x + g.w / 2)
      expect(n.y - n.h / 2).toBeGreaterThanOrEqual(g.y - g.h / 2)
      expect(n.y + n.h / 2).toBeLessThanOrEqual(g.y + g.h / 2)
      if (n.id === 'test:internet') expect([n.x, n.y]).toEqual([a.nodes[i].x, a.nodes[i].y])
      expect(n.depth).toBe(a.nodes[i].depth)
      expect(n.localX).toBeCloseTo(n.x - g.x, 8)
      expect(n.localY).toBeCloseTo(n.y - g.y, 8)
      for (const j of g.members)
        if (i !== j) {
          const m = b.nodes[j]
          expect(
            Math.abs(n.x - m.x) >= (n.w + m.w) / 2 + b.avoidance.options.nodeStroke - 1e-6 ||
              Math.abs(n.y - m.y) >= (n.h + m.h) / 2 + b.avoidance.options.nodeStroke - 1e-6,
          ).toBe(true)
          if (n.depth < m.depth) expect(n.y + n.h / 2).toBeLessThanOrEqual(m.y - m.h / 2)
        }
    }
  }
  expect(b.avoidance.resized.length).toBeGreaterThan(0)
  expect(b.groups.some((g, i) => g.w > a.groups[i].w + 1e-6 || g.h > a.groups[i].h + 1e-6)).toBe(
    true,
  )
  expect(b.groups.some((g, i) => g.w < a.groups[i].w - 1e-6 || g.h < a.groups[i].h - 1e-6)).toBe(
    true,
  )
  const metrics = {
    ...measureLineAvoidance(b.nodes, b.links, b.avoidance.options.clearance),
    ...measureWires(b.links),
  }
  expect(metrics).toEqual(b.avoidance.after)
  expect(metrics.hits).toBeLessThanOrEqual(b.avoidance.before.hits)
})

test('terminals and actual routes are recomputed, visible and side-center attached', async () => {
  const a = await Bun.file('tmp-test6-v8-dynamic-avoidance-report.json').json()
  const b = await Bun.file('tmp-test6-v8-elastic-frames-report.json').json()
  const routed = rebuildRoutes(b.groups, b.nodes, b.links)
  expect(routed.terminals).toEqual(b.terminals)
  expect(routed.links).toEqual(b.links)
  expect(b.terminals).not.toEqual(a.terminals)
  const rectangles = b.groups.map((g) => ({
    left: g.x - g.w / 2,
    right: g.x + g.w / 2,
    top: g.y - g.h / 2,
    bottom: g.y + g.h / 2,
  }))
  for (const t of b.terminals) {
    const r = rectangles[t.g]
    expect(
      t.x >= r.left - 1e-6 &&
        t.x <= r.right + 1e-6 &&
        t.y >= r.top - 1e-6 &&
        t.y <= r.bottom + 1e-6,
    ).toBe(true)
    expect(
      Math.min(
        Math.abs(t.x - r.left),
        Math.abs(t.x - r.right),
        Math.abs(t.y - r.top),
        Math.abs(t.y - r.bottom),
      ),
    ).toBeLessThan(1e-6)
  }
  for (const l of b.links) {
    expect(l.points[0]).toEqual(
      nodeSideMidpoint(b.nodes, b.nodes, l.a, l.crossGroup ? l.exit : b.nodes[l.b]),
    )
    expect(l.points.at(-1)).toEqual(
      nodeSideMidpoint(b.nodes, b.nodes, l.b, l.crossGroup ? l.entry : b.nodes[l.a]),
    )
    if (!l.crossGroup) continue
    const ps = l.points.slice(1, -1)
    for (const [i, p] of ps.entries())
      if (i) for (const r of rectangles) expect(segmentHits(ps[i - 1], p, r)).toBe(false)
    if (!rectangles.some((r) => segmentHits(l.exit, l.entry, r))) expect(ps).toHaveLength(2)
  }
})
