// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout quality corpus.
 *
 * Compact set of representative `NetworkGraph` fixtures. The
 * harness runs the engine over each, collects quality metrics,
 * and reports a per-fixture row + an aggregate summary. Adding
 * a new shape is one entry in {@link CORPUS} — no other
 * plumbing.
 *
 * Each fixture targets a different stress on the engine:
 *
 *   minimal           — two-node chain, smoke test
 *   linear-chain      — five-node single line, edge-length sanity
 *   star              — one hub + four leaves, sibling fan-out
 *   wide-tree         — three layers, ~15 nodes, multi-row spread
 *   deep-chain        — ten-node line, vertical extent
 *   multi-component   — two disconnected stars, component packing
 *   ha-pair           — switch + ha-redundancy peer, overlay edge
 *   single-subgraph   — one subgraph wrapping a chain (single
 *                       emitter, no spine alignment needed)
 *   multi-emitter-sg  — subgraph with two emitters → splits into
 *                       two blocks + spine alignment
 *   nested-subgraph   — outer hull contains inner hull
 *   noc-like          — NOC pattern: stacked emitter chain in a
 *                       subgraph, each emitter dropping to a
 *                       distinct downstream subgraph
 */

import type { Link, NetworkGraph, Node, Subgraph } from '../../models/types.js'

function n(id: string, parent?: string): Node {
  return {
    id,
    label: id,
    shape: 'rect',
    ...(parent ? { parent } : {}),
    size: { width: 80, height: 60 },
  }
}

function graph(
  name: string,
  nodes: Node[],
  links: Link[],
  subgraphs: Subgraph[] = [],
): NetworkGraph {
  return { version: '1', name, nodes, links, subgraphs }
}

function sg(id: string, parent?: string): Subgraph {
  return { id, label: id, ...(parent ? { parent } : {}) }
}

function l(from: string, to: string, opts: Partial<Link> = {}): Link {
  return {
    from: { node: from, port: `${from}-${to}` },
    to: { node: to, port: `${to}-${from}` },
    ...opts,
  }
}

/**
 * Link with a fixed port name on both sides — used to build
 * port-label-collision fixtures so the sibling-sort fallback
 * fires and the harness's `pl_fb` column shows non-zero.
 */
function lp(from: string, to: string, port: string): Link {
  return {
    from: { node: from, port },
    to: { node: to, port },
  }
}

export interface CorpusFixture {
  name: string
  description: string
  graph: NetworkGraph
}

export const CORPUS: readonly CorpusFixture[] = [
  {
    name: 'minimal',
    description: 'two-node chain',
    graph: graph('minimal', [n('a'), n('b')], [l('a', 'b')]),
  },
  {
    name: 'linear-chain',
    description: 'five-node single line',
    graph: graph(
      'linear-chain',
      ['a', 'b', 'c', 'd', 'e'].map((id) => n(id)),
      [l('a', 'b'), l('b', 'c'), l('c', 'd'), l('d', 'e')],
    ),
  },
  {
    name: 'star',
    description: 'one hub plus four leaves',
    graph: graph(
      'star',
      ['hub', 'l1', 'l2', 'l3', 'l4'].map((id) => n(id)),
      [l('hub', 'l1'), l('hub', 'l2'), l('hub', 'l3'), l('hub', 'l4')],
    ),
  },
  {
    name: 'wide-tree',
    description: 'three-layer tree, ~15 nodes',
    graph: (() => {
      const nodes: Node[] = [n('root')]
      const links: Link[] = []
      for (let i = 0; i < 3; i++) {
        const mid = `m${i}`
        nodes.push(n(mid))
        links.push(l('root', mid))
        for (let j = 0; j < 4; j++) {
          const leaf = `l${i}_${j}`
          nodes.push(n(leaf))
          links.push(l(mid, leaf))
        }
      }
      return graph('wide-tree', nodes, links)
    })(),
  },
  {
    name: 'deep-chain',
    description: 'ten-node line, vertical extent',
    graph: (() => {
      const ids = Array.from({ length: 10 }, (_, i) => `n${i}`)
      const links: Link[] = []
      for (let i = 0; i < ids.length - 1; i++) {
        const from = ids[i]
        const to = ids[i + 1]
        if (from && to) links.push(l(from, to))
      }
      return graph(
        'deep-chain',
        ids.map((id) => n(id)),
        links,
      )
    })(),
  },
  {
    name: 'multi-component',
    description: 'two disconnected stars',
    graph: graph(
      'multi-component',
      ['h1', 'h1a', 'h1b', 'h2', 'h2a', 'h2b'].map((id) => n(id)),
      [l('h1', 'h1a'), l('h1', 'h1b'), l('h2', 'h2a'), l('h2', 'h2b')],
    ),
  },
  {
    name: 'ha-pair',
    description: 'two switches with one HA-redundancy link',
    graph: graph(
      'ha-pair',
      ['sw1', 'sw2', 'host1', 'host2'].map((id) => n(id)),
      [l('sw1', 'host1'), l('sw2', 'host2'), l('sw1', 'sw2', { redundancy: 'ha' })],
    ),
  },
  {
    name: 'single-subgraph',
    description: 'one subgraph wrapping a three-node chain',
    graph: graph(
      'single-subgraph',
      [n('a', 'g'), n('b', 'g'), n('c', 'g')],
      [l('a', 'b'), l('b', 'c')],
      [sg('g')],
    ),
  },
  {
    name: 'multi-emitter-sg',
    description: 'subgraph with two internal members, each emitting to an external child',
    graph: graph(
      'multi-emitter-sg',
      [n('e1', 'g'), n('e2', 'g'), n('extA'), n('extB')],
      [l('e1', 'e2'), l('e1', 'extA'), l('e2', 'extB')],
      [sg('g')],
    ),
  },
  {
    name: 'nested-subgraph',
    description: 'inner subgraph nested inside outer; one node in inner',
    graph: graph(
      'nested-subgraph',
      [n('a', 'inner'), n('b'), n('c')],
      [l('b', 'a'), l('a', 'c')],
      [sg('outer'), sg('inner', 'outer')],
    ),
  },
  {
    name: 'no-port-labels',
    description:
      'star with every link using the same port name → sibling sort hits port-label fallback',
    graph: graph(
      'no-port-labels',
      ['hub', 'a', 'b', 'c'].map((id) => n(id)),
      [lp('hub', 'a', 'p'), lp('hub', 'b', 'p'), lp('hub', 'c', 'p')],
    ),
  },
  {
    name: 'noc-like',
    description:
      'NOC pattern: stacked emitter chain in a subgraph, each emitter drops to a downstream subgraph',
    graph: graph(
      'noc-like',
      [
        n('eps-sw01', 'NOC'),
        n('eps-sw02', 'NOC'),
        n('lobby-sw', 'LOBBY'),
        n('lobby-ap', 'LOBBY'),
        n('hall-sw', 'HALL'),
      ],
      [
        l('eps-sw01', 'eps-sw02'),
        l('eps-sw01', 'hall-sw'),
        l('eps-sw02', 'lobby-sw'),
        l('lobby-sw', 'lobby-ap'),
      ],
      [sg('NOC'), sg('LOBBY'), sg('HALL')],
    ),
  },
] as const

/** Look up one fixture by name. Throws if not found. */
export function fixture(name: string): CorpusFixture {
  const f = CORPUS.find((c) => c.name === name)
  if (!f) throw new Error(`No corpus fixture: ${name}`)
  return f
}
