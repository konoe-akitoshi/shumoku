// Regression coverage for the compound tree-layout path. The Sugiyama
// fallback used to fire as soon as *any* subgraph existed, and its
// barycenter ordering splits same-parent siblings — so adding a
// subgraph to a tree-shaped network would interleave APs from
// different switches. Buchheim handles compound containment now;
// these tests pin the contiguity invariant.

import { describe, expect, test } from 'vitest'
import type { Link, NetworkGraph, Node, Subgraph } from '../models/types.js'
import { layoutNetwork } from './network-layout.js'

function node(id: string, parent?: string): Node {
  return { id, label: id, ...(parent ? { parent } : {}) }
}
function subgraph(id: string, parent?: string): Subgraph {
  return { id, label: id, ...(parent ? { parent } : {}) }
}
function link(from: string, to: string): Link {
  // `port` is required on LinkEndpoint, but the layout's port-placement
  // pass only needs it as a string handle — the nodes themselves don't
  // need a matching NodePort declared for tree-layout coverage.
  return { from: { node: from, port: `${from}-p` }, to: { node: to, port: `${to}-p` } }
}

/**
 * Sort node ids by x coordinate at a given y row. The layout assigns
 * the same y per "tree depth", so peers of a switch share a row.
 */
function nodesAtRow(result: ReturnType<typeof layoutNetwork>, ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ax = result.nodes.get(a)?.position?.x ?? 0
    const bx = result.nodes.get(b)?.position?.x ?? 0
    return ax - bx
  })
}

describe('layoutNetwork — compound tree layout', () => {
  test('APs under each switch stay contiguous when a subgraph is present', () => {
    // Topology mirrors the user-reported case (PR follow-up):
    //   uplink → core (inside a subgraph) →
    //     swA, swB
    //   swA → apA1, apA2, apA3
    //   swB → apB1, apB2, apB3
    //
    // Without compound tree support, Sugiyama would interleave the AP
    // rows. With it, APs under each switch occupy a contiguous span.
    const graph: NetworkGraph = {
      nodes: [
        node('uplink'),
        node('core', 'group'), // lives inside the subgraph
        node('swA'),
        node('swB'),
        node('apA1'),
        node('apA2'),
        node('apA3'),
        node('apB1'),
        node('apB2'),
        node('apB3'),
      ],
      subgraphs: [subgraph('group')],
      links: [
        link('uplink', 'core'),
        link('core', 'swA'),
        link('core', 'swB'),
        link('swA', 'apA1'),
        link('swA', 'apA2'),
        link('swA', 'apA3'),
        link('swB', 'apB1'),
        link('swB', 'apB2'),
        link('swB', 'apB3'),
      ],
    }

    const result = layoutNetwork(graph)

    // Subgraph bounds were materialised — confirms the compound path
    // ran, not the flat fallback that ignores subgraphs.
    expect(result.subgraphs.get('group')?.bounds).toBeDefined()

    // All six APs sit on the same row; sorted by x, the swA group and
    // swB group must each occupy a contiguous run. If barycenter
    // ordering had been used, apA's and apB's would interleave.
    const apRow = nodesAtRow(result, ['apA1', 'apA2', 'apA3', 'apB1', 'apB2', 'apB3'])
    const groups = apRow.map((id) => id.replace(/[0-9]+$/, ''))
    // Run-length encode: should have exactly two runs, one per switch.
    const runs: string[] = []
    for (const g of groups) {
      if (runs[runs.length - 1] !== g) runs.push(g)
    }
    expect(runs.length).toBe(2)
    expect(new Set(runs)).toEqual(new Set(['apA', 'apB']))
  })

  test('switch with mixed downstream depths (switch + leaves) keeps leaves contiguous', () => {
    // Recreates the second symptom in the user's screenshot:
    // foyer-sw01 has both leaf APs and an intermediate switch (room1-sw01)
    // with its own APs. Sugiyama's barycenter pulls room1-sw01 toward
    // *its* AP centroid, splitting foyer's leaf APs around it.
    const graph: NetworkGraph = {
      nodes: [
        node('core', 'group'),
        node('foyer-sw01'),
        node('foyer-ap01'),
        node('foyer-ap02'),
        node('foyer-ap03'),
        node('foyer-ap04'),
        node('room1-sw01'),
        node('room1-ap01'),
        node('room1-ap02'),
      ],
      subgraphs: [subgraph('group')],
      links: [
        link('core', 'foyer-sw01'),
        link('foyer-sw01', 'foyer-ap01'),
        link('foyer-sw01', 'foyer-ap02'),
        link('foyer-sw01', 'foyer-ap03'),
        link('foyer-sw01', 'foyer-ap04'),
        link('foyer-sw01', 'room1-sw01'),
        link('room1-sw01', 'room1-ap01'),
        link('room1-sw01', 'room1-ap02'),
      ],
    }

    const result = layoutNetwork(graph)

    // foyer-sw01's direct children sit on the same row. Run-length
    // encode by "kind" (ap vs sw): we want a single contiguous block
    // of APs (no sw intruding), and a single sw block.
    const row = nodesAtRow(result, [
      'foyer-ap01',
      'foyer-ap02',
      'foyer-ap03',
      'foyer-ap04',
      'room1-sw01',
    ])
    const kinds = row.map((id) => (id.includes('-ap') ? 'ap' : 'sw'))
    const runs: string[] = []
    for (const k of kinds) {
      if (runs[runs.length - 1] !== k) runs.push(k)
    }
    expect(runs.length).toBe(2)
  })

  test('falls back to Sugiyama when the graph has a real multi-parent edge', () => {
    // Two paths into the same node = not a tree. Buchheim refuses
    // (overlay cap), Sugiyama takes over. We don't assert layout
    // positions here, only that the call succeeds and produces sane
    // output (positions for every node).
    const graph: NetworkGraph = {
      nodes: [node('a'), node('b'), node('c'), node('d', 'g'), node('e', 'g'), node('f')],
      subgraphs: [subgraph('g')],
      links: [
        link('a', 'b'),
        link('a', 'c'),
        link('b', 'd'),
        link('c', 'd'), // d has two parents → overlay
        link('b', 'e'),
        link('c', 'e'),
        link('d', 'f'),
        link('e', 'f'), // f has two parents → overlay
      ],
    }
    const result = layoutNetwork(graph)
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(result.nodes.get(id)?.position).toBeDefined()
    }
  })
})
