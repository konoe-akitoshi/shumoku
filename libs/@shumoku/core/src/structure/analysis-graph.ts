// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { compare, endKey, orderEnds, sorted } from './keys.js'
import type { AnalysisEdge, AnalysisGraph, AnalysisVertex, End } from './types.js'

export const nodeRef = (id: string) => `node:${id}`
export const segmentRef = (id: string) => `segment:${id}`
export const routingDomainRef = (id: string) => `routingDomain:${id}`

function endOf(e: input.Endpoint): End {
  if ('node' in e) return e.port === undefined ? { node: e.node } : { node: e.node, port: e.port }
  if ('segment' in e) return { segment: e.segment }
  return { routingDomain: e.routingDomain }
}

/**
 * Stage 1. The vertices are the nodes, and the segments and routing domains a line ends at
 * directly; a routing domain stands for a network whose inside is not written. The lines are
 * the written links, virtual or not, and a node's membership of a segment that is a vertex (by
 * an address or by a link carrying the segment) when no line already joins them. A virtual
 * link between two nodes that carries such a segment, like a BGP session across an exchange's
 * LAN, runs over that segment: it puts both ends in the segment instead of joining them
 * directly.
 */
export function analysisGraph(network: input.Network): AnalysisGraph {
  const lines = new Map<
    string,
    {
      kind: 'link' | 'member'
      virtual: boolean
      ends: readonly [End, End]
      n: number
      carries: Set<string>
    }
  >()
  const add = (
    kind: 'link' | 'member',
    virtual: boolean,
    a: End,
    b: End,
    carries: readonly string[],
  ) => {
    const ends = orderEnds(a, b)
    const key = `${kind}\0${virtual}\0${endKey(ends[0])}\0${endKey(ends[1])}`
    const line = lines.get(key) ?? { kind, virtual, ends, n: 0, carries: new Set<string>() }
    line.n++
    for (const c of carries) line.carries.add(c)
    lines.set(key, line)
  }

  const ended = network.links.map((link) => ({
    link,
    a: endOf(link.endpoints[0]),
    b: endOf(link.endpoints[1]),
  }))
  const segmentVertices = new Set<string>()
  const domainVertices = new Set<string>()
  for (const { a, b } of ended) {
    for (const e of [a, b]) {
      if ('segment' in e) segmentVertices.add(e.segment)
      if ('routingDomain' in e) domainVertices.add(e.routingDomain)
    }
  }

  const carried = new Map<string, Set<string>>()
  const joined = new Set<string>()
  for (const { link, a, b } of ended) {
    const virtual = link.virtual === true
    const over =
      virtual && 'node' in a && 'node' in b
        ? (link.segments ?? []).some((s) => segmentVertices.has(s))
        : false
    if (!over) add('link', virtual, a, b, link.segments ?? [])
    for (const [self, other] of [
      [a, b],
      [b, a],
    ] as const) {
      if ('segment' in self && 'node' in other) joined.add(`${other.node}\0${self.segment}`)
    }
    for (const s of link.segments ?? []) {
      for (const e of [a, b]) {
        if (!('node' in e)) continue
        const nodes = carried.get(s) ?? new Set<string>()
        nodes.add(e.node)
        carried.set(s, nodes)
      }
    }
  }

  // A redundancy set's shared address puts each of its nodes in the segment.
  const setMembers = new Map(network.redundancy?.map((r) => [r.id, r.nodes]) ?? [])
  const nodeIds = new Set(network.nodes.map((n) => n.id))
  for (const segment of network.segments ?? []) {
    if (!segmentVertices.has(segment.id)) continue
    const members = new Set(carried.get(segment.id))
    for (const holder of Object.keys(segment.addresses ?? {})) {
      if (nodeIds.has(holder)) members.add(holder)
      else for (const n of setMembers.get(holder) ?? []) members.add(n)
    }
    for (const node of members) {
      if (joined.has(`${node}\0${segment.id}`)) continue
      add('member', false, { node }, { segment: segment.id }, [])
    }
  }

  const vertices: AnalysisVertex[] = []
  for (const n of network.nodes) {
    vertices.push({
      ref: nodeRef(n.id),
      kind: 'node',
      id: n.id,
      ...(n.group === undefined ? {} : { group: n.group }),
    })
  }
  for (const s of network.segments ?? []) {
    if (!segmentVertices.has(s.id)) continue
    vertices.push({
      ref: segmentRef(s.id),
      kind: 'segment',
      id: s.id,
      ...(s.group === undefined ? {} : { group: s.group }),
    })
  }
  for (const id of domainVertices) {
    vertices.push({ ref: routingDomainRef(id), kind: 'routingDomain', id })
  }
  vertices.sort((a, b) => compare(a.ref, b.ref))

  const edges: AnalysisEdge[] = [...lines.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, l]) => ({
      kind: l.kind,
      virtual: l.virtual,
      ends: l.ends,
      multiplicity: l.n,
      carries: sorted(l.carries),
    }))
  return { vertices, edges }
}
