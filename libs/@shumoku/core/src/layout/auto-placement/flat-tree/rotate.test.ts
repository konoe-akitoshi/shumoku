// Direction rotation pass.

import { describe, expect, test } from 'vitest'
import type {
  Bounds,
  Direction,
  Link,
  NetworkGraph,
  Node,
  Subgraph,
} from '../../../models/types.js'
import { layoutFlatTree } from './index.js'
import { rotateBounds, rotatePoint } from './rotate.js'

describe('rotatePoint', () => {
  test('TB is identity', () => {
    expect(rotatePoint({ x: 10, y: 20 }, 'TB')).toEqual({ x: 10, y: 20 })
  })

  test('BT flips y', () => {
    expect(rotatePoint({ x: 10, y: 20 }, 'BT')).toEqual({ x: 10, y: -20 })
  })

  test('LR swaps x and y', () => {
    expect(rotatePoint({ x: 10, y: 20 }, 'LR')).toEqual({ x: 20, y: 10 })
  })

  test('RL swaps and negates one axis', () => {
    expect(rotatePoint({ x: 10, y: 20 }, 'RL')).toEqual({ x: -20, y: 10 })
  })
})

describe('rotateBounds', () => {
  const b: Bounds = { x: 10, y: 20, width: 80, height: 60 }

  test('TB is identity', () => {
    expect(rotateBounds(b, 'TB')).toEqual(b)
  })

  test('BT flips y baseline', () => {
    // Original bottom edge at y=80; rotated top edge at y=-80.
    expect(rotateBounds(b, 'BT')).toEqual({ x: 10, y: -80, width: 80, height: 60 })
  })

  test('LR swaps width/height', () => {
    expect(rotateBounds(b, 'LR')).toEqual({ x: 20, y: 10, width: 60, height: 80 })
  })

  test('RL swaps and reflects', () => {
    // Original right edge at x=90; rotated left edge at x=-90+60=-30; we
    // expressed it as -(b.y + b.height) = -80.
    expect(rotateBounds(b, 'RL')).toEqual({ x: -80, y: 10, width: 60, height: 80 })
  })
})

describe('layoutFlatTree — direction sanity', () => {
  function setUp(): {
    graph: NetworkGraph
    nodesById: Map<string, Node>
    subgraphsById: Map<string, Subgraph>
    sizeById: Map<string, { width: number; height: number }>
  } {
    const node = (id: string): Node => ({ id, label: id, size: { width: 80, height: 60 } })
    const link = (from: string, to: string): Link => ({
      from: { node: from, port: 'p' },
      to: { node: to, port: 'p' },
    })
    const nodes: Node[] = [node('a'), node('b'), node('c')]
    const links: Link[] = [link('a', 'b'), link('a', 'c')]
    return {
      graph: { name: 't', nodes, links, subgraphs: [] },
      nodesById: new Map(nodes.map((n) => [n.id, n])),
      subgraphsById: new Map(),
      sizeById: new Map(nodes.map((n) => [n.id, { width: 80, height: 60 }])),
    }
  }

  function layout(direction: Direction): Map<string, { x: number; y: number }> {
    const env = setUp()
    const result = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { direction },
    )
    return result.nodePositions
  }

  test('TB: children sit below parent', () => {
    const p = layout('TB')
    const a = p.get('a')
    const b = p.get('b')
    expect(a && b).toBeTruthy()
    if (a && b) expect(b.y).toBeGreaterThan(a.y)
  })

  test('BT: children sit above parent', () => {
    const p = layout('BT')
    const a = p.get('a')
    const b = p.get('b')
    expect(a && b).toBeTruthy()
    if (a && b) expect(b.y).toBeLessThan(a.y)
  })

  test('LR: children sit to the right of parent', () => {
    const p = layout('LR')
    const a = p.get('a')
    const b = p.get('b')
    expect(a && b).toBeTruthy()
    if (a && b) expect(b.x).toBeGreaterThan(a.x)
  })

  test('RL: children sit to the left of parent', () => {
    const p = layout('RL')
    const a = p.get('a')
    const b = p.get('b')
    expect(a && b).toBeTruthy()
    if (a && b) expect(b.x).toBeLessThan(a.x)
  })

  test('LR rotation preserves siblings: b and c are at same x', () => {
    const p = layout('LR')
    const b = p.get('b')
    const c = p.get('c')
    expect(b && c).toBeTruthy()
    if (b && c) expect(b.x).toBeCloseTo(c.x, 1)
  })
})
