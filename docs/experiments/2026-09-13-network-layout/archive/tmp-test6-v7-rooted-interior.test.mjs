import { expect, test } from 'bun:test'
import {
  groupInteriorMetrics,
  interiorMetrics,
  nodeBoundaryPoint,
} from './tmp-test6-v7-interior-objective.mjs'
import { deriveRootedTreeSizes, deriveTreeSizes } from './tmp-test6-v7-tree-layout.mjs'

test('outgoing boundary connection no longer promotes a downstream node to an interior root', () => {
  const nodes = Array.from({ length: 4 }, (_, i) => ({
    id: `n${i}`,
    label: `n${i}`,
    w: 132,
    h: 48,
  }))
  const groups = [
    { id: 'root', label: 'root', members: [0] },
    { id: 'inside', label: 'inside', members: [1, 2] },
    { id: 'outside', label: 'outside', members: [3] },
  ]
  const links = [
    { a: 0, b: 1, ga: 0, gb: 1 },
    { a: 1, b: 2, ga: 1, gb: 1 },
    { a: 2, b: 3, ga: 1, gb: 2 },
  ]
  const old = deriveTreeSizes(nodes, groups, links, 0)
  const actual = deriveRootedTreeSizes(nodes, groups, links, 0)
  expect(old[1].hierarchy.levels).toEqual([[1, 2]])
  expect(actual[1].hierarchy.levels).toEqual([[1], [2]])
  expect(actual[1].hierarchy.parents[2]).toEqual([1])
  expect(actual[1].hierarchy.rootDistances).toEqual({ 1: 1, 2: 2 })
})

test('redundant parents and peers survive; input order and roles do not define depth', () => {
  const nodes = Array.from({ length: 4 }, (_, i) => ({
    id: `n${i}`,
    label: `n${i}`,
    w: 132,
    h: 48,
    role: i ? 'internet' : 'access-point',
  }))
  const groups = [
    { label: 'root', members: [0] },
    { label: 'inside', members: [1, 2, 3] },
  ]
  const links = [
    { a: 0, b: 1, ga: 0, gb: 1 },
    { a: 0, b: 2, ga: 0, gb: 1 },
    { a: 1, b: 2, ga: 1, gb: 1 },
    { a: 1, b: 3, ga: 1, gb: 1 },
    { a: 2, b: 3, ga: 1, gb: 1 },
  ]
  const snapshot = JSON.stringify({ nodes, groups, links })
  const actual = deriveRootedTreeSizes(nodes, groups, links, 0)
  expect(actual[1].hierarchy.levels).toEqual([[1, 2], [3]])
  expect(actual[1].hierarchy.parents[3]).toEqual([1, 2])
  expect(JSON.stringify({ nodes, groups, links })).toBe(snapshot)
  expect(deriveRootedTreeSizes(nodes, groups, [...links].reverse(), 0)[1].hierarchy.depth).toEqual(
    actual[1].hierarchy.depth,
  )
})

test('internal crossing and unrelated node penetration are measured from displayed segments', () => {
  const nodes = Array.from({ length: 5 }, () => ({ w: 10, h: 10 }))
  const positions = [
    { x: 0, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 100, y: 0 },
    { x: 50, y: 50 },
  ]
  const links = [
    { a: 0, b: 1 },
    { a: 2, b: 3 },
  ]
  const before = groupInteriorMetrics(nodes, [0, 1, 2, 3, 4], links, [], positions)
  expect(before.crossings).toBe(1)
  expect(before.nodeHits).toBe(2)
  const after = groupInteriorMetrics(
    nodes,
    [0, 1, 2, 3, 4],
    links,
    [],
    [positions[0], positions[3], positions[2], positions[1], positions[4]],
  )
  expect(after.crossings).toBe(0)
  expect(after.nodeHits).toBe(0)
})

