// Integration test for the new engine-driven entry.

import { describe, expect, test } from 'vitest'
import { sampleNetwork } from '../../../fixtures/index.js'
import type { NetworkGraph, Node } from '../../../models/types.js'
import { createMemoryFileResolver, HierarchicalParser } from '../../../parser/index.js'
import { createEngine } from '../../engine/index.js'
import { autoLayoutFlatTree } from './auto-layout.js'

function node(id: string, parent?: string): Node {
  return {
    id,
    label: id,
    shape: 'rect',
    ...(parent ? { parent } : {}),
  }
}

function link(from: string, to: string) {
  return {
    from: { node: from, port: `${from}-${to}` },
    to: { node: to, port: `${to}-${from}` },
  }
}

describe('autoLayoutFlatTree (engine-driven entry)', () => {
  test('minimal two-node graph', () => {
    const engine = createEngine()
    const graph: NetworkGraph = {
      version: '1',
      name: 'minimal',
      nodes: [node('a'), node('b')],
      links: [link('a', 'b')],
      subgraphs: [],
    }
    const result = autoLayoutFlatTree(graph, engine)
    expect(result.nodes.size).toBe(2)
    const a = result.nodes.get('a')
    const b = result.nodes.get('b')
    expect(a?.position).toBeDefined()
    expect(b?.position).toBeDefined()
    // TB direction: b sits below a.
    if (a?.position && b?.position) {
      expect(b.position.y).toBeGreaterThan(a.position.y)
    }
    // Engine sized each node — both must have a footprint.
    expect(a?.size?.width).toBeGreaterThan(0)
    expect(b?.size?.width).toBeGreaterThan(0)
  })

  test('engine + manual placement use the same rules', () => {
    const engine = createEngine()
    const a = node('a')
    // Sizing answer from engine is deterministic — same call
    // twice yields the same number.
    const sizeA = engine.nodeBodySize(a)
    expect(engine.nodeBodySize(a)).toEqual(sizeA)
    // Footprint with no port info falls back to body size for
    // both axes when no ports are present.
    const footprintA = engine.nodeFootprint(a)
    expect(footprintA.width).toBeGreaterThanOrEqual(sizeA.width)
    expect(footprintA.height).toBeGreaterThanOrEqual(sizeA.height)
  })

  test('fingerprint stays stable across calls with same config', () => {
    const engine1 = createEngine({ metrics: { fontEmSize: 14 } })
    const engine2 = createEngine({ metrics: { fontEmSize: 14 } })
    expect(engine1.fingerprint).toBe(engine2.fingerprint)
  })

  test('fingerprint differs when config differs', () => {
    const engine1 = createEngine({ metrics: { fontEmSize: 12 } })
    const engine2 = createEngine({ metrics: { fontEmSize: 16 } })
    expect(engine1.fingerprint).not.toBe(engine2.fingerprint)
  })

  test('tryPlace returns conflicts when overlapping', () => {
    const engine = createEngine()
    const a = node('a')
    const occupant = {
      id: 'a',
      position: { x: 0, y: 0 },
      footprint: { x: -40, y: -30, width: 80, height: 60 },
    }
    const placeOnTop = engine.tryPlace(a, { x: 0, y: 0 }, [occupant])
    expect(placeOnTop.valid).toBe(false)
    expect(placeOnTop.conflicts.length).toBe(1)
    expect(placeOnTop.conflicts[0]?.withNodeId).toBe('a')

    const placeAside = engine.tryPlace(a, { x: 1000, y: 1000 }, [occupant])
    expect(placeAside.valid).toBe(true)
    expect(placeAside.conflicts.length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// Contract invariants on the real sampleNetwork fixture.
// These tests guard the README invariants on a realistic graph
// (the synthetic 2-node tests above can't expose the
// multi-subgraph interactions that broke pre-rebalance).
// ─────────────────────────────────────────────────────────────

async function parseSample(): Promise<NetworkGraph> {
  const fileMap = new Map(sampleNetwork.map((f) => [f.name, f.content]))
  const main = fileMap.get('main.yaml')
  if (!main) throw new Error('sampleNetwork missing main.yaml')
  const resolver = createMemoryFileResolver(fileMap)
  const parser = new HierarchicalParser(resolver)
  const result = await parser.parse(main, 'main.yaml')
  return result.graph
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function nodeRect(n: Node): { x: number; y: number; width: number; height: number } | null {
  if (!n.position || !n.size) return null
  return {
    x: n.position.x - n.size.width / 2,
    y: n.position.y - n.size.height / 2,
    width: n.size.width,
    height: n.size.height,
  }
}

describe('autoLayoutFlatTree contract invariants (sampleNetwork)', () => {
  test('sibling subgraph hulls do not overlap', async () => {
    const graph = await parseSample()
    const result = autoLayoutFlatTree(graph, createEngine())
    const offenders: Array<[string, string]> = []
    const ids = [...result.subgraphs.keys()]
    for (let i = 0; i < ids.length; i++) {
      const aId = ids[i]
      if (!aId) continue
      const a = result.subgraphs.get(aId)
      if (!a?.bounds) continue
      for (let j = i + 1; j < ids.length; j++) {
        const bId = ids[j]
        if (!bId) continue
        const b = result.subgraphs.get(bId)
        if (!b?.bounds) continue
        // Skip ancestor/descendant pairs — containment is OK.
        if (a.parent === bId || b.parent === aId) continue
        if (rectsOverlap(a.bounds, b.bounds)) offenders.push([aId, bId])
      }
    }
    expect(offenders).toEqual([])
  })

  test('every positioned node sits inside its parent subgraph bounds', async () => {
    const graph = await parseSample()
    const result = autoLayoutFlatTree(graph, createEngine())
    const offenders: Array<{ node: string; parent: string }> = []
    for (const [id, node] of result.nodes) {
      if (!node.parent) continue
      const parent = result.subgraphs.get(node.parent)
      if (!parent?.bounds) continue
      const r = nodeRect(node)
      if (!r) continue
      const inside =
        r.x >= parent.bounds.x &&
        r.x + r.width <= parent.bounds.x + parent.bounds.width &&
        r.y >= parent.bounds.y &&
        r.y + r.height <= parent.bounds.y + parent.bounds.height
      if (!inside) offenders.push({ node: id, parent: node.parent })
    }
    expect(offenders).toEqual([])
  })

  test('no node spatially overlaps a subgraph it does not belong to', async () => {
    const graph = await parseSample()
    const result = autoLayoutFlatTree(graph, createEngine())
    const offenders: Array<{ node: string; subgraph: string }> = []
    for (const [nodeId, node] of result.nodes) {
      const r = nodeRect(node)
      if (!r) continue
      for (const [sgId, sg] of result.subgraphs) {
        if (!sg.bounds) continue
        // Skip the node's own ancestor chain.
        if (isAncestorSubgraph(sgId, node.parent, result.subgraphs)) continue
        if (rectsOverlap(r, sg.bounds)) offenders.push({ node: nodeId, subgraph: sgId })
      }
    }
    expect(offenders).toEqual([])
  })
})

function isAncestorSubgraph(
  candidate: string,
  startFrom: string | undefined,
  subgraphs: Map<string, { parent?: string }>,
): boolean {
  let cur = startFrom
  while (cur) {
    if (cur === candidate) return true
    cur = subgraphs.get(cur)?.parent
  }
  return false
}
