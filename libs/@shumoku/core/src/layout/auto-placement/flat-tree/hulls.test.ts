// Subgraph hull bbox computation.

import { describe, expect, test } from 'vitest'
import type { NetworkGraph, Node, Subgraph } from '../../../models/types.js'
import { computeSubgraphHulls } from './hulls.js'

function node(id: string, parent?: string): Node {
  return { id, label: id, ...(parent ? { parent } : {}) }
}

function subgraph(id: string, parent?: string): Subgraph {
  return { id, label: id, ...(parent ? { parent } : {}) }
}

const PAD = 20
const LABEL = 28

describe('computeSubgraphHulls', () => {
  test('single-member subgraph hull bounds the member + padding + label', () => {
    const graph: NetworkGraph = {
      name: 't',
      nodes: [node('a', 'sg1')],
      links: [],
      subgraphs: [subgraph('sg1')],
    }
    const hulls = computeSubgraphHulls(
      graph,
      new Map([['a', { x: 100, y: 200 }]]),
      new Map([['a', { width: 80, height: 60 }]]),
      PAD,
      LABEL,
    )
    const b = hulls.get('sg1')
    expect(b).toBeDefined()
    expect(b?.x).toBe(100 - 40 - PAD) // node.left - padding
    expect(b?.y).toBe(200 - 30 - PAD - LABEL)
    expect(b?.width).toBe(80 + PAD * 2)
    expect(b?.height).toBe(60 + PAD * 2 + LABEL)
  })

  test('two-member hull is the bbox of both', () => {
    const graph: NetworkGraph = {
      name: 't',
      nodes: [node('a', 'sg1'), node('b', 'sg1')],
      links: [],
      subgraphs: [subgraph('sg1')],
    }
    const hulls = computeSubgraphHulls(
      graph,
      new Map([
        ['a', { x: 0, y: 0 }],
        ['b', { x: 200, y: 100 }],
      ]),
      new Map([
        ['a', { width: 80, height: 60 }],
        ['b', { width: 80, height: 60 }],
      ]),
      PAD,
      LABEL,
    )
    const b = hulls.get('sg1')
    expect(b?.x).toBe(-40 - PAD)
    expect(b?.y).toBe(-30 - PAD - LABEL)
    expect(b?.width).toBe(280 + PAD * 2) // (200 + 40) - (-40)
    expect(b?.height).toBe(160 + PAD * 2 + LABEL)
  })

  test('empty subgraph is omitted', () => {
    const graph: NetworkGraph = {
      name: 't',
      nodes: [],
      links: [],
      subgraphs: [subgraph('empty')],
    }
    const hulls = computeSubgraphHulls(graph, new Map(), new Map(), PAD, LABEL)
    expect(hulls.has('empty')).toBe(false)
  })

  test('nested subgraph hull covers child hulls', () => {
    const graph: NetworkGraph = {
      name: 't',
      nodes: [node('a', 'inner')],
      links: [],
      subgraphs: [subgraph('outer'), subgraph('inner', 'outer')],
    }
    const hulls = computeSubgraphHulls(
      graph,
      new Map([['a', { x: 0, y: 0 }]]),
      new Map([['a', { width: 80, height: 60 }]]),
      PAD,
      LABEL,
    )
    const inner = hulls.get('inner')
    const outer = hulls.get('outer')
    expect(inner).toBeDefined()
    expect(outer).toBeDefined()
    // Outer hull strictly contains inner hull (outer extends padding +
    // label further on every side).
    if (inner && outer) {
      expect(outer.x).toBeLessThan(inner.x)
      expect(outer.x + outer.width).toBeGreaterThan(inner.x + inner.width)
    }
  })
})
