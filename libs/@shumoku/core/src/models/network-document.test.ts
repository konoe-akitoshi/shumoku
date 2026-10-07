import { describe, expect, it } from 'vitest'
import {
  combineNetworkDocument,
  parseNetworkPresentation,
  separateNetworkGraph,
} from './network-document.js'
import type { NetworkGraph } from './types.js'

const graph: NetworkGraph = {
  version: '1',
  nodes: [
    {
      id: 'a',
      label: 'Router',
      position: { x: -20, y: 40 },
      size: { width: 200, height: 90 },
      metadata: { building: 'A', physicalPosition: { x: 1, y: 2 } },
      identity: { sysName: 'router' },
    },
    { id: 'b', label: 'Switch' },
  ],
  links: [{ id: 'uplink', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }],
  terminations: [{ id: 'eps', label: 'EPS', role: 'eps', position: { x: 5, y: 6 } }],
}

describe('network document presentation separation', () => {
  it('allows position-only, size-only and combined geometry', () => {
    const presentation = {
      links: [],
      subgraphs: [],
      nodes: [
        { nodeId: 'a', position: { x: 10, y: 20 } },
        { nodeId: 'b', size: { width: 100, height: 80 } },
        { nodeId: 'c', position: { x: 30, y: 40 }, size: { width: 200, height: 100 } },
      ],
    }
    expect(parseNetworkPresentation(presentation)).toEqual(presentation)
  })

  it('rejects duplicate topology IDs on both sides of the storage boundary', () => {
    const duplicate = { ...graph, nodes: [graph.nodes[0], graph.nodes[0]] }
    const untyped = JSON.parse(JSON.stringify(duplicate))
    expect(() => separateNetworkGraph(untyped)).toThrow('Duplicate topology node')
    const document = JSON.parse(JSON.stringify(separateNetworkGraph(graph)))
    document.topology.nodes.push(document.topology.nodes[0])
    expect(() => combineNetworkDocument(document)).toThrow('Duplicate topology node')
  })

  it.each([0, true, '', null])('rejects invalid node ID %j even without diagram geometry', (id) => {
    const untyped = JSON.parse(
      JSON.stringify({ version: '1', nodes: [{ id, label: 'A' }], links: [] }),
    )
    expect(() => separateNetworkGraph(untyped)).toThrow()
    expect(() =>
      combineNetworkDocument({
        schemaVersion: '2',
        topology: untyped,
        presentation: { nodes: [], links: [], subgraphs: [] },
      }),
    ).toThrow()
  })

  it('rejects removed rank through both storage operations', () => {
    const untyped = JSON.parse(
      JSON.stringify({ version: '1', nodes: [{ id: 'a', label: 'A', rank: 0 }], links: [] }),
    )
    expect(() => separateNetworkGraph(untyped)).toThrow('Node.rank is no longer supported')
    expect(() =>
      combineNetworkDocument({
        schemaVersion: '2',
        topology: untyped,
        presentation: { nodes: [], links: [], subgraphs: [] },
      }),
    ).toThrow('Node.rank is no longer supported')
  })
  it('separates all entity appearance and keeps topology identical after restyling', () => {
    const styled: NetworkGraph = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        shape: 'cylinder',
        style: { fill: '#123456', opacity: 0 },
      })),
      links: [
        {
          ...graph.links[0],
          id: 'first',
          style: { stroke: '#234567', strokeWidth: 0, minLength: 0 },
        },
        { ...graph.links[0], id: 'parallel', style: { stroke: '#345678' } },
      ],
      subgraphs: [
        {
          id: 'group',
          label: 'Building',
          style: { fill: '#456789', padding: 0, labelPosition: 'bottom' },
        },
      ],
    }
    const before = structuredClone(styled)
    const document = separateNetworkGraph(styled)
    for (const entity of [
      ...document.topology.nodes,
      ...document.topology.links,
      ...(document.topology.subgraphs ?? []),
    ])
      expect(entity).not.toHaveProperty('style')
    expect(document.topology.nodes[0]).not.toHaveProperty('shape')
    expect(document.presentation.links.map((entry) => entry.linkId)).toEqual(['first', 'parallel'])
    expect(combineNetworkDocument(JSON.parse(JSON.stringify(document)))).toEqual(styled)
    const runtime = combineNetworkDocument(document)
    runtime.nodes = runtime.nodes.map((node) => ({
      ...node,
      shape: 'circle',
      style: { fill: 'red' },
    }))
    runtime.links = runtime.links.map((link) => ({ ...link, style: { stroke: 'blue' } }))
    runtime.subgraphs = runtime.subgraphs?.map((group) => ({ ...group, style: { fill: 'green' } }))
    expect(separateNetworkGraph(runtime).topology).toEqual(document.topology)
    expect(styled).toEqual(before)
  })

  it('preserves unstyled idless links and diagnoses styled idless links', () => {
    const link = { from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }
    const input = { ...graph, links: [link] }
    expect(combineNetworkDocument(separateNetworkGraph(input))).toEqual(input)
    expect(() => separateNetworkGraph({ ...input, links: [{ ...link, style: {} }] })).toThrow(
      'stable ID',
    )
  })

  it.each(['links', 'subgraphs'] as const)(
    'diagnoses stale, duplicate and leaking %s styles',
    (kind) => {
      const document = JSON.parse(
        JSON.stringify(
          separateNetworkGraph({
            ...graph,
            subgraphs: [{ id: 'group', label: 'Group' }],
          }),
        ),
      )
      const entry =
        kind === 'links' ? { linkId: 'missing', style: {} } : { subgraphId: 'missing', style: {} }
      document.presentation[kind] = [entry]
      expect(() => combineNetworkDocument(document)).toThrow('Missing presentation')
      document.presentation[kind] = [entry, entry]
      expect(() => combineNetworkDocument(document)).toThrow('Duplicate')
      document.presentation[kind] = []
      document.topology[kind][0].style = {}
      expect(() => combineNetworkDocument(document)).toThrow('contains presentation data')
    },
  )

  it.each([
    { style: { opacity: 2 } },
    { style: { strokeWidth: -1 } },
    { style: { fontSize: Number.NaN } },
    { style: { custom: 'unsupported' } },
    { shape: 'unknown' },
  ])('rejects invalid appearance %j', (appearance) => {
    expect(() =>
      parseNetworkPresentation({
        nodes: [{ nodeId: 'a', ...appearance }],
        links: [],
        subgraphs: [],
      }),
    ).toThrow()
  })

  it('accepts shape-only and empty style overrides without inventing geometry', () => {
    const presentation = {
      nodes: [
        { nodeId: 'a', shape: 'circle' },
        { nodeId: 'b', style: {} },
      ],
      links: [],
      subgraphs: [],
    }
    expect(parseNetworkPresentation(presentation)).toEqual(presentation)
  })
  it('persists facts and geometry separately and round-trips connections and physical data', () => {
    const before = structuredClone(graph)
    const document = separateNetworkGraph(graph)
    const saved = JSON.parse(JSON.stringify(document))
    expect(saved.topology.nodes[0]).not.toHaveProperty('position')
    expect(saved.topology.nodes[0]).not.toHaveProperty('size')
    expect(saved.presentation.nodes).toEqual([
      { nodeId: 'a', position: { x: -20, y: 40 }, size: { width: 200, height: 90 } },
    ])
    expect(combineNetworkDocument(saved)).toEqual(graph)
    expect(graph).toEqual(before)
  })

  it('keeps topology identical after a move, resize, and return to the original presentation', () => {
    const document = separateNetworkGraph(graph)
    const facts = structuredClone(document.topology)
    const moved = structuredClone(document)
    moved.presentation.nodes = [
      { nodeId: 'a', position: { x: 800, y: 600 }, size: { width: 300, height: 120 } },
    ]
    const runtime = combineNetworkDocument(moved)
    expect(runtime.nodes[0]?.position).toEqual({ x: 800, y: 600 })
    expect(runtime.links).toEqual(graph.links)
    expect(separateNetworkGraph(runtime).topology).toEqual(facts)
    expect(combineNetworkDocument(document)).toEqual(graph)
    const metadata = runtime.nodes[0]?.metadata
    if (metadata) metadata['building'] = 'changed'
    expect(document.topology).toEqual(facts)
  })

  it('does not persist calculated geometry unless the caller explicitly passes that runtime result', () => {
    const document = separateNetworkGraph({
      version: '1',
      nodes: [{ id: 'a', label: 'A' }],
      links: [],
    })
    const runtime = combineNetworkDocument(document)
    const node = runtime.nodes[0]
    if (!node) throw new Error('Missing fixture')
    node.position = { x: 10, y: 20 }
    node.size = { width: 100, height: 80 }
    expect(document.presentation.nodes).toEqual([])
    expect(document.topology.nodes[0]).not.toHaveProperty('position')
  })

  it('diagnoses stale references, duplicate entries, and geometry left in topology', () => {
    const document = separateNetworkGraph(graph)
    expect(() =>
      combineNetworkDocument({
        ...document,
        presentation: {
          nodes: [{ nodeId: 'missing', position: { x: 1, y: 2 } }],
          links: [],
          subgraphs: [],
        },
      }),
    ).toThrow('Missing presentation node')
    expect(() =>
      combineNetworkDocument({
        ...document,
        presentation: {
          links: [],
          subgraphs: [],
          nodes: [...document.presentation.nodes, ...document.presentation.nodes],
        },
      }),
    ).toThrow('Duplicate node presentation')
    const invalid = JSON.parse(JSON.stringify(document))
    invalid.topology.nodes[0].position = { x: 1, y: 2 }
    expect(() => combineNetworkDocument(invalid)).toThrow(
      'Topology node contains presentation data',
    )
  })

  it.each([
    { nodeId: 'a', position: { x: Number.NaN, y: 0 } },
    { nodeId: 'a', size: { width: 0, height: 1 } },
    { nodeId: 'a' },
    { nodeId: 'a', position: { x: 1, y: 2 }, rank: 0 },
  ])('rejects invalid or unsupported geometry: %j', (geometry) => {
    const document = JSON.parse(JSON.stringify(separateNetworkGraph(graph)))
    document.presentation.nodes = [geometry]
    expect(() => combineNetworkDocument(document)).toThrow()
  })
})
