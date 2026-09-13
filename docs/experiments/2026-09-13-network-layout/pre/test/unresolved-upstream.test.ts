import { expect, test } from 'bun:test'
import type { LayoutSeed } from '../src/model'
import { layoutNetwork } from '../src/result'

/** One group of 80×40 devices at the given seed centers, linked by index pairs. */
function singleGroupSeed(
  positions: readonly (readonly [number, number])[],
  edges: readonly (readonly [number, number])[],
): LayoutSeed {
  const frame = { x: 150, y: 150, w: 500, h: 500 }
  return {
    nodes: positions.map(([x, y], index) => ({
      id: `n${index}`,
      width: 80,
      height: 40,
      position: { x, y },
      preferredOffsetX: x - frame.x,
    })),
    groups: [
      {
        id: 'g',
        nodeIds: positions.map((_, index) => `n${index}`),
        frame,
        padding: { left: 24, right: 24, top: 44, bottom: 24 },
      },
    ],
    links: edges.map(([source, target], index) => ({
      id: `l${index}`,
      source: `n${source}`,
      target: `n${target}`,
    })),
  }
}

const cases: readonly {
  readonly name: string
  readonly positions: readonly (readonly [number, number])[]
  readonly edges: readonly (readonly [number, number])[]
}[] = [
  { name: 'isolated node', positions: [[0, 0]], edges: [] },
  {
    name: 'two endpoints',
    positions: [
      [0, 0],
      [300, 0],
    ],
    edges: [[0, 1]],
  },
  {
    name: 'zero-vote chain',
    positions: [
      [0, 0],
      [300, 0],
      [600, 0],
    ],
    edges: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    name: 'leafless ring',
    positions: [
      [0, 0],
      [300, 0],
      [300, 300],
      [0, 300],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  },
]

for (const { name, positions, edges } of cases)
  test(`${name}: lays out without inventing an upstream`, () => {
    const seed = singleGroupSeed(positions, edges)
    const untouched = structuredClone(seed)
    const layout = layoutNetwork(seed)

    expect(seed).toEqual(untouched)
    expect(layout.upstream.roots).toEqual([])
    expect(layout.translationGaugeId).toBe('n0')
    expect(layout.nodes.every((node) => node.upstreamDistance === null)).toBe(true)
    expect(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(
      true,
    )
    expect(layout.diagnostics.groupSolves.flatMap((solve) => solve.dependencies)).toEqual([])
    if (edges.length > 0)
      expect(
        layout.diagnostics.groupSolves.reduce((total, solve) => total + solve.springs, 0),
      ).toBeGreaterThan(0)
    expect(layout.links).toHaveLength(edges.length)
    expect(layout.diagnostics.metrics.lineHits).toBe(0)
    expect(layout.diagnostics.metrics.nodeHaloOverlaps).toBe(0)
  })
