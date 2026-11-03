// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'

/**
 * Where to measure up and down from in the parts of a network that nothing names a boundary
 * in. It is a fallback and a plain one: without it such a part has no up or down at all and is
 * drawn as one row.
 *
 * Each part that is joined by links (or by a guest's host) and holds none of `named` is given
 * the nodes the first of these tells apart, and nothing when the part is a single node:
 * - the kind of node, by how near the way out a network usually puts it (`LADDER`);
 * - the fastest link a node ends, the backbone being faster than the edge;
 * - the shape alone: the centre, the nodes from which the farthest node is nearest.
 *
 * A signal tells nodes apart only when some node of the part has it and some node does not
 * share its best value; then the next one is asked.
 */
export function upstreamOf(network: input.Network, named: readonly string[]): string[] {
  const graph = graphOf(network)
  const taken = new Set(named)
  const out: string[] = []
  for (const part of partsOf(graph)) {
    const nodes = part.filter((v) => graph.isNode.has(v))
    if (nodes.length < 2 || part.some((v) => taken.has(v))) continue
    out.push(
      ...(byLadder(network, nodes) ?? bySpeed(network, nodes) ?? centreOf(graph, part, nodes)),
    )
  }
  return out
}

/**
 * Node types by how near the way out of a network they usually stand, nearest first. What lies
 * beyond the network (internet, external, cloud) is named as a boundary before this is asked.
 */
const LADDER: readonly (readonly string[])[] = [
  ['router', 'firewall', 'vpn', 'cpe'],
  ['l3-switch', 'load-balancer'],
  ['l2-switch'],
  ['access-point'],
]

const rungOf = new Map(LADDER.flatMap((types, rung) => types.map((t) => [t, rung] as const)))

function byLadder(network: input.Network, nodes: readonly string[]): string[] | undefined {
  const type = new Map(network.nodes.map((n) => [n.id, n.type]))
  const rung = (id: string) => rungOf.get(type.get(id) ?? '') ?? LADDER.length
  return best(nodes, (id) => -rung(id), -LADDER.length)
}

/** A rate in bits per second; `10G` is ten thousand million. */
function bpsOf(rate: input.Rate | undefined): number {
  if (rate === undefined) return 0
  const scale = { M: 1e6, G: 1e9, T: 1e12 }[rate.slice(-1)] ?? 0
  return Number(rate.slice(0, -1)) * scale
}

function bySpeed(network: input.Network, nodes: readonly string[]): string[] | undefined {
  const fastest = new Map<string, number>()
  for (const link of network.links) {
    const bps = bpsOf(link.speed)
    for (const end of link.endpoints) {
      if ('node' in end) fastest.set(end.node, Math.max(fastest.get(end.node) ?? 0, bps))
    }
  }
  return best(nodes, (id) => fastest.get(id) ?? 0, 0)
}

/**
 * The nodes with the highest score, when some node scores above `none` and not every node
 * scores the same; else undefined, as the signal tells nothing apart.
 */
function best(
  nodes: readonly string[],
  score: (id: string) => number,
  none: number,
): string[] | undefined {
  const top = Math.max(...nodes.map(score))
  const chosen = nodes.filter((id) => score(id) === top)
  if (top <= none || chosen.length === nodes.length) return undefined
  return chosen
}

interface Graph {
  readonly next: ReadonlyMap<string, readonly string[]>
  readonly isNode: ReadonlySet<string>
}

/**
 * Nodes, segments and routing domains as one graph: a link joins its two ends, and a guest
 * joins its host (the first node of a redundancy set it names).
 */
function graphOf(network: input.Network): Graph {
  const next = new Map<string, string[]>()
  const join = (a: string, b: string) => {
    next.set(a, [...(next.get(a) ?? []), b])
    next.set(b, [...(next.get(b) ?? []), a])
  }
  const idOf = (end: input.Endpoint) =>
    'node' in end ? end.node : 'segment' in end ? end.segment : end.routingDomain
  for (const node of network.nodes) next.set(node.id, next.get(node.id) ?? [])
  for (const link of network.links) join(idOf(link.endpoints[0]), idOf(link.endpoints[1]))
  const firstOf = new Map((network.redundancy ?? []).map((r) => [r.id, r.nodes[0]]))
  for (const node of network.nodes) {
    const host = node.host === undefined ? undefined : (firstOf.get(node.host) ?? node.host)
    if (host !== undefined) join(node.id, host)
  }
  return { next, isNode: new Set(network.nodes.map((n) => n.id)) }
}

function distancesFrom(graph: Graph, start: string): Map<string, number> {
  const seen = new Map([[start, 0]])
  let frontier = [start]
  while (frontier.length > 0) {
    const reached: string[] = []
    for (const v of frontier) {
      for (const w of graph.next.get(v) ?? []) {
        if (seen.has(w)) continue
        seen.set(w, (seen.get(v) ?? 0) + 1)
        reached.push(w)
      }
    }
    frontier = reached
  }
  return seen
}

function partsOf(graph: Graph): string[][] {
  const placed = new Set<string>()
  const parts: string[][] = []
  for (const v of graph.next.keys()) {
    if (placed.has(v)) continue
    const part = [...distancesFrom(graph, v).keys()]
    for (const w of part) placed.add(w)
    parts.push(part)
  }
  return parts
}

/** The nodes from which the farthest node of the part is nearest. */
function centreOf(graph: Graph, part: readonly string[], nodes: readonly string[]): string[] {
  const reach = new Map(
    nodes.map((id) => {
      const d = distancesFrom(graph, id)
      return [id, Math.max(...part.map((v) => d.get(v) ?? 0))] as const
    }),
  )
  const nearest = Math.min(...reach.values())
  return nodes.filter((id) => reach.get(id) === nearest)
}
