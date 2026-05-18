// Validation + diagnostics.

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node, Subgraph } from '../../models/types.js'
import { validateGraph } from './diagnostics.js'
import { layoutFlatTree } from './index.js'

function node(id: string, parent?: string): Node {
  return { id, label: id, ...(parent ? { parent } : {}) }
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

describe('validateGraph', () => {
  test('flags duplicate node ids', () => {
    const g: NetworkGraph = {
      name: 't',
      nodes: [node('a'), node('a'), node('b')],
      links: [],
      subgraphs: [],
    }
    const ds = validateGraph(g)
    expect(ds.find((d) => d.code === 'duplicate-node-id')).toBeDefined()
  })

  test('flags node referencing missing subgraph parent', () => {
    const g: NetworkGraph = {
      name: 't',
      nodes: [node('a', 'ghost')],
      links: [],
      subgraphs: [],
    }
    const ds = validateGraph(g)
    expect(ds.find((d) => d.code === 'missing-subgraph-parent')).toBeDefined()
  })

  test('flags subgraph referencing missing parent', () => {
    const g: NetworkGraph = {
      name: 't',
      nodes: [],
      links: [],
      subgraphs: [subgraph('child', 'ghost')],
    }
    const ds = validateGraph(g)
    expect(ds.find((d) => d.code === 'missing-subgraph-parent')).toBeDefined()
  })

  test('flags link to missing node', () => {
    const g: NetworkGraph = {
      name: 't',
      nodes: [node('a')],
      links: [link('a', 'ghost')],
      subgraphs: [],
    }
    const ds = validateGraph(g)
    expect(ds.find((d) => d.code === 'link-endpoint-missing')).toBeDefined()
  })

  test('records self-loop as info', () => {
    const g: NetworkGraph = {
      name: 't',
      nodes: [node('a')],
      links: [link('a', 'a')],
      subgraphs: [],
    }
    const ds = validateGraph(g)
    const d = ds.find((x) => x.code === 'self-loop')
    expect(d).toBeDefined()
    expect(d?.severity).toBe('info')
  })

  test('clean input → empty diagnostics', () => {
    const g: NetworkGraph = {
      name: 't',
      nodes: [node('a'), node('b')],
      links: [link('a', 'b')],
      subgraphs: [],
    }
    expect(validateGraph(g)).toEqual([])
  })
})

describe('layoutFlatTree diagnostics integration', () => {
  test('result.diagnostics includes input validation + missing-size warnings', () => {
    const a = node('a')
    const g: NetworkGraph = { name: 't', nodes: [a, node('b', 'ghost')], links: [], subgraphs: [] }
    const result = layoutFlatTree(
      g,
      new Map([
        ['a', a],
        ['b', node('b', 'ghost')],
      ]),
      new Map(),
      new Map(), // no size entries → both nodes trigger missing-size
      () => false,
    )
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.diagnostics.some((d) => d.code === 'missing-node-size')).toBe(true)
    expect(result.diagnostics.some((d) => d.code === 'missing-subgraph-parent')).toBe(true)
  })

  test('clean input → empty diagnostics in result', () => {
    const a = node('a')
    const b = node('b')
    const g: NetworkGraph = { name: 't', nodes: [a, b], links: [link('a', 'b')], subgraphs: [] }
    const result = layoutFlatTree(
      g,
      new Map([
        ['a', a],
        ['b', b],
      ]),
      new Map(),
      new Map([
        ['a', { width: 80, height: 60 }],
        ['b', { width: 80, height: 60 }],
      ]),
      () => false,
    )
    expect(result.diagnostics).toEqual([])
  })
})
