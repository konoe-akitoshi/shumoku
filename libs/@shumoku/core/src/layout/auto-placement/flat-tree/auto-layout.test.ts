// Integration test for the new engine-driven entry.

import { describe, expect, test } from 'vitest'
import type { NetworkGraph, Node } from '../../../models/types.js'
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
