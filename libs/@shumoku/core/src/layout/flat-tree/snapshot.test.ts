// Snapshot regression test. Locks the deterministic output of
// the flat-tree engine on a representative fixture so future
// refactors notice if the layout coordinates change.
//
// To update after intentional layout changes, run:
//   bun run test src/layout/flat-tree/snapshot.test.ts -u

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node, Subgraph } from '../../models/types.js'
import { layoutFlatTree } from './index.js'

/**
 * Mini network fixture exercising:
 *   - top-level standalone nodes (ONU)
 *   - 1-emitter subgraph (NOC chain: noc-rt → noc-sw → noc-ap)
 *   - multi-emitter subgraph (New Group: eps1 → eps2, both
 *     emit external children)
 *   - leaf subgraphs (HALL, LOBBY) with switch + APs
 *   - nested cross-subgraph link from eps1 → hall-sw, eps2 → lobby-sw
 *
 * Roughly matches the structure of the real editor fixture but
 * small enough to assert exact coordinates.
 */
function buildFixture(): {
  graph: NetworkGraph
  nodesById: Map<string, Node>
  subgraphsById: Map<string, Subgraph>
  sizeById: Map<string, { width: number; height: number }>
} {
  const node = (id: string, parent?: string): Node => ({
    id,
    label: id,
    ...(parent ? { parent } : {}),
    size: { width: 80, height: 60 },
  })
  const sg = (id: string): Subgraph => ({ id, label: id })
  const link = (from: string, to: string): Link => ({
    from: { node: from, port: 'p' },
    to: { node: to, port: 'p' },
  })

  const nodes = [
    node('onu'),
    node('noc-rt', 'NOC'),
    node('noc-sw', 'NOC'),
    node('noc-ap', 'NOC'),
    node('eps1', 'NewGroup'),
    node('eps2', 'NewGroup'),
    node('hall-sw', 'HALL'),
    node('hall-ap1', 'HALL'),
    node('hall-ap2', 'HALL'),
    node('lobby-sw', 'LOBBY'),
    node('lobby-ap', 'LOBBY'),
  ]
  const subgraphs = [sg('NOC'), sg('NewGroup'), sg('HALL'), sg('LOBBY')]
  const links = [
    link('onu', 'noc-rt'),
    link('noc-rt', 'noc-sw'),
    link('noc-sw', 'noc-ap'),
    link('noc-rt', 'eps1'),
    link('eps1', 'eps2'),
    link('eps1', 'hall-sw'),
    link('hall-sw', 'hall-ap1'),
    link('hall-sw', 'hall-ap2'),
    link('eps2', 'lobby-sw'),
    link('lobby-sw', 'lobby-ap'),
  ]
  return {
    graph: { name: 't', nodes, links, subgraphs },
    nodesById: new Map(nodes.map((n) => [n.id, n])),
    subgraphsById: new Map(subgraphs.map((s) => [s.id, s])),
    sizeById: new Map(nodes.map((n) => [n.id, n.size as { width: number; height: number }])),
  }
}

function roundPositions(
  map: Map<string, { x: number; y: number }>,
): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const [k, v] of [...map.entries()].sort()) {
    out[k] = [Math.round(v.x), Math.round(v.y)]
  }
  return out
}

function roundBounds(
  map: Map<string, { x: number; y: number; width: number; height: number }>,
): Record<string, [number, number, number, number]> {
  const out: Record<string, [number, number, number, number]> = {}
  for (const [k, v] of [...map.entries()].sort()) {
    out[k] = [Math.round(v.x), Math.round(v.y), Math.round(v.width), Math.round(v.height)]
  }
  return out
}

describe('flat-tree engine snapshot', () => {
  test('mini network layout is stable', () => {
    const env = buildFixture()
    const result = layoutFlatTree(
      env.graph,
      env.nodesById,
      env.subgraphsById,
      env.sizeById,
      () => false,
    )
    expect({
      nodes: roundPositions(result.nodePositions),
      subgraphs: roundBounds(result.subgraphBounds),
      root: {
        x: Math.round(result.rootBounds.x),
        y: Math.round(result.rootBounds.y),
        width: Math.round(result.rootBounds.width),
        height: Math.round(result.rootBounds.height),
      },
    }).toMatchInlineSnapshot(`
      {
        "nodes": {
          "eps1": [
            -106,
            682,
          ],
          "eps2": [
            106,
            682,
          ],
          "hall-ap1": [
            -160,
            991,
          ],
          "hall-ap2": [
            -51,
            991,
          ],
          "hall-sw": [
            -106,
            881,
          ],
          "lobby-ap": [
            106,
            991,
          ],
          "lobby-sw": [
            106,
            881,
          ],
          "noc-ap": [
            109,
            483,
          ],
          "noc-rt": [
            0,
            263,
          ],
          "noc-sw": [
            109,
            373,
          ],
          "onu": [
            0,
            64,
          ],
        },
        "root": {
          "height": 1007,
          "width": 389,
          "x": -220,
          "y": 34,
        },
        "subgraphs": {
          "HALL": [
            -220,
            803,
            229,
            238,
          ],
          "LOBBY": [
            46,
            803,
            120,
            238,
          ],
          "NOC": [
            -60,
            185,
            229,
            348,
          ],
          "NewGroup": [
            -166,
            604,
            332,
            128,
          ],
        },
      }
    `)
  })
})
