// Performance smoke test for the flat-tree engine.
// Verifies the layout scales (roughly) linearly with node count.

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node, Subgraph } from '../../../models/types.js'
import { layoutFlatTree } from './index.js'

/**
 * Generate a synthetic "campus" graph:
 *   - 1 root (Internet)
 *   - 1 core router
 *   - N access switches in N rooms (subgraphs), each with K APs
 *   total nodes = 2 + N + N*K = 2 + N(1+K)
 */
function buildCampus(
  rooms: number,
  apsPerRoom: number,
): {
  graph: NetworkGraph
  nodesById: Map<string, Node>
  subgraphsById: Map<string, Subgraph>
  sizeById: Map<string, { width: number; height: number }>
} {
  const nodes: Node[] = []
  const subgraphs: Subgraph[] = []
  const links: Link[] = []
  const size = { width: 80, height: 60 }

  const push = (n: Node) => nodes.push(n)
  push({ id: 'internet', label: 'Internet', size })
  push({ id: 'core', label: 'Core', size })
  links.push({ from: { node: 'internet', port: 'p' }, to: { node: 'core', port: 'p' } })

  for (let r = 0; r < rooms; r++) {
    const sgId = `room-${r}`
    subgraphs.push({ id: sgId, label: sgId })
    const swId = `sw-${r}`
    push({ id: swId, label: swId, parent: sgId, size })
    links.push({ from: { node: 'core', port: 'p' }, to: { node: swId, port: 'p' } })
    for (let a = 0; a < apsPerRoom; a++) {
      const apId = `ap-${r}-${a}`
      push({ id: apId, label: apId, parent: sgId, size })
      links.push({ from: { node: swId, port: 'p' }, to: { node: apId, port: 'p' } })
    }
  }

  return {
    graph: { name: 't', nodes, links, subgraphs },
    nodesById: new Map(nodes.map((n) => [n.id, n])),
    subgraphsById: new Map(subgraphs.map((s) => [s.id, s])),
    sizeById: new Map(nodes.map((n) => [n.id, size])),
  }
}

function timeLayout(rooms: number, apsPerRoom: number): { nodes: number; ms: number } {
  const env = buildCampus(rooms, apsPerRoom)
  const nodes = env.graph.nodes.length
  const start = performance.now()
  const result = layoutFlatTree(
    env.graph,
    env.nodesById,
    env.subgraphsById,
    env.sizeById,
    () => false,
  )
  const ms = performance.now() - start
  // Sanity: layout produced positions for every node.
  if (result.nodePositions.size !== nodes) {
    throw new Error(`expected ${nodes} positions, got ${result.nodePositions.size}`)
  }
  return { nodes, ms }
}

describe('flat-tree engine performance smoke', () => {
  test('50 nodes < 150ms', () => {
    // ~50 nodes: 8 rooms × 6 APs + 8 switches + 2 = 58
    const { nodes, ms } = timeLayout(8, 6)
    // Useful information when this regresses. The bound is
    // intentionally loose — CI runners share CPU and a few
    // ms of jitter are normal. The 200- and 1000-node tests
    // catch real algorithmic regressions.
    console.log(`50-node fixture: ${nodes} nodes in ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(150)
  })

  test('200 nodes < 200ms', () => {
    // ~200 nodes: 20 rooms × 9 APs + 20 switches + 2 = 202
    const { nodes, ms } = timeLayout(20, 9)
    console.log(`200-node fixture: ${nodes} nodes in ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(200)
  })

  test('1000 nodes < 2000ms', () => {
    // ~1000 nodes: 50 rooms × 19 APs + 50 switches + 2 = 1002
    const { nodes, ms } = timeLayout(50, 19)
    console.log(`1000-node fixture: ${nodes} nodes in ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(2000)
  })

  test('determinism: repeated calls produce identical positions', () => {
    const env1 = buildCampus(5, 4)
    const env2 = buildCampus(5, 4)
    const r1 = layoutFlatTree(
      env1.graph,
      env1.nodesById,
      env1.subgraphsById,
      env1.sizeById,
      () => false,
    )
    const r2 = layoutFlatTree(
      env2.graph,
      env2.nodesById,
      env2.subgraphsById,
      env2.sizeById,
      () => false,
    )
    for (const [id, pos] of r1.nodePositions) {
      const other = r2.nodePositions.get(id)
      expect(other).toEqual(pos)
    }
  })
})
