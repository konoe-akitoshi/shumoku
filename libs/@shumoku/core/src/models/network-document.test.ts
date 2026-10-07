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

describe('network document geometry separation', () => {
  it('allows position-only, size-only and combined geometry', () => {
    const presentation = {
      nodeGeometry: [
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
        schemaVersion: '1',
        topology: untyped,
        presentation: { nodeGeometry: [] },
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
        schemaVersion: '1',
        topology: untyped,
        presentation: { nodeGeometry: [] },
      }),
    ).toThrow('Node.rank is no longer supported')
  })
  it('persists facts and geometry separately and round-trips connections and physical data', () => {
    const before = structuredClone(graph)
    const document = separateNetworkGraph(graph)
    const saved = JSON.parse(JSON.stringify(document))
    expect(saved.topology.nodes[0]).not.toHaveProperty('position')
    expect(saved.topology.nodes[0]).not.toHaveProperty('size')
    expect(saved.presentation.nodeGeometry).toEqual([
      { nodeId: 'a', position: { x: -20, y: 40 }, size: { width: 200, height: 90 } },
    ])
    expect(combineNetworkDocument(saved)).toEqual(graph)
    expect(graph).toEqual(before)
  })

  it('keeps topology identical after a move, resize, and return to the original presentation', () => {
    const document = separateNetworkGraph(graph)
    const facts = structuredClone(document.topology)
    const moved = structuredClone(document)
    moved.presentation.nodeGeometry = [
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
    expect(document.presentation.nodeGeometry).toEqual([])
    expect(document.topology.nodes[0]).not.toHaveProperty('position')
  })

  it('diagnoses stale references, duplicate entries, and geometry left in topology', () => {
    const document = separateNetworkGraph(graph)
    expect(() =>
      combineNetworkDocument({
        ...document,
        presentation: { nodeGeometry: [{ nodeId: 'missing', position: { x: 1, y: 2 } }] },
      }),
    ).toThrow('Missing presentation node')
    expect(() =>
      combineNetworkDocument({
        ...document,
        presentation: {
          nodeGeometry: [
            ...document.presentation.nodeGeometry,
            ...document.presentation.nodeGeometry,
          ],
        },
      }),
    ).toThrow('Duplicate node geometry')
    const invalid = JSON.parse(JSON.stringify(document))
    invalid.topology.nodes[0].position = { x: 1, y: 2 }
    expect(() => combineNetworkDocument(invalid)).toThrow('Topology node contains diagram geometry')
  })

  it.each([
    { nodeId: 'a', position: { x: Number.NaN, y: 0 } },
    { nodeId: 'a', size: { width: 0, height: 1 } },
    { nodeId: 'a' },
    { nodeId: 'a', position: { x: 1, y: 2 }, rank: 0 },
  ])('rejects invalid or unsupported geometry: %j', (geometry) => {
    const document = JSON.parse(JSON.stringify(separateNetworkGraph(graph)))
    document.presentation.nodeGeometry = [geometry]
    expect(() => combineNetworkDocument(document)).toThrow()
  })
})
