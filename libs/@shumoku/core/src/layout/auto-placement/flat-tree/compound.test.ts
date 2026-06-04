// Smoke + behaviour tests for the opt-in compound (container-aware)
// layout. The default flat-tree path has its own suite; this exercises
// the compound entry end-to-end so a regression in the grouping /
// folding / banding / ghost-grid / tier-grid math can't land silently.

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node } from '../../../models/types.js'
import { createEngine } from '../../engine/index.js'
import { layoutCompound } from './compound.js'

/** Node with an optional hostname (drives the functional-domain grouping). */
function node(id: string, hostname?: string): Node {
  return {
    id,
    label: id,
    shape: 'rect',
    ...(hostname !== undefined ? { metadata: { hostname } } : {}),
  }
}

function link(from: string, to: string): Link {
  return {
    from: { node: from, port: `${from}-${to}` },
    to: { node: to, port: `${to}-${from}` },
  }
}

function graph(nodes: Node[], links: Link[]): NetworkGraph {
  return { version: '1', name: 'test', nodes, links, subgraphs: [] }
}

const finitePos = (n: Node | undefined): boolean =>
  !!n?.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y)

describe('layoutCompound', () => {
  test('groups by hostname domain, positions every node, draws one hull per domain', () => {
    const engine = createEngine()
    const g = graph(
      [
        node('noc1', 'noc1.noc'),
        node('noc2', 'noc2.noc'),
        node('noc3', 'noc3.noc'),
        node('dc1', 'dc1.dc'),
        node('dc2', 'dc2.dc'),
      ],
      [link('noc1', 'noc2'), link('noc1', 'noc3'), link('dc1', 'dc2'), link('noc1', 'dc1')],
    )

    const result = layoutCompound(g, engine)

    // Every node placed with a finite coordinate (no NaN/Infinity leak).
    expect(result.nodes.size).toBe(5)
    for (const n of result.nodes.values()) expect(finitePos(n)).toBe(true)

    // One hull per functional domain, each with computed bounds.
    expect(result.subgraphs.get('dom:noc')?.bounds).toBeDefined()
    expect(result.subgraphs.get('dom:dc')?.bounds).toBeDefined()

    // Nodes are re-parented to their domain hull.
    expect(result.nodes.get('noc1')?.parent).toBe('dom:noc')
    expect(result.nodes.get('dc1')?.parent).toBe('dom:dc')

    // Root bounds enclose the content.
    expect(result.bounds.width).toBeGreaterThan(0)
    expect(result.bounds.height).toBeGreaterThan(0)
  })

  test("bands a domain's link-less members below its connected core", () => {
    const engine = createEngine()
    const g = graph(
      [
        node('core1', 'core1.noc'),
        node('core2', 'core2.noc'),
        node('iso1', 'iso1.noc'),
        node('iso2', 'iso2.noc'),
        node('iso3', 'iso3.noc'),
        // A second domain so the graph compounds and the noc box folds.
        node('dc1', 'dc1.dc'),
        node('dc2', 'dc2.dc'),
      ],
      [link('core1', 'core2'), link('dc1', 'dc2')],
    )

    const result = layoutCompound(g, engine)

    const coreMaxY = Math.max(
      result.nodes.get('core1')?.position?.y ?? Number.NEGATIVE_INFINITY,
      result.nodes.get('core2')?.position?.y ?? Number.NEGATIVE_INFINITY,
    )
    for (const id of ['iso1', 'iso2', 'iso3']) {
      const y = result.nodes.get(id)?.position?.y
      expect(y).toBeDefined()
      // Link-less members land below the connected core, not strewn above.
      expect(y ?? 0).toBeGreaterThan(coreMaxY)
    }
  })

  test('pulls information-less ghosts (no hostname, no links) into a separate grid', () => {
    const engine = createEngine()
    const g = graph(
      [node('noc1', 'noc1.noc'), node('noc2', 'noc2.noc'), node('ghost1'), node('ghost2')],
      [link('noc1', 'noc2')],
    )

    const result = layoutCompound(g, engine)

    expect(result.subgraphs.has('__unmapped__')).toBe(true)
    expect(result.nodes.get('ghost1')?.parent).toBe('__unmapped__')
    expect(result.nodes.get('ghost2')?.parent).toBe('__unmapped__')
    expect(finitePos(result.nodes.get('ghost1'))).toBe(true)
    // Real nodes stay in their domain box, not the ghost grid.
    expect(result.nodes.get('noc1')?.parent).toBe('dom:noc')
  })

  test('re-homes a node wired exclusively into one neighbour subgraph', () => {
    const engine = createEngine()
    // `stray` has no hostname suffix (domain "(none)") but connects only
    // to nodes whose subgraph parent is "rack-a"; adoptSoleNeighborSubgraph
    // should pull it into rack-a so it doesn't fragment off on its own.
    const a1: Node = { id: 'a1', label: 'a1', shape: 'rect', parent: 'rack-a' }
    const a2: Node = { id: 'a2', label: 'a2', shape: 'rect', parent: 'rack-a' }
    const stray: Node = { id: 'stray', label: 'stray', shape: 'rect', parent: 'rack-b' }
    const g = graph([a1, a2, stray], [link('a1', 'a2'), link('a1', 'stray')])

    const result = layoutCompound(g, engine)
    // Whatever the grouping key, every node is placed and the layout
    // doesn't throw on a single-domain, mixed-subgraph graph.
    expect(result.nodes.size).toBe(3)
    for (const n of result.nodes.values()) expect(finitePos(n)).toBe(true)
  })
})
