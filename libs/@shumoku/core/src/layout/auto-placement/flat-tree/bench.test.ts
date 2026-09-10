// Performance smoke test for the flat-tree engine.
// Run with `bun run test:performance`, outside the parallel workspace test tasks.
// Warm up initialization/JIT and use the median to tolerate occasional scheduling jitter.

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

  for (const r of Array.from({ length: rooms }, (_, index) => index)) {
    const sgId = `room-${r}`
    subgraphs.push({ id: sgId, label: sgId })
    const swId = `sw-${r}`
    push({ id: swId, label: swId, parent: sgId, size })
    links.push({ from: { node: 'core', port: 'p' }, to: { node: swId, port: 'p' } })
    for (const a of Array.from({ length: apsPerRoom }, (_, index) => index)) {
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

function measureMedian(rooms: number, apsPerRoom: number): number {
  // Use fresh graphs for every call, so mutated inputs cannot make later samples cheaper.
  for (const _ of [0, 1, 2]) timeLayout(rooms, apsPerRoom)
  const samples = Array.from({ length: 5 }, () => timeLayout(rooms, apsPerRoom).ms)
  const sorted = [...samples].sort((a, b) => a - b)
  const median = sorted[2]
  if (median === undefined) throw new Error('No layout timing samples')
  console.log(
    `${2 + rooms * (1 + apsPerRoom)} nodes: median ${median.toFixed(1)} ms; samples ${samples.map((ms) => ms.toFixed(1)).join(', ')} ms`,
  )
  return median
}

describe('flat-tree engine performance smoke', () => {
  test('58 nodes: warm median < 150ms', () => {
    expect(measureMedian(8, 6)).toBeLessThan(150)
  })

  test('202 nodes: warm median < 200ms', () => {
    expect(measureMedian(20, 9)).toBeLessThan(200)
  })

  test('1002 nodes: warm median < 2000ms', () => {
    expect(measureMedian(50, 19)).toBeLessThan(2000)
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
