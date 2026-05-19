// Public facade API.

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node, Subgraph } from '../../../models/types.js'
import { createFlatTreeEngine } from './engine.js'

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

describe('createFlatTreeEngine', () => {
  test('lays out a minimal graph', () => {
    const engine = createFlatTreeEngine()
    const graph: NetworkGraph = {
      name: 't',
      nodes: [node('a'), node('b')],
      links: [link('a', 'b')],
      subgraphs: [],
    }
    const result = engine.layout(graph, {
      sizeById: new Map(graph.nodes.map((n) => [n.id, { width: 80, height: 60 }])),
    })
    expect(result.nodePositions.size).toBe(2)
    expect(result.diagnostics).toEqual([])
  })

  test('passes through options (direction, pinned)', () => {
    const engine = createFlatTreeEngine()
    const graph: NetworkGraph = {
      name: 't',
      nodes: [node('a'), node('b')],
      links: [link('a', 'b')],
      subgraphs: [],
    }
    const sizeById = new Map(graph.nodes.map((n) => [n.id, { width: 80, height: 60 }]))
    const lr = engine.layout(graph, { sizeById, direction: 'LR' })
    const lrA = lr.nodePositions.get('a')
    const lrB = lr.nodePositions.get('b')
    if (!lrA || !lrB) throw new Error('expected both positions')
    expect(lrB.x).toBeGreaterThan(lrA.x)

    const pinned = engine.layout(graph, {
      sizeById,
      pinned: new Map([['a', { x: 500, y: 500 }]]),
    })
    expect(pinned.nodePositions.get('a')).toEqual({ x: 500, y: 500 })
  })

  test('shouldFlip defaults to never flipping', () => {
    const engine = createFlatTreeEngine()
    const graph: NetworkGraph = {
      name: 't',
      nodes: [node('a'), node('b')],
      links: [link('a', 'b')],
      subgraphs: [],
    }
    const result = engine.layout(graph, {
      sizeById: new Map(graph.nodes.map((n) => [n.id, { width: 80, height: 60 }])),
    })
    // b sits below a, so a is the tree root and b is its child.
    const a = result.nodePositions.get('a')
    const b = result.nodePositions.get('b')
    if (!a || !b) throw new Error('expected both positions')
    expect(b.y).toBeGreaterThan(a.y)
  })

  test('surfaces diagnostics for missing-size + invalid subgraph parent', () => {
    const engine = createFlatTreeEngine()
    const graph: NetworkGraph = {
      name: 't',
      nodes: [node('a', 'ghost')],
      links: [],
      subgraphs: [subgraph('sg-real')],
    }
    const result = engine.layout(graph, { sizeById: new Map() })
    expect(result.diagnostics.some((d) => d.code === 'missing-node-size')).toBe(true)
    expect(result.diagnostics.some((d) => d.code === 'missing-subgraph-parent')).toBe(true)
  })
})
