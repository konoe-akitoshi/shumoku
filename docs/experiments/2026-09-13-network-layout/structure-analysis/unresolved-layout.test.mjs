import { expect, test } from 'bun:test'
import { layoutDependencyY } from '../archive/tmp-test6-v8-dependency-y.mjs'

function prepared(positions, edges) {
  const nodes = positions.map(([x, y], i) => ({
    id: `n${i}`,
    label: `n${i}`,
    x,
    y,
    w: 80,
    h: 40,
    depth: i,
    rootDistance: 999,
  }))
  const point = (a, b) => {
    const dx = b.x - a.x,
      dy = b.y - a.y
    return Math.abs(dx) > Math.abs(dy)
      ? { x: a.x + (Math.sign(dx) * a.w) / 2, y: a.y }
      : { x: a.x, y: a.y + (Math.sign(dy) * a.h) / 2 }
  }
  return {
    nodes,
    groups: [
      { id: 'g', label: 'g', x: 150, y: 150, w: 500, h: 500, members: nodes.map((_n, i) => i) },
    ],
    links: edges.map(([a, b], i) => ({
      id: `l${i}`,
      a,
      b,
      ga: 0,
      gb: 0,
      crossGroup: false,
      points: [point(nodes[a], nodes[b]), point(nodes[b], nodes[a])],
    })),
    terminals: [],
    wireChannels: [],
    nodePorts: [],
    rows: [[]],
    avoidance: {
      after: {},
      options: {
        nodeStroke: 1,
        frameStroke: 1.5,
        areaRatio: 0.15,
        clearance: 1.3,
        lanePitch: 5.5,
        wireWidth: 1.6,
        wireClearanceScale: 1.5,
        portPitch: 5.5,
        insets: [{ left: 24, right: 24, top: 44, bottom: 24 }],
      },
    },
  }
}

for (const [name, positions, edges] of [
  ['isolated node', [[0, 0]], []],
  [
    'two endpoints',
    [
      [0, 0],
      [300, 0],
    ],
    [[0, 1]],
  ],
  [
    'zero-vote star',
    [
      [0, 0],
      [300, 0],
      [600, 0],
    ],
    [
      [0, 1],
      [1, 2],
    ],
  ],
  [
    'leafless ring',
    [
      [0, 0],
      [300, 0],
      [300, 300],
      [0, 300],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  ],
]) {
  test(`${name} continues without inventing upstream dependencies`, () => {
    const input = prepared(positions, edges)
    const snapshot = structuredClone(input)
    const result = layoutDependencyY(input)
    expect(input).toEqual(snapshot)
    expect(result.upstream.roots).toEqual([])
    expect(result.upstream.translationGauge).toBe('n0')
    expect(
      result.nodes.every(
        (node) => node.rootDistance === null && Number.isFinite(node.x) && Number.isFinite(node.y),
      ),
    ).toBe(true)
    expect(result.dependencyOptimization.groups.flatMap((group) => group.dependencies)).toEqual([])
    if (edges.length)
      expect(
        result.dependencyOptimization.groups.flatMap((group) => group.terms).length,
      ).toBeGreaterThan(0)
    expect(result.links).toHaveLength(edges.length)
    expect(result.metrics.hits).toBe(0)
    expect(result.metrics.nodeHaloPairs).toBe(0)
  })
}

test('known component retains dependency terms alongside an isolated unknown component', async () => {
  const input = await Bun.file(
    new URL('../archive/tmp-test6-v8-distributed-ports-report.json', import.meta.url),
  ).json()
  const original = layoutDependencyY(input)
  const index = input.nodes.length
  const mixed = {
    ...input,
    nodes: [
      ...input.nodes,
      { id: 'isolated', label: 'isolated', x: 10000, y: 10000, w: 80, h: 40, depth: 0 },
    ],
    groups: [
      ...input.groups,
      {
        id: 'isolated-group',
        label: 'isolated',
        x: 10000,
        y: 10000,
        w: 160,
        h: 120,
        members: [index],
      },
    ],
    rows: [...input.rows, []],
    avoidance: {
      ...input.avoidance,
      options: {
        ...input.avoidance.options,
        insets: [...input.avoidance.options.insets, { left: 24, right: 24, top: 44, bottom: 24 }],
      },
    },
  }
  const result = layoutDependencyY(mixed)
  expect(result.upstream.roots).toEqual(original.upstream.roots)
  expect(result.upstream.unresolved).toHaveLength(1)
  expect(result.nodes[index].rootDistance).toBeNull()
  expect(
    result.dependencyOptimization.groups.slice(0, -1).map((group) => group.dependencies),
  ).toEqual(original.dependencyOptimization.groups.map((group) => group.dependencies))
  expect(result.metrics.hits).toBe(0)
  expect(result.metrics.groupHaloPairs).toBe(0)
})