test('boundary stubs, collinear overlap and full-link tail lengths enter the objective', () => {
  const nodes = Array.from({ length: 3 }, () => ({ w: 10, h: 10 }))
  const positions = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 0 },
  ]
  const measured = groupInteriorMetrics(
    nodes,
    [0, 1, 2],
    [{ a: 0, b: 1 }],
    [{ node: 0, x: 120, y: 0, tailLength: 30 }],
    positions,
  )
  expect(measured.overlaps).toBe(1)
  expect(measured.nodeHits).toBe(3)
  expect(measured.squaredLength).toBe(100 ** 2 + 150 ** 2)
  expect(nodeBoundaryPoint(nodes, positions, 0, { x: 120, y: 0 })).toEqual({ x: 5, y: 0 })
})

test('rooted diagram keeps every node/link, consistent hierarchy, and reproducible internal metrics', async () => {
  const old = await Bun.file('tmp-test6-v7-internet-upstream-report.json').json()
  const r = await Bun.file('tmp-test6-v7-rooted-interior-refined-report.json').json()
  expect(r.inputHash).toBe(old.inputHash)
  expect(r.counts).toEqual(old.counts)
  expect(r.nodes.map((n) => n.id)).toEqual(old.nodes.map((n) => n.id))
  expect(r.links.map((l) => [l.id, l.a, l.b])).toEqual(old.links.map((l) => [l.id, l.a, l.b]))
  expect(Object.values(r.checks).every((v) => v === 0)).toBe(true)
  const distances = old.macro.boundarySearch.upstream.nodeDistances
  for (const [i, n] of r.nodes.entries()) expect(n.rootDistance).toBe(distances[i])
  for (const l of r.links) {
    if (l.ga !== l.gb) continue
    const a = r.nodes[l.a],
      b = r.nodes[l.b]
    if (a.rootDistance < b.rootDistance) {
      expect(a.y).toBeLessThan(b.y)
      expect(b.parentNodes).toContain(a.id)
    } else if (a.rootDistance > b.rootDistance) {
      expect(b.y).toBeLessThan(a.y)
      expect(a.parentNodes).toContain(b.id)
    } else expect(a.y).toBe(b.y)
  }
  for (const g of r.groups) {
    expect(g.w).toBe(Math.max(...g.hierarchy.widths, g.label.length * 7) + 48)
    for (const row of g.hierarchy.levels) expect(new Set(row.map((i) => r.nodes[i].y)).size).toBe(1)
  }
  const metrics = interiorMetrics(r.nodes, r.groups, r.links, r.nodes, r.terminals)
  expect(metrics).toEqual(r.macro.boundarySearch.interiorFinalMetrics)
  const d = r.macro.boundarySearch
  expect(d.finalScore).toBeLessThan(d.initialRoutedScore)
  expect(d.selectedRouted.internalCrossings).toBeLessThan(d.normalizationRouted.internalCrossings)
  expect(d.selectedRouted.internalNodeHits).toBeLessThan(d.normalizationRouted.internalNodeHits)
  expect(d.selectedRouted.internalOverlaps).toBeLessThan(d.normalizationRouted.internalOverlaps)
  expect(d.selectedRouted.totalLength).toBeLessThan(d.normalizationRouted.totalLength)
  for (const l of r.links) {
    const target = l.crossGroup ? l.exit : r.nodes[l.b]
    expect(l.points[0]).toEqual(nodeBoundaryPoint(r.nodes, r.nodes, l.a, target))
    const source = l.crossGroup ? l.entry : r.nodes[l.a]
    expect(l.points.at(-1)).toEqual(nodeBoundaryPoint(r.nodes, r.nodes, l.b, source))
  }
  const svg = await Bun.file('tmp-test6-v7-rooted-interior-refined.svg').text()
  expect((svg.match(/<path data-link=/g) || []).length).toBe(160)
  expect((svg.match(/<circle/g) || []).length).toBe(196)
})
