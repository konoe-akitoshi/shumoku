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
  it('separates port placement by owner and stable port ID without rewriting ports or links', () => {
    const input: NetworkGraph = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        ports: [
          {
            id: 'eth:0',
            label: 'Interface',
            connectors: [],
            identity: { ifName: 'eth0' },
            placement: { side: 'left', order: -0.5 },
          },
          { id: 'eth1', label: 'Uplink', connectors: [] },
        ],
      })),
    }
    const document = separateNetworkGraph(input)
    for (const node of document.topology.nodes) {
      expect(node.ports?.[0]).not.toHaveProperty('placement')
      expect(node.ports?.[0]?.identity).toEqual({ ifName: 'eth0' })
    }
    expect(document.presentation.nodes.every((node) => node.ports?.[0]?.portId === 'eth:0')).toBe(
      true,
    )
    expect(combineNetworkDocument(document)).toEqual(input)
    const edited = combineNetworkDocument(document)
    edited.nodes = edited.nodes.map((node) => ({
      ...node,
      ports: node.ports?.map((port) => ({ ...port, placement: { order: 0 } })),
    }))
    expect(separateNetworkGraph(edited).topology).toEqual(document.topology)
    expect(edited.links).toEqual(input.links)
  })

  it('diagnoses stale and duplicate port overrides and placement leaking into topology', () => {
    const document = JSON.parse(
      JSON.stringify(
        separateNetworkGraph({
          ...graph,
          nodes: [{ id: 'a', label: 'A', ports: [{ id: 'p', label: 'P', connectors: [] }] }],
        }),
      ),
    )
    document.presentation.nodes = [
      { nodeId: 'a', ports: [{ portId: 'missing', placement: { side: 'top' } }] },
    ]
    expect(() => combineNetworkDocument(document)).toThrow('Missing presentation port')
    document.presentation.nodes[0].ports.push(document.presentation.nodes[0].ports[0])
    expect(() => combineNetworkDocument(document)).toThrow('Duplicate port presentation')
    document.presentation.nodes = []
    document.topology.nodes[0].ports[0].placement = {}
    expect(() => combineNetworkDocument(document)).toThrow(
      'Topology port contains presentation data',
    )
  })

  it('moves all graph settings and group direction while discarding calculated bounds', () => {
    const input: NetworkGraph = {
      ...graph,
      settings: {
        direction: 'LR',
        theme: 'dark',
        edgeStyle: 'splines',
        splineMode: 'conservative_soft',
        nodeSpacing: 0,
        rankSpacing: 0,
        subgraphPadding: 0,
        canvas: {
          preset: 'A4',
          orientation: 'landscape',
          width: 800,
          height: 600,
          dpi: 96,
          fit: false,
          padding: 0,
        },
        legend: {
          enabled: false,
          position: 'bottom-right',
          showDeviceTypes: false,
          showBandwidth: true,
          showCableTypes: true,
          showVlans: false,
        },
        hideDisconnected: false,
      },
      subgraphs: [
        { id: 'g', label: 'Group', direction: 'RL', bounds: { x: 1, y: 2, width: 3, height: 4 } },
      ],
    }
    const before = structuredClone(input)
    const document = separateNetworkGraph(input)
    expect(document.topology).not.toHaveProperty('settings')
    expect(document.topology.subgraphs?.[0]).toEqual({ id: 'g', label: 'Group' })
    expect(document.presentation.settings).toEqual(input.settings)
    expect(document.presentation.subgraphs).toEqual([{ subgraphId: 'g', direction: 'RL' }])
    const runtime = combineNetworkDocument(document)
    expect(runtime.settings).toEqual(input.settings)
    expect(runtime.subgraphs?.[0]).not.toHaveProperty('bounds')
    runtime.settings = { direction: 'BT' }
    expect(separateNetworkGraph(runtime).topology).toEqual(document.topology)
    expect(input).toEqual(before)
    const invalid = JSON.parse(JSON.stringify(document))
    invalid.topology.settings = {}
    expect(() => combineNetworkDocument(invalid)).toThrow(
      'Topology graph contains presentation data',
    )
    delete invalid.topology.settings
    invalid.topology.subgraphs[0].bounds = {}
    expect(() => combineNetworkDocument(invalid)).toThrow(
      'Topology subgraph contains presentation data',
    )
  })

  it.each([
    { settings: { direction: 'bad' } },
    { settings: { canvas: { dpi: 0 } } },
    { settings: { rankSpacing: Number.POSITIVE_INFINITY } },
    { settings: { unknown: true } },
    { nodes: [{ nodeId: 'a', ports: [] }] },
    { nodes: [{ nodeId: 'a', ports: [{ portId: 'p', placement: { order: Number.NaN } }] }] },
  ])('rejects invalid settings or port placement %j', (overrides) => {
    expect(() =>
      parseNetworkPresentation({ nodes: [], links: [], subgraphs: [], ...overrides }),
    ).toThrow()
  })

  it.each(['1', '2'])('rejects old document version %s', (schemaVersion) => {
    const document = JSON.parse(JSON.stringify(separateNetworkGraph(graph)))
    document.schemaVersion = schemaVersion
    expect(() => combineNetworkDocument(document)).toThrow('Unsupported network document version')
  })
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
