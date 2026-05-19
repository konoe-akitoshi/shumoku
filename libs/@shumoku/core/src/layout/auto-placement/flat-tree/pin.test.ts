// Pinned positions.

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node, Subgraph } from '../../../models/types.js'
import { layoutFlatTree } from './index.js'

function node(id: string, parent?: string): Node {
  return { id, label: id, ...(parent ? { parent } : {}), size: { width: 80, height: 60 } }
}

function subgraph(id: string): Subgraph {
  return { id, label: id }
}

function link(from: string, to: string): Link {
  return {
    from: { node: from, port: 'p' },
    to: { node: to, port: 'p' },
  }
}

function setUp(
  nodes: Node[],
  links: Link[] = [],
  subgraphs: Subgraph[] = [],
): {
  graph: NetworkGraph
  nodesById: Map<string, Node>
  subgraphsById: Map<string, Subgraph>
  sizeById: Map<string, { width: number; height: number }>
} {
  return {
    graph: { name: 't', nodes, links, subgraphs },
    nodesById: new Map(nodes.map((n) => [n.id, n])),
    subgraphsById: new Map(subgraphs.map((s) => [s.id, s])),
    sizeById: new Map(nodes.map((n) => [n.id, n.size as { width: number; height: number }])),
  }
}

describe('layoutFlatTree — pinned positions', () => {
  test('top-level pinned node snaps to target', () => {
    const env = setUp([node('a'), node('b')], [link('a', 'b')])
    const r = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { pinned: new Map([['a', { x: 500, y: 500 }]]) },
    )
    expect(r.nodePositions.get('a')).toEqual({ x: 500, y: 500 })
  })

  test('pinned node inside subgraph drags the cluster', () => {
    const env = setUp([node('a', 'sg'), node('b', 'sg')], [link('a', 'b')], [subgraph('sg')])
    const baseline = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
    )
    const baselineA = baseline.nodePositions.get('a')
    const baselineB = baseline.nodePositions.get('b')
    if (!baselineA || !baselineB) throw new Error('expected baseline positions')
    const relativeBA = { x: baselineB.x - baselineA.x, y: baselineB.y - baselineA.y }

    const pinned = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { pinned: new Map([['a', { x: 1000, y: 1000 }]]) },
    )
    const pinnedA = pinned.nodePositions.get('a')
    const pinnedB = pinned.nodePositions.get('b')
    if (!pinnedA || !pinnedB) throw new Error('expected pinned positions')
    expect(pinnedA).toEqual({ x: 1000, y: 1000 })
    // b's relative position to a is preserved.
    expect(pinnedB.x - pinnedA.x).toBeCloseTo(relativeBA.x, 1)
    expect(pinnedB.y - pinnedA.y).toBeCloseTo(relativeBA.y, 1)
  })

  test('subgraph hull moves along with the pinned cluster', () => {
    const env = setUp([node('a', 'sg'), node('b', 'sg')], [link('a', 'b')], [subgraph('sg')])
    const baseline = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
    )
    const baselineHull = baseline.subgraphBounds.get('sg')
    if (!baselineHull) throw new Error('expected baseline hull')

    const pinned = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { pinned: new Map([['a', { x: 1000, y: 1000 }]]) },
    )
    const pinnedHull = pinned.subgraphBounds.get('sg')
    if (!pinnedHull) throw new Error('expected pinned hull')
    // Hull moved; size unchanged.
    expect(pinnedHull.width).toBe(baselineHull.width)
    expect(pinnedHull.height).toBe(baselineHull.height)
    expect(pinnedHull.x).not.toBe(baselineHull.x)
  })

  test('empty pin map → identical to no pin', () => {
    const env = setUp([node('a'), node('b')], [link('a', 'b')])
    const noPin = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
    )
    const emptyPin = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { pinned: new Map() },
    )
    expect(emptyPin.nodePositions).toEqual(noPin.nodePositions)
  })
})
