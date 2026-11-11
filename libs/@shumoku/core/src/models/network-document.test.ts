import { describe, expect, it } from 'vitest'
import {
  combineNetworkDocument,
  parseNetworkPresentation,
  separateNetworkGraph,
} from './network-document.js'
import type { NetworkGraph } from './types.js'

// The split an older store kept (a format v4 archive, the Editor's one-row-per-entity cache):
// read to bring such data forward, so what it still accepts and what it drops is pinned here.

const graph: NetworkGraph = {
  version: '1',
  nodes: [
    {
      id: 'a',
      label: 'Router',
      ports: [{ id: 'eth0', label: 'Interface', connectors: [] }],
    },
    { id: 'b', label: 'Switch' },
  ],
  links: [{ id: 'uplink', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }],
  terminations: [{ id: 'eps', label: 'EPS', role: 'eps' }],
}

describe('network document presentation separation', () => {
  it('separates appearance and graph settings and keeps the facts identical after restyling', () => {
    const styled: NetworkGraph = {
      ...graph,
      settings: { direction: 'LR', theme: 'dark', legend: false, hideDisconnected: false },
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
    expect(document.topology).not.toHaveProperty('settings')
    for (const entity of [
      ...document.topology.nodes,
      ...document.topology.links,
      ...(document.topology.subgraphs ?? []),
    ])
      expect(entity).not.toHaveProperty('style')
    expect(document.topology.nodes[0]).not.toHaveProperty('shape')
    expect(document.presentation.settings).toEqual(styled.settings)
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

  it('accepts the geometry, port placement and group direction an older store kept and drops them', () => {
    const document = JSON.parse(JSON.stringify(separateNetworkGraph(graph)))
    document.topology.subgraphs = [{ id: 'g', label: 'Group' }]
    document.presentation.nodes = [
      {
        nodeId: 'a',
        position: { x: 10, y: 20 },
        size: { width: 100, height: 80 },
        ports: [{ portId: 'eth0', placement: { side: 'left', order: -0.5 } }],
      },
    ]
    document.presentation.subgraphs = [{ subgraphId: 'g', direction: 'RL' }]
    const runtime = combineNetworkDocument(document)
    expect(runtime.nodes[0]).toEqual(graph.nodes[0])
    expect(runtime.subgraphs).toEqual([{ id: 'g', label: 'Group' }])
    expect(JSON.stringify(runtime)).not.toMatch(/position|placement|direction/)
  })

  it('round-trips connections and physical data unchanged', () => {
    const before = structuredClone(graph)
    const document = separateNetworkGraph(graph)
    expect(document.presentation.nodes).toEqual([])
    expect(combineNetworkDocument(JSON.parse(JSON.stringify(document)))).toEqual(graph)
    expect(graph).toEqual(before)
  })

  it.each([
    { settings: { direction: 'bad' } },
    { settings: { canvas: { dpi: 0 } } },
    { settings: { rankSpacing: Number.POSITIVE_INFINITY } },
    { settings: { unknown: true } },
    { nodes: [{ nodeId: 'a', ports: [] }] },
    { nodes: [{ nodeId: 'a', ports: [{ portId: 'p', placement: { order: Number.NaN } }] }] },
    { nodes: [{ nodeId: 'a', style: { opacity: 2 } }] },
    { nodes: [{ nodeId: 'a', style: { custom: 'unsupported' } }] },
    { nodes: [{ nodeId: 'a', shape: 'unknown' }] },
    { nodes: [{ nodeId: 'a' }] },
  ])('rejects invalid settings or appearance %j', (overrides) => {
    expect(() =>
      parseNetworkPresentation({ nodes: [], links: [], subgraphs: [], ...overrides }),
    ).toThrow()
  })

  it.each(['1', '2'])('rejects old document version %s', (schemaVersion) => {
    const document = JSON.parse(JSON.stringify(separateNetworkGraph(graph)))
    document.schemaVersion = schemaVersion
    expect(() => combineNetworkDocument(document)).toThrow('Unsupported network document version')
  })

  it('rejects duplicate topology IDs on both sides of the storage boundary', () => {
    const duplicate = { ...graph, nodes: [graph.nodes[0], graph.nodes[0]] }
    const untyped = JSON.parse(JSON.stringify(duplicate))
    expect(() => separateNetworkGraph(untyped)).toThrow('Duplicate topology node')
    const document = JSON.parse(JSON.stringify(separateNetworkGraph(graph)))
    document.topology.nodes.push(document.topology.nodes[0])
    expect(() => combineNetworkDocument(document)).toThrow('Duplicate topology node')
  })

  it.each([0, true, '', null])('rejects invalid node ID %j', (id) => {
    const untyped = JSON.parse(
      JSON.stringify({ version: '1', nodes: [{ id, label: 'A' }], links: [] }),
    )
    expect(() => separateNetworkGraph(untyped)).toThrow()
    expect(() =>
      combineNetworkDocument({
        schemaVersion: '3',
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
        schemaVersion: '3',
        topology: untyped,
        presentation: { nodes: [], links: [], subgraphs: [] },
      }),
    ).toThrow('Node.rank is no longer supported')
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
          separateNetworkGraph({ ...graph, subgraphs: [{ id: 'group', label: 'Group' }] }),
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

  it('diagnoses stale references, duplicate entries and appearance left in topology', () => {
    const document = separateNetworkGraph(graph)
    expect(() =>
      combineNetworkDocument({
        ...document,
        presentation: { nodes: [{ nodeId: 'missing', shape: 'circle' }], links: [], subgraphs: [] },
      }),
    ).toThrow('Missing presentation node')
    const styled = JSON.parse(JSON.stringify(document))
    styled.presentation.nodes = [
      { nodeId: 'a', shape: 'circle' },
      { nodeId: 'a', shape: 'circle' },
    ]
    expect(() => combineNetworkDocument(styled)).toThrow('Duplicate node presentation')
    const invalid = JSON.parse(JSON.stringify(document))
    invalid.topology.nodes[0].shape = 'circle'
    expect(() => combineNetworkDocument(invalid)).toThrow(
      'Topology node contains presentation data',
    )
    const stalePort = JSON.parse(JSON.stringify(document))
    stalePort.presentation.nodes = [
      { nodeId: 'a', ports: [{ portId: 'missing', placement: { side: 'top' } }] },
    ]
    expect(() => combineNetworkDocument(stalePort)).toThrow('Missing presentation port')
  })
})
