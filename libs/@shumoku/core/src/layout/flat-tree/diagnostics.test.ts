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

describe('explainability diagnostics (opt-in via { explain: true })', () => {
  const baseSize = new Map<string, { width: number; height: number }>()

  function setUp(nodes: Node[], links: Link[], subgraphs: Subgraph[] = []) {
    const graph: NetworkGraph = { name: 't', nodes, links, subgraphs }
    const nodesById = new Map(nodes.map((n) => [n.id, n]))
    const subgraphsById = new Map(subgraphs.map((s) => [s.id, s]))
    const sizeById = new Map<string, { width: number; height: number }>(
      nodes.map((n) => [n.id, { width: 80, height: 60 }]),
    )
    return { graph, nodesById, subgraphsById, sizeById }
  }

  test('default (no explain) keeps info diagnostics empty for clean input', () => {
    const env = setUp([node('a'), node('b')], [link('a', 'b')])
    const result = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
    )
    expect(result.diagnostics.filter((d) => d.severity === 'info')).toEqual([])
  })

  test('explain emits block-join diagnostic per node', () => {
    const env = setUp([node('a'), node('b')], [link('a', 'b')])
    const result = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { explain: true },
    )
    const joins = result.diagnostics.filter((d) => d.code === 'block-join')
    expect(joins.length).toBe(2)
    expect(joins.every((d) => d.severity === 'info')).toBe(true)
  })

  test('explain emits sibling-order with source-port-label reason when port labels differ', () => {
    const env = setUp(
      [node('p'), node('a'), node('b')],
      [
        // Distinct source ports — sort decided by port label.
        {
          from: { node: 'p', port: 'p1' },
          to: { node: 'a', port: 'q' },
        },
        {
          from: { node: 'p', port: 'p2' },
          to: { node: 'b', port: 'q' },
        },
      ],
    )
    const result = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { explain: true },
    )
    const ord = result.diagnostics.find((d) => d.code === 'sibling-order')
    expect(ord).toBeDefined()
    expect(ord?.message.includes('source-port-label')).toBe(true)
  })

  test('explain emits spine-aligned when multi-emitter subgraph forces a shift', () => {
    const env = setUp(
      [node('e1', 'sg'), node('e2', 'sg'), node('extA'), node('extB')],
      [link('e1', 'e2'), link('e1', 'extA'), link('e2', 'extB')],
      [subgraph('sg')],
    )
    const result = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { explain: true },
    )
    expect(result.diagnostics.some((d) => d.code === 'spine-aligned')).toBe(true)
  })

  test('explain emits cycle-broken when a cycle is detected', () => {
    const env = setUp(
      [node('a'), node('b'), node('c')],
      [link('a', 'b'), link('b', 'c'), link('c', 'a')],
    )
    const result = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
      { explain: true },
    )
    const broken = result.diagnostics.find((d) => d.code === 'cycle-broken')
    expect(broken).toBeDefined()
    // The cycle list should appear in the message.
    expect(broken?.message.includes('→')).toBe(true)
  })
})
