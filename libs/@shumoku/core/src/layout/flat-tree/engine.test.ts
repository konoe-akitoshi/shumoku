// Integration tests for the flat-tree engine.

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node, Subgraph } from '../../models/types.js'
import { layoutFlatTree } from './index.js'

function node(id: string, parent?: string, size = { width: 80, height: 60 }): Node {
  return {
    id,
    label: id,
    ...(parent ? { parent } : {}),
    size,
  }
}

function subgraph(id: string, parent?: string): Subgraph {
  return { id, label: id, ...(parent ? { parent } : {}) }
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
  const graph: NetworkGraph = { name: 't', nodes, links, subgraphs }
  return {
    graph,
    nodesById: new Map(nodes.map((n) => [n.id, n])),
    subgraphsById: new Map(subgraphs.map((s) => [s.id, s])),
    sizeById: new Map(nodes.map((n) => [n.id, n.size ?? { width: 80, height: 60 }])),
  }
}

const noFlip = () => false

describe('layoutFlatTree — edge cases', () => {
  test('empty graph returns empty result', () => {
    const env = setUp([], [], [])
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    expect(r.nodePositions.size).toBe(0)
    expect(r.subgraphBounds.size).toBe(0)
  })

  test('single top-level node', () => {
    const env = setUp([node('a')])
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    expect(r.nodePositions.size).toBe(1)
    expect(r.nodePositions.get('a')).toBeDefined()
  })

  test('two-node chain a -> b', () => {
    const env = setUp([node('a'), node('b')], [link('a', 'b')])
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    const a = r.nodePositions.get('a')
    const b = r.nodePositions.get('b')
    expect(a && b).toBeTruthy()
    if (a && b) {
      // b sits below a (TB direction).
      expect(b.y).toBeGreaterThan(a.y)
      // Single child sits at parent's x.
      expect(b.x).toBeCloseTo(a.x, 1)
    }
  })

  test('disconnected components both lay out', () => {
    const env = setUp(
      [node('a'), node('b'), node('c'), node('d')],
      [link('a', 'b'), link('c', 'd')],
    )
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    expect(r.nodePositions.size).toBe(4)
    // Different roots ⇒ different x columns.
    const a = r.nodePositions.get('a')
    const c = r.nodePositions.get('c')
    expect(a?.x).not.toBe(c?.x)
  })

  test('cycle is broken (no infinite loop)', () => {
    const env = setUp(
      [node('a'), node('b'), node('c')],
      [link('a', 'b'), link('b', 'c'), link('c', 'a')],
    )
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    expect(r.nodePositions.size).toBe(3)
  })

  test('self-loop on a node is ignored', () => {
    const env = setUp([node('a')], [link('a', 'a')])
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    expect(r.nodePositions.size).toBe(1)
  })

  test('subgraph hull bounds its only member with padding', () => {
    const env = setUp([node('a', 'sg1')], [], [subgraph('sg1')])
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    const aPos = r.nodePositions.get('a')
    const hull = r.subgraphBounds.get('sg1')
    expect(aPos && hull).toBeTruthy()
    if (aPos && hull) {
      // Hull strictly contains the node footprint.
      expect(hull.x).toBeLessThan(aPos.x - 40)
      expect(hull.x + hull.width).toBeGreaterThan(aPos.x + 40)
    }
  })

  test('nested subgraph: inner sits inside outer', () => {
    const env = setUp([node('a', 'inner')], [], [subgraph('outer'), subgraph('inner', 'outer')])
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    const inner = r.subgraphBounds.get('inner')
    const outer = r.subgraphBounds.get('outer')
    expect(inner && outer).toBeTruthy()
    if (inner && outer) {
      // Outer contains inner geometrically.
      expect(outer.x).toBeLessThanOrEqual(inner.x)
      expect(outer.x + outer.width).toBeGreaterThanOrEqual(inner.x + inner.width)
      expect(outer.y).toBeLessThanOrEqual(inner.y)
      expect(outer.y + outer.height).toBeGreaterThanOrEqual(inner.y + inner.height)
    }
  })

  test('subgraph hulls do not overlap (siblings)', () => {
    // sg1 and sg2 are independent siblings — each has its own node.
    const env = setUp(
      [node('a', 'sg1'), node('b', 'sg2'), node('root')],
      [link('root', 'a'), link('root', 'b')],
      [subgraph('sg1'), subgraph('sg2')],
    )
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    const sg1 = r.subgraphBounds.get('sg1')
    const sg2 = r.subgraphBounds.get('sg2')
    expect(sg1 && sg2).toBeTruthy()
    if (sg1 && sg2) {
      const overlapX = Math.min(sg1.x + sg1.width, sg2.x + sg2.width) - Math.max(sg1.x, sg2.x)
      const overlapY = Math.min(sg1.y + sg1.height, sg2.y + sg2.height) - Math.max(sg1.y, sg2.y)
      // No overlap on at least one axis.
      expect(overlapX <= 0 || overlapY <= 0).toBe(true)
    }
  })

  test('multi-emitter subgraph: two emitters share an x column via spine alignment', () => {
    // sg has two internal members e1 → e2; each emits an external child.
    const env = setUp(
      [node('e1', 'sg'), node('e2', 'sg'), node('extA'), node('extB')],
      [link('e1', 'e2'), link('e1', 'extA'), link('e2', 'extB')],
      [subgraph('sg')],
    )
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    const e1 = r.nodePositions.get('e1')
    const e2 = r.nodePositions.get('e2')
    expect(e1 && e2).toBeTruthy()
    if (e1 && e2) {
      // Spine alignment pulls e2 onto e1's x.
      expect(e2.x).toBeCloseTo(e1.x, 1)
      // e2 sits below e1.
      expect(e2.y).toBeGreaterThan(e1.y)
    }
  })

  test('emitter-with-side-chain: in-subgraph chain sits to the side', () => {
    // sg has root → chain1 → chain2 internally; root emits to external.
    const env = setUp(
      [node('root', 'sg'), node('chain1', 'sg'), node('chain2', 'sg'), node('ext')],
      [link('root', 'chain1'), link('chain1', 'chain2'), link('root', 'ext')],
      [subgraph('sg')],
    )
    const r = layoutFlatTree(env.graph, env.nodesById, env.subgraphsById, env.sizeById, noFlip)
    const root = r.nodePositions.get('root')
    const chain1 = r.nodePositions.get('chain1')
    const ext = r.nodePositions.get('ext')
    expect(root && chain1 && ext).toBeTruthy()
    if (root && chain1 && ext) {
      // Chain offset to the side (right).
      expect(chain1.x).not.toBe(root.x)
      // External child sits directly below root.x.
      expect(ext.x).toBeCloseTo(root.x, 1)
    }
  })

  test('deterministic — same input twice yields identical positions', () => {
    const buildEnv = () =>
      setUp(
        [node('root'), node('a', 'sg1'), node('b', 'sg1')],
        [link('root', 'a'), link('root', 'b')],
        [subgraph('sg1')],
      )
    const e1 = buildEnv()
    const e2 = buildEnv()
    const r1 = layoutFlatTree(e1.graph, e1.nodesById, e1.subgraphsById, e1.sizeById, noFlip)
    const r2 = layoutFlatTree(e2.graph, e2.nodesById, e2.subgraphsById, e2.sizeById, noFlip)
    for (const [id, pos] of r1.nodePositions) {
      expect(r2.nodePositions.get(id)).toEqual(pos)
    }
  })
})
