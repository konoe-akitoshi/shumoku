// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { compare, endKey, orderEnds, sorted } from './keys.js'
import type { AnalysisEdge, AnalysisGraph, AnalysisVertex, End } from './types.js'

export const nodeRef = (id: string) => `node:${id}`
export const segmentRef = (id: string) => `segment:${id}`

const isNodeEnd = (e: input.Endpoint): e is input.NodeEnd => 'node' in e
const isSegmentEnd = (e: input.Endpoint): e is input.SegmentEnd => 'segment' in e

function endOf(e: input.Endpoint): End | undefined {
  if (isNodeEnd(e)) return e.port === undefined ? { node: e.node } : { node: e.node, port: e.port }
  if (isSegmentEnd(e)) return { segment: e.segment }
  return undefined
}

/**
 * Stage 1. The vertices are the nodes and the segments a line ends at directly. The lines are
 * the written links that are not virtual and do not end at a routing domain, and a node's
 * membership of a segment that is a vertex (by an address or by a link carrying the segment)
 * when no line already joins them.
 */
export function analysisGraph(network: input.Network): AnalysisGraph {
  const lines = new Map<
    string,
    { kind: 'link' | 'member'; ends: readonly [End, End]; n: number; carries: Set<string> }
  >()
  const add = (kind: 'link' | 'member', a: End, b: End, carries: readonly string[]) => {
    const ends = orderEnds(a, b)
    const key = `${kind}\0${endKey(ends[0])}\0${endKey(ends[1])}`
    const line = lines.get(key) ?? { kind, ends, n: 0, carries: new Set<string>() }
    line.n++
    for (const c of carries) line.carries.add(c)
    lines.set(key, line)
  }

  const segmentVertices = new Set<string>()
  const carried = new Map<string, Set<string>>()
  const joined = new Set<string>()
  for (const link of network.links) {
    if (link.virtual) continue
    const [x, y] = link.endpoints
    const a = endOf(x)
    const b = endOf(y)
    if (!a || !b) continue
    add('link', a, b, link.segments ?? [])
    for (const [self, other] of [
      [a, b],
      [b, a],
    ] as const) {
      if (!('segment' in self)) continue
      segmentVertices.add(self.segment)
      if ('node' in other) joined.add(`${other.node}\0${self.segment}`)
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
      add('member', { node }, { segment: segment.id }, [])
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
  vertices.sort((a, b) => compare(a.ref, b.ref))

  const edges: AnalysisEdge[] = [...lines.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, l]) => ({
      kind: l.kind,
      ends: l.ends,
      multiplicity: l.n,
      carries: sorted(l.carries),
    }))
  return { vertices, edges }
}
