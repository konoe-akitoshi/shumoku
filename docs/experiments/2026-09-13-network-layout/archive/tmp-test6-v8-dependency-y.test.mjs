import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { endpointSide } from './tmp-test6-v8-connection-halo.mjs'
import { layoutDependencyY, solveDependencyY } from './tmp-test6-v8-dependency-y.mjs'

const read = (name) => Bun.file(`tmp-test6-v8-${name}-report.json`).json()
const anchor = { i: -1, j: 0, min: 0, max: 0, kind: 'anchor' }
const springs = [1, 2].map((j) => ({ i: 0, j, target: 70, weight: 1, kind: 'dependency' }))
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
const rect = (n) => ({
  left: n.x - n.w / 2,
  right: n.x + n.w / 2,
  top: n.y - n.h / 2,
  bottom: n.y + n.h / 2,
})

test('equal dependency conditions yield equal Y without a sibling alignment term', () => {
  const r = solveDependencyY([0, -240, 330], springs, [anchor])
  expect(r.converged).toBe(true)
  expect(r.values[0]).toBeCloseTo(0, 6)
  expect(r.values[1]).toBeCloseTo(70, 6)
  expect(r.values[2]).toBeCloseTo(70, 6)
  expect(r.after).toBeLessThan(1e-10)
})

test('different wiring changes one child Y instead of moving a rigid row', () => {
  const r = solveDependencyY(
    [0, 70, 70],
    [...springs, { i: -1, j: 2, target: 100, weight: 1, kind: 'wire' }],
    [anchor],
  )
  expect(r.values[1]).toBeCloseTo(70, 6)
  expect(r.values[2]).toBeCloseTo(85, 6)
})

test('a wire footprint enforces capacity without forcing its sibling to move', () => {
  const r = solveDependencyY(
    [0, 70, 70, 30],
    [...springs, { i: -1, j: 3, target: 60, weight: 1, kind: 'wire' }],
    [anchor, { i: 3, j: 2, min: 30, kind: 'wire-node' }],
  )
  expect(r.values[1]).toBeCloseTo(70, 5)
  expect(r.values[2]).toBeCloseTo(80, 5)
  expect(r.values[3]).toBeCloseTo(50, 5)
  expect(r.values[2] - r.values[3]).toBeGreaterThan(30 - 1e-6)
  expect(solveDependencyY([4], [], [anchor]).values[0]).toBeCloseTo(0, 6)
})

test('fixture regenerates without mutation and preserves input topology, root and internal X differences', async () => {
  const b = await read('distributed-ports'),
    saved = await read('dependency-y')
  const original = structuredClone(b),
    r = layoutDependencyY(b)
  expect(b).toEqual(original)
  for (const k of [
    'nodes',
    'groups',
    'links',
    'terminals',
    'nodePorts',
    'virtualNodes',
    'dependencyOptimization',
  ])
    expect(r[k]).toEqual(saved[k])
  expect(r.metrics).toEqual(saved.avoidance.after)
  expect(saved.counts).toEqual(b.counts)
  expect(saved.inputHash).toBe(b.inputHash)
  expect(r.nodes.map((n) => [n.id, n.w, n.h])).toEqual(b.nodes.map((n) => [n.id, n.w, n.h]))
  expect(r.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb])).toEqual(
    b.links.map((l) => [l.id, l.a, l.b, l.ga, l.gb]),
  )
  expect(r.terminals).toHaveLength(196)
  const root = r.nodes.findIndex((n) => n.id === 'test:internet')
  expect([r.nodes[root].x, r.nodes[root].y]).toEqual([b.nodes[root].x, b.nodes[root].y])
  for (const g of r.groups)
    for (const i of g.members) {
      expect(r.nodes[i].x - r.nodes[g.members[0]].x).toBeCloseTo(
        b.nodes[i].x - b.nodes[g.members[0]].x,
        6,
      )
    }
  expect(saved.rows).toBeUndefined()
  const spreads = r.dependencyOptimization.rowAudit
    .filter((row) => row.members.length > 1)
    .map((row) => row.spread)
  expect(Math.max(...spreads)).toBeGreaterThan(20)
  expect(spreads.filter((v) => v < 10).length).toBeGreaterThan(spreads.length / 2)
}, 20000)

test('each local solution is feasible and does not depend on the same-row initialization', async () => {
  const r = await read('dependency-y')
  for (const g of r.dependencyOptimization.groups) {
    expect(g.converged).toBe(true)
    expect(g.residual).toBeLessThan(1e-7)
    for (const c of g.constraints) {
      const d = (c.j < 0 ? 0 : g.values[c.j]) - (c.i < 0 ? 0 : g.values[c.i])
      expect(d).toBeGreaterThanOrEqual((c.min ?? -Infinity) - 1e-6)
      expect(d).toBeLessThanOrEqual((c.max ?? Infinity) + 1e-6)
    }
    expect(
      new Set(g.terms.map((e) => e.kind)).difference(new Set(['dependency', 'wire'])).size,
    ).toBe(0)
    const jittered = g.initial.map((v, i) => v + Math.sin(i * 17 + 1) * 190)
    const other = solveDependencyY(jittered, g.terms, g.constraints)
    expect(other.converged).toBe(true)
    for (const [i, y] of g.values.entries()) expect(other.values[i]).toBeCloseTo(y, 4)
  }
}, 20000)

test('all wire tracks occur on actual paths; all ports remain on their chosen sides', async () => {
  const r = await read('dependency-y')
  for (const t of r.virtualNodes) {
    expect(t.kind).toBe('wire-lane')
    expect(
      r.links[t.li].points.some(
        (p, i, ps) =>
          i &&
          Math.abs(p.y - t.y) < 1e-6 &&
          Math.abs(ps[i - 1].y - t.y) < 1e-6 &&
          Math.min(p.x, ps[i - 1].x) <= t.left + 1e-6 &&
          Math.max(p.x, ps[i - 1].x) >= t.right - 1e-6,
      ),
    ).toBe(true)
  }
  expect(r.nodePorts).toHaveLength(320)
  for (const p of r.nodePorts) {
    const n = r.nodes[p.node],
      l = r.links[p.li]
    expect(same(p, p.end === 'a' ? l.points[0] : l.points.at(-1))).toBe(true)
    expect(endpointSide(n, p)).toBe(p.side)
  }
})

test('final routes avoid all real nodes including owners; exterior routes avoid all frames', async () => {
  const r = await read('dependency-y')
  for (const key of [
    'hits',
    'nearPairs',
    'nodeHaloPairs',
    'groupHaloPairs',
    'nodeContactPairs',
    'groupContactPairs',
  ])
    expect(r.avoidance.after[key]).toBe(0)
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
