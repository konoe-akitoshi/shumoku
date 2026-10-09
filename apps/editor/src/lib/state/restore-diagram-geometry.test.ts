import { computeNetworkLayout, type NetworkGraph, separateNetworkGraph } from '@shumoku/core'
import { expect, test } from 'vitest'
import { restoreDiagramGeometry } from './restore-diagram-geometry'

test('keeps saved position and size while completing unspecified node geometry', async () => {
  const graph: NetworkGraph = {
    version: '1',
    nodes: [
      { id: 'a', label: 'A', position: { x: 900, y: 700 }, size: { width: 300, height: 120 } },
      { id: 'b', label: 'B', size: { width: 200, height: 100 } },
    ],
    links: [{ id: 'l', from: { node: 'a', port: 'eth0' }, to: { node: 'b', port: 'eth1' } }],
  }
  const before = structuredClone(graph)
  const { resolved } = await computeNetworkLayout(graph)
  const restored = restoreDiagramGeometry(graph, resolved)
  expect(restored.nodes.get('a')?.position).toEqual(graph.nodes[0]?.position)
  expect(restored.nodes.get('a')?.size).toEqual(graph.nodes[0]?.size)
  expect(restored.nodes.get('b')?.position).toEqual(resolved.nodes.get('b')?.position)
  expect(restored.nodes.get('b')?.size).toEqual(graph.nodes[1]?.size)
  expect(graph).toEqual(before)
  expect(separateNetworkGraph({ ...graph, nodes: [...restored.nodes.values()] }).topology).toEqual(
    separateNetworkGraph(graph).topology,
  )
})

test('expands nested derived group enclosures to contain restored nodes without moving them', async () => {
  const graph: NetworkGraph = {
    version: '1',
    nodes: [
      { id: 'a', label: 'A', parent: 'inner', position: { x: 900, y: 700 } },
      { id: 'b', label: 'B', parent: 'inner' },
    ],
    links: [],
    subgraphs: [
      { id: 'outer', label: 'Outer' },
      { id: 'inner', label: 'Inner', parent: 'outer' },
    ],
  }
  const { resolved } = await computeNetworkLayout(graph)
  const before = structuredClone(resolved)
  const restored = restoreDiagramGeometry(graph, resolved)
  expect(restored.nodes.get('a')?.position).toEqual({ x: 900, y: 700 })
  for (const id of ['inner', 'outer']) {
    const bounds = restored.subgraphs.get(id)?.bounds
    expect(bounds).toBeDefined()
    if (!bounds) throw new Error('Missing group bounds')
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(940)
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(730)
  }
  expect(resolved).toEqual(before)
})
