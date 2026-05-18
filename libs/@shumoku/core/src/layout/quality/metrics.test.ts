// Quality metric primitives.

import { describe, expect, test } from 'vitest'
import type { Bounds, NetworkGraph } from '../../models/types.js'
import {
  aspectRatio,
  edgeCrossings,
  edgeCrossingsByKind,
  edgeLength,
  hullOverlap,
  rootArea,
  siblingHullOverlap,
  stabilityScore,
} from './metrics.js'

function pos(...entries: Array<[string, number, number]>): Map<string, { x: number; y: number }> {
  return new Map(entries.map(([id, x, y]) => [id, { x, y }]))
}

function bounds(x: number, y: number, w: number, h: number): Bounds {
  return { x, y, width: w, height: h }
}

describe('edgeLength', () => {
  test('zero edges → zero metrics', () => {
    const graph: NetworkGraph = { name: 't', nodes: [], links: [], subgraphs: [] }
    const m = edgeLength(graph, new Map())
    expect(m).toEqual({ total: 0, mean: 0, max: 0, count: 0 })
  })

  test('three-four-five triangle gives length 5', () => {
    const graph: NetworkGraph = {
      name: 't',
      nodes: [],
      links: [
        {
          from: { node: 'a', port: 'p' },
          to: { node: 'b', port: 'p' },
        },
      ],
      subgraphs: [],
    }
    const m = edgeLength(graph, pos(['a', 0, 0], ['b', 3, 4]))
    expect(m.total).toBeCloseTo(5, 5)
    expect(m.max).toBeCloseTo(5, 5)
    expect(m.count).toBe(1)
  })

  test('skips edges with missing endpoint positions', () => {
    const graph: NetworkGraph = {
      name: 't',
      nodes: [],
      links: [
        { from: { node: 'a', port: 'p' }, to: { node: 'b', port: 'p' } },
        { from: { node: 'a', port: 'p' }, to: { node: 'ghost', port: 'p' } },
      ],
      subgraphs: [],
    }
    const m = edgeLength(graph, pos(['a', 0, 0], ['b', 3, 4]))
    expect(m.count).toBe(1)
  })
})

describe('rootArea / aspectRatio', () => {
  test('area is width × height', () => {
    expect(rootArea(bounds(0, 0, 100, 50))).toBe(5000)
  })

  test('aspectRatio = width / height', () => {
    expect(aspectRatio(bounds(0, 0, 200, 100))).toBe(2)
  })

  test('aspectRatio handles zero-height bounds', () => {
    expect(aspectRatio(bounds(0, 0, 100, 0))).toBe(0)
  })
})

describe('edgeCrossings', () => {
  function makeGraph(...edges: Array<[string, string]>): NetworkGraph {
    return {
      name: 't',
      nodes: [],
      links: edges.map(([from, to]) => ({
        from: { node: from, port: 'p' },
        to: { node: to, port: 'p' },
      })),
      subgraphs: [],
    }
  }

  test('two parallel horizontal segments do not cross', () => {
    const g = makeGraph(['a', 'b'], ['c', 'd'])
    const p = pos(['a', 0, 0], ['b', 10, 0], ['c', 0, 5], ['d', 10, 5])
    expect(edgeCrossings(g, p)).toBe(0)
  })

  test('X pattern: two segments cross once', () => {
    const g = makeGraph(['a', 'b'], ['c', 'd'])
    const p = pos(['a', 0, 0], ['b', 10, 10], ['c', 0, 10], ['d', 10, 0])
    expect(edgeCrossings(g, p)).toBe(1)
  })

  test('segments sharing a node do not count as crossing', () => {
    const g = makeGraph(['a', 'b'], ['a', 'c'])
    const p = pos(['a', 0, 0], ['b', 10, 0], ['c', 5, 10])
    expect(edgeCrossings(g, p)).toBe(0)
  })

  test('overlay vs primary split via edgeCrossingsByKind', () => {
    const g: NetworkGraph = {
      name: 't',
      nodes: [],
      links: [
        { from: { node: 'a', port: 'p' }, to: { node: 'b', port: 'p' } },
        {
          from: { node: 'c', port: 'p' },
          to: { node: 'd', port: 'p' },
          redundancy: 'ha',
        },
      ],
      subgraphs: [],
    }
    const p = pos(['a', 0, 0], ['b', 10, 10], ['c', 0, 10], ['d', 10, 0])
    const split = edgeCrossingsByKind(g, p)
    expect(split.total).toBe(1)
    // One overlay edge involved → overlay bucket.
    expect(split.overlay).toBe(1)
    expect(split.primary).toBe(0)
  })
})

describe('hullOverlap', () => {
  test('non-overlapping hulls → 0', () => {
    const m = new Map([
      ['a', bounds(0, 0, 10, 10)],
      ['b', bounds(20, 0, 10, 10)],
    ])
    expect(hullOverlap(m)).toBe(0)
  })

  test('half-overlapping pair', () => {
    const m = new Map([
      ['a', bounds(0, 0, 10, 10)],
      ['b', bounds(5, 0, 10, 10)],
    ])
    // overlap rect: x=[5,10], y=[0,10] → 5*10 = 50
    expect(hullOverlap(m)).toBe(50)
  })

  test('siblingHullOverlap skips nested pairs', () => {
    const m = new Map([
      ['outer', bounds(0, 0, 20, 20)],
      ['inner', bounds(2, 2, 5, 5)],
    ])
    const parents = new Map<string, string | undefined>([
      ['outer', undefined],
      ['inner', 'outer'],
    ])
    expect(siblingHullOverlap(m, parents)).toBe(0)
  })
})

describe('stabilityScore', () => {
  test('identical layouts → 0', () => {
    const a = pos(['x', 0, 0], ['y', 10, 10])
    const b = pos(['x', 0, 0], ['y', 10, 10])
    expect(stabilityScore(a, b)).toBe(0)
  })

  test('RMS displacement of one node by 5 units → 5/√2 (averaged with one zero-shift)', () => {
    const a = pos(['x', 0, 0], ['y', 10, 10])
    const b = pos(['x', 3, 4], ['y', 10, 10])
    // Displacements: x=5, y=0 → RMS = sqrt((25+0)/2) ≈ 3.535
    expect(stabilityScore(a, b)).toBeCloseTo(Math.sqrt(25 / 2), 3)
  })

  test('nodes only in one map are ignored', () => {
    const a = pos(['x', 0, 0])
    const b = pos(['x', 0, 0], ['ghost', 100, 100])
    expect(stabilityScore(a, b)).toBe(0)
  })
})
