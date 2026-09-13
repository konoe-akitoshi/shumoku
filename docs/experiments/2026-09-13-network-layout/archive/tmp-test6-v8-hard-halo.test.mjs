import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import {
  connectionHalos,
  haloProfiles,
  measureConnectionHaloSpacing,
} from './tmp-test6-v8-connection-halo.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { fitFrames, rebuildRoutes } from './tmp-test6-v8-elastic-frames.mjs'
import { endpointGeometry, haloOverlapPairs, projectHardHalos } from './tmp-test6-v8-hard-halo.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

test('required bands allow boundary contact, but never trade away an overlap', () => {
  const boxes = [
    { x: 0, y: 0, w: 20, h: 20 },
    { x: 20, y: 0, w: 20, h: 20 },
  ]
  expect(haloOverlapPairs(boxes)).toHaveLength(0)
  expect(haloOverlapPairs([boxes[0], { ...boxes[1], x: 19.99 }])).toHaveLength(1)
  expect(haloOverlapPairs([boxes[0], { ...boxes[1], x: 20.01 }])).toHaveLength(0)
})

test('projection repairs node/group bands without changing inputs or Internet', () => {
  const nodes = [
    { id: 'test:internet', x: 0, y: 0, w: 30, h: 20, depth: 0 },
    { id: 'a', x: 0, y: 40, w: 30, h: 20, depth: 0 },
    { id: 'b', x: 31, y: 40, w: 30, h: 20, depth: 0 },
  ]
  const groups = [
    { id: 'wan', members: [0] },
    { id: 'floor', members: [1, 2] },
  ]
  const links = [
    { id: 'a', a: 0, b: 1, ga: 0, gb: 1 },
    { id: 'b', a: 1, b: 2, ga: 1, gb: 1 },
  ]
  const original = structuredClone({ nodes, groups, links })
  const options = {
    groups,
    links,
    insets: groups.map(() => ({ left: 24, right: 24, top: 44, bottom: 24 })),
    root: 0,
    nodeStroke: 1,
    frameStroke: 1.5,
    areaRatio: 0.1,
    fitFrames,
  }
  expect(projectHardHalos(nodes, { ...options, maxPasses: 0 })).toBeNull()
  const result = projectHardHalos(nodes, options)
  expect(result).not.toBeNull()
  expect(result.nodes[0]).toEqual(nodes[0])
  expect({ nodes, groups, links }).toEqual(original)
  const routing = rebuildRoutes(result.groups, result.nodes, links)
  const halos = connectionHalos(
    result.nodes,
    result.groups,
    routing.links,
    routing.terminals,
    1,
    1.5,
    0.1,
  )
  expect(haloOverlapPairs(halos.nodes)).toHaveLength(0)
  expect(haloOverlapPairs(halos.groups)).toHaveLength(0)
})

test('cheap projection endpoints match full exterior routing exactly', async () => {
  const b = await Bun.file('tmp-test6-v8-connection-halo-report.json').json()
  const fast = endpointGeometry(b.nodes, b.groups, b.links)
  const full = rebuildRoutes(b.groups, b.nodes, b.links)
  expect(fast.terminals).toEqual(full.terminals)
  expect(fast.links.map((l) => l.points)).toEqual(
    full.links.map((l) => [l.points[0], l.points.at(-1)]),
  )
})

test('saved hard-halo output is feasible after rerouting and at every reported sweep', async () => {
  const a = await Bun.file('tmp-test6-v8-connection-halo-report.json').json()
  const b = await Bun.file('tmp-test6-v8-hard-halo-report.json').json()
  expect(b.inputHash).toBe(a.inputHash)
  expect(b.counts).toEqual(a.counts)
  expect(b.nodes.map((n) => [n.id, n.w, n.h, n.depth])).toEqual(
    a.nodes.map((n) => [n.id, n.w, n.h, n.depth]),
  )
  expect(b.groups.map((g) => [g.id, g.members])).toEqual(a.groups.map((g) => [g.id, g.members]))
  expect(b.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb])).toEqual(
    a.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb]),
  )
  const { nodeStroke, frameStroke, areaRatio, clearance, insets } = b.avoidance.options
  expect(b.avoidance.options.hardHalos).toBe(true)
  expect(areaRatio).toBe(0.1)
  expect(insets).toEqual(a.avoidance.options.insets)
  const route = rebuildRoutes(b.groups, b.nodes, b.links)
  expect(route.links).toEqual(b.links)
  expect(route.terminals).toEqual(b.terminals)
  const halos = connectionHalos(
    b.nodes,
    b.groups,
    route.links,
    route.terminals,
    nodeStroke,
    frameStroke,
    areaRatio,
  )
  expect(haloOverlapPairs(halos.nodes)).toHaveLength(0)
  expect(haloOverlapPairs(halos.groups)).toHaveLength(0)
  expect(haloProfiles(halos)).toEqual(b.avoidance.haloProfiles.after)
  const metrics = {
    ...measureLineAvoidance(b.nodes, b.links, clearance),
    ...measureWires(b.links),
    ...measureConnectionHaloSpacing(
      b.nodes,
      b.groups,
      b.links,
      b.terminals,
      nodeStroke,
      frameStroke,
      areaRatio,
    ),
  }
  expect(metrics).toEqual(b.avoidance.after)
  for (const m of [b.avoidance.rebuiltInitial, b.avoidance.after, ...b.avoidance.trace]) {
    expect(m.nodeHaloPairs).toBe(0)
    expect(m.groupHaloPairs).toBe(0)
  }
  expect(metrics.nodeContactPairs).toBe(0)
  expect(metrics.groupContactPairs).toBe(0)
  const fitted = fitFrames(b.groups, b.nodes, insets)
  for (const [gi, g] of b.groups.entries()) {
    for (const k of ['x', 'y', 'w', 'h']) expect(g[k]).toBeCloseTo(fitted[gi][k], 8)
    for (const i of g.members) {
      const n = b.nodes[i]
      if (n.id === 'test:internet') expect([n.x, n.y]).toEqual([a.nodes[i].x, a.nodes[i].y])
      expect(n.localX).toBeCloseTo(n.x - g.x, 8)
      expect(n.localY).toBeCloseTo(n.y - g.y, 8)
      for (const j of g.members)
        if (n.depth < b.nodes[j].depth)
          expect(n.y + n.h / 2 + nodeStroke).toBeLessThanOrEqual(
            b.nodes[j].y - b.nodes[j].h / 2 + 1e-6,
          )
    }
  }
  const rects = b.groups.map((g) => ({
    left: g.x - g.w / 2,
    right: g.x + g.w / 2,
    top: g.y - g.h / 2,
    bottom: g.y + g.h / 2,
  }))
  for (const l of b.links)
    if (l.crossGroup) {
      const points = l.points.slice(1, -1)
      for (const [i, p] of points.entries())
        if (i) for (const r of rects) expect(segmentHits(points[i - 1], p, r)).toBe(false)
      if (!rects.some((r) => segmentHits(l.exit, l.entry, r))) expect(points).toHaveLength(2)
    }
})
