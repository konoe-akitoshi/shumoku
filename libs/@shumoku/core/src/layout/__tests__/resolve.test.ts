// Tests for ResolvedLayout conversion
// Ensures absolute coordinates are correctly computed and round-trip works.

import { describe, expect, it } from 'vitest'
import type { LayoutResult, Link, NetworkGraph, Node } from '../../models/types.js'
import { resolveLayout, unresolveLayout } from '../resolve.js'

function makeTestGraph(): NetworkGraph {
  const nodes: Node[] = [
    { id: 'sw1', label: 'Switch 1' },
    { id: 'sw2', label: 'Switch 2' },
  ]
  const links: Link[] = [
    {
      id: 'link1',
      from: { node: 'sw1', port: 'eth0' },
      to: { node: 'sw2', port: 'eth0' },
    },
  ]
  return { name: 'test', nodes, links }
}

function makeTestLayout(graph: NetworkGraph): LayoutResult {
  return {
    nodes: new Map([
      [
        'sw1',
        {
          id: 'sw1',
          position: { x: 200, y: 100 }, // center
          size: { width: 120, height: 80 },
          node: graph.nodes[0] ?? { id: 'sw1', label: 'Switch 1' },
          ports: new Map([
            [
              'sw1:eth0',
              {
                id: 'sw1:eth0',
                label: 'eth0',
                position: { x: 0, y: 40 }, // center-relative: bottom-center
                size: { width: 8, height: 8 },
                side: 'bottom' as const,
              },
            ],
          ]),
        },
      ],
      [
        'sw2',
        {
          id: 'sw2',
          position: { x: 200, y: 300 }, // center
          size: { width: 120, height: 80 },
          node: graph.nodes[1] ?? { id: 'sw2', label: 'Switch 2' },
          ports: new Map([
            [
              'sw2:eth0',
              {
                id: 'sw2:eth0',
                label: 'eth0',
                position: { x: 0, y: -40 }, // center-relative: top-center
                size: { width: 8, height: 8 },
                side: 'top' as const,
              },
            ],
          ]),
        },
      ],
    ]),
    links: new Map([
      [
        'link1',
        {
          id: 'link1',
          from: 'sw1',
          to: 'sw2',
          fromEndpoint: { node: 'sw1', port: 'eth0' },
          toEndpoint: { node: 'sw2', port: 'eth0' },
          points: [
            { x: 200, y: 140 },
            { x: 200, y: 260 },
          ],
          link: graph.links[0] ?? {
            from: { node: 'sw1', port: 'eth0' },
            to: { node: 'sw2', port: 'eth0' },
          },
        },
      ],
    ]),
    subgraphs: new Map(),
    bounds: { x: 0, y: 0, width: 400, height: 400 },
  }
}

describe('resolveLayout', () => {
  it('converts port positions from center-relative to absolute', () => {
    const graph = makeTestGraph()
    const layout = makeTestLayout(graph)
    const resolved = resolveLayout(layout)

    // sw1 port eth0: node center (200,100) + relative (0,40) = absolute (200,140)
    const port1 = resolved.ports.get('sw1:eth0')
    expect(port1).toBeDefined()
    if (!port1) return
    expect(port1.absolutePosition).toEqual({ x: 200, y: 140 })
    expect(port1.nodeId).toBe('sw1')
    expect(port1.side).toBe('bottom')

    // sw2 port eth0: node center (200,300) + relative (0,-40) = absolute (200,260)
    const port2 = resolved.ports.get('sw2:eth0')
    expect(port2).toBeDefined()
    if (!port2) return
    expect(port2.absolutePosition).toEqual({ x: 200, y: 260 })
    expect(port2.nodeId).toBe('sw2')
    expect(port2.side).toBe('top')
  })

  it('resolves edge port references', () => {
    const graph = makeTestGraph()
    const layout = makeTestLayout(graph)
    const resolved = resolveLayout(layout)

    const edge = resolved.edges.get('link1')
    expect(edge).toBeDefined()
    if (!edge) return
    expect(edge.fromPortId).toBe('sw1:eth0')
    expect(edge.toPortId).toBe('sw2:eth0')
    expect(edge.fromNodeId).toBe('sw1')
    expect(edge.toNodeId).toBe('sw2')
  })

  it('preserves node data', () => {
    const graph = makeTestGraph()
    const layout = makeTestLayout(graph)
    const resolved = resolveLayout(layout)

    expect(resolved.nodes.size).toBe(2)
    const sw1 = resolved.nodes.get('sw1')
    expect(sw1).toBeDefined()
    if (!sw1) return
    expect(sw1.node.label).toBe('Switch 1')
    expect(sw1.position).toEqual({ x: 200, y: 100 })
  })
})

describe('unresolveLayout', () => {
  it('round-trips: resolve then unresolve produces equivalent LayoutResult', () => {
    const graph = makeTestGraph()
    const original = makeTestLayout(graph)
    const resolved = resolveLayout(original)
    const restored = unresolveLayout(resolved)

    // Node positions
    for (const [id, node] of original.nodes) {
      const rNode = restored.nodes.get(id)
      expect(rNode).toBeDefined()
      if (!rNode) continue
      expect(rNode.position).toEqual(node.position)
      expect(rNode.size).toEqual(node.size)
    }

    // Port positions (center-relative)
    const origPort = original.nodes.get('sw1')?.ports?.get('sw1:eth0')
    const restoredPort = restored.nodes.get('sw1')?.ports?.get('sw1:eth0')
    expect(origPort).toBeDefined()
    expect(restoredPort).toBeDefined()
    if (!origPort || !restoredPort) return
    expect(restoredPort.position.x).toBeCloseTo(origPort.position.x, 5)
    expect(restoredPort.position.y).toBeCloseTo(origPort.position.y, 5)

    // Edge points
    expect(restored.links.get('link1')?.points).toEqual(original.links.get('link1')?.points)

    // Bounds
    expect(restored.bounds).toEqual(original.bounds)
  })
})

describe('port absolute position consistency', () => {
  it('port absolute position matches edge start/end points', () => {
    const graph = makeTestGraph()
    const layout = makeTestLayout(graph)
    const resolved = resolveLayout(layout)

    const edge = resolved.edges.get('link1')
    expect(edge).toBeDefined()
    if (!edge) return
    const fromPort = edge.fromPortId ? resolved.ports.get(edge.fromPortId) : undefined
    const toPort = edge.toPortId ? resolved.ports.get(edge.toPortId) : undefined
    expect(fromPort).toBeDefined()
    expect(toPort).toBeDefined()
    if (!fromPort || !toPort) return

    // Edge first point should be at/near from port
    const firstPoint = edge.points[0]
    expect(firstPoint).toBeDefined()
    if (!firstPoint) return
    expect(firstPoint.x).toBeCloseTo(fromPort.absolutePosition.x, 0)
    expect(firstPoint.y).toBeCloseTo(fromPort.absolutePosition.y, 0)

    // Edge last point should be at/near to port
    const lastPoint = edge.points[edge.points.length - 1]
    expect(lastPoint).toBeDefined()
    if (!lastPoint) return
    expect(lastPoint.x).toBeCloseTo(toPort.absolutePosition.x, 0)
    expect(lastPoint.y).toBeCloseTo(toPort.absolutePosition.y, 0)
  })
})
