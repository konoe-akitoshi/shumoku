// Tests for layout type composition/decomposition
// Ensures the new split interface (NodePlacementResult + EdgeRoutingResult)
// round-trips correctly with the existing LayoutResult type.

import { describe, it, expect } from 'vitest'
import type { LayoutResult, Link, Node, Subgraph } from '../../models/types.js'
import { composeLayoutResult, decomposeLayoutResult } from '../types.js'
import type { NetworkGraph } from '../../models/types.js'

function makeTestGraph(): NetworkGraph {
  const nodes: Node[] = [
    { id: 'a', label: 'Node A' },
    { id: 'b', label: 'Node B' },
  ]
  const links: Link[] = [
    { id: 'link1', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth0' } },
  ]
  const subgraphs: Subgraph[] = [
    { id: 'sg1', label: 'Zone 1', nodes: ['a'] },
  ]
  return { name: 'test', nodes, links, subgraphs }
}

function makeTestLayoutResult(graph: NetworkGraph): LayoutResult {
  return {
    nodes: new Map([
      [
        'a',
        {
          id: 'a',
          position: { x: 100, y: 50 },
          size: { width: 120, height: 80 },
          node: graph.nodes[0],
          ports: new Map([
            [
              'eth0',
              {
                id: 'eth0',
                label: 'eth0',
                position: { x: 60, y: 40 },
                size: { width: 8, height: 8 },
                side: 'bottom' as const,
              },
            ],
          ]),
        },
      ],
      [
        'b',
        {
          id: 'b',
          position: { x: 100, y: 250 },
          size: { width: 120, height: 80 },
          node: graph.nodes[1],
        },
      ],
    ]),
    links: new Map([
      [
        'link1',
        {
          id: 'link1',
          from: 'a',
          to: 'b',
          fromEndpoint: { node: 'a', port: 'eth0' },
          toEndpoint: { node: 'b', port: 'eth0' },
          points: [
            { x: 160, y: 90 },
            { x: 160, y: 170 },
            { x: 160, y: 250 },
          ],
          link: graph.links[0],
        },
      ],
    ]),
    subgraphs: new Map([
      [
        'sg1',
        {
          id: 'sg1',
          bounds: { x: 20, y: 20, width: 260, height: 150 },
          subgraph: graph.subgraphs![0],
        },
      ],
    ]),
    bounds: { x: 0, y: 0, width: 400, height: 400 },
    metadata: {
      algorithm: 'test',
      duration: 42,
    },
  }
}

describe('composeLayoutResult / decomposeLayoutResult', () => {
  it('decomposes a LayoutResult into placement + routing', () => {
    const graph = makeTestGraph()
    const layout = makeTestLayoutResult(graph)

    const { placement, routing } = decomposeLayoutResult(layout)

    // Placement
    expect(placement.nodes.size).toBe(2)
    expect(placement.nodes.get('a')?.position).toEqual({ x: 100, y: 50 })
    expect(placement.nodes.get('a')?.ports.size).toBe(1)
    expect(placement.nodes.get('b')?.ports.size).toBe(0) // no ports → empty map
    expect(placement.subgraphs.size).toBe(1)
    expect(placement.bounds).toEqual({ x: 0, y: 0, width: 400, height: 400 })

    // Routing
    expect(routing.edges.size).toBe(1)
    expect(routing.edges.get('link1')?.points).toHaveLength(3)
    expect(routing.edges.get('link1')?.from).toBe('a')
    expect(routing.edges.get('link1')?.to).toBe('b')
  })

  it('round-trips: decompose then compose produces equivalent LayoutResult', () => {
    const graph = makeTestGraph()
    const original = makeTestLayoutResult(graph)

    const { placement, routing } = decomposeLayoutResult(original)
    const recomposed = composeLayoutResult(graph, placement, routing, original.metadata)

    // Nodes
    expect(recomposed.nodes.size).toBe(original.nodes.size)
    for (const [id, node] of original.nodes) {
      const reNode = recomposed.nodes.get(id)
      expect(reNode).toBeDefined()
      expect(reNode?.position).toEqual(node.position)
      expect(reNode?.size).toEqual(node.size)
      expect(reNode?.node).toBe(node.node)
    }

    // Links
    expect(recomposed.links.size).toBe(original.links.size)
    for (const [id, link] of original.links) {
      const reLink = recomposed.links.get(id)
      expect(reLink).toBeDefined()
      expect(reLink?.points).toEqual(link.points)
      expect(reLink?.from).toBe(link.from)
      expect(reLink?.to).toBe(link.to)
    }

    // Subgraphs
    expect(recomposed.subgraphs.size).toBe(original.subgraphs.size)

    // Bounds & metadata
    expect(recomposed.bounds).toEqual(original.bounds)
    expect(recomposed.metadata).toEqual(original.metadata)
  })
})
