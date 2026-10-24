// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { routingDomainRef, segmentRef } from './analysis-graph.js'
import { compare, sorted } from './keys.js'
import type {
  AnalysisEdge,
  AnalysisGraph,
  End,
  PlaneGraph,
  UnitEdge,
  Units,
  VertexRef,
} from './stage-types.js'
import { unitRef } from './units.js'

export const DEFAULT_PLANE = 'default'

/**
 * The planes a line belongs to. A line that ends at a routing domain, ends at a segment written
 * in a routing domain, or carries such a segment is in that routing domain's plane (in each one,
 * when it names several); any other line is in the default plane.
 */
export function planesOfLine(
  edge: AnalysisEdge,
  domainOfSegment: ReadonlyMap<string, string>,
): string[] {
  const planes = new Set<string>()
  for (const end of edge.ends) {
    if ('routingDomain' in end) planes.add(end.routingDomain)
    else if ('segment' in end) {
      const domain = domainOfSegment.get(end.segment)
      if (domain !== undefined) planes.add(domain)
    }
  }
  for (const s of edge.carries) {
    const domain = domainOfSegment.get(s)
    if (domain !== undefined) planes.add(domain)
  }
  return planes.size === 0 ? [DEFAULT_PLANE] : sorted(planes)
}

/** The graph of the units, segments and routing domains joined by some of the lines. */
export function unitGraph(
  lines: readonly AnalysisEdge[],
  units: Units,
): { vertices: VertexRef[]; edges: UnitEdge[] } {
  const unitOfNode = new Map<string, string>()
  for (const u of units.units) for (const m of u.members) unitOfNode.set(m, u.id)
  const refOf = (end: End): VertexRef | undefined => {
    if ('segment' in end) return segmentRef(end.segment)
    if ('routingDomain' in end) return routingDomainRef(end.routingDomain)
    const unit = unitOfNode.get(end.node)
    return unit === undefined ? undefined : unitRef(unit)
  }

  const pairs = new Map<string, { a: VertexRef; b: VertexRef; lines: AnalysisEdge[] }>()
  for (const edge of lines) {
    const x = refOf(edge.ends[0])
    const y = refOf(edge.ends[1])
    if (x === undefined || y === undefined || x === y) continue
    const [a, b] = compare(x, y) <= 0 ? [x, y] : [y, x]
    const key = `${a}\0${b}`
    const pair = pairs.get(key) ?? { a, b, lines: [] }
    pair.lines.push(edge)
    pairs.set(key, pair)
  }
  const edges = [...pairs.entries()]
    .sort(([x], [y]) => compare(x, y))
    .map(([, p]) => ({
      a: p.a,
      b: p.b,
      multiplicity: p.lines.reduce((n, l) => n + l.multiplicity, 0),
      lines: p.lines,
    }))
  const vertices = sorted(new Set(edges.flatMap((e) => [e.a, e.b])))
  return { vertices, edges }
}

/**
 * Stage 3. Each line goes to the plane it belongs to, and each plane gets its own graph. A unit
 * with no line in a plane is not in it. A unit with no line at all stays in the default plane
 * as a vertex of its own, so that it is not lost.
 */
export function derivePlanes(
  network: input.Network,
  analysis: AnalysisGraph,
  units: Units,
): PlaneGraph[] {
  const domainOfSegment = new Map<string, string>()
  for (const s of network.segments ?? []) {
    if (s.routingDomain !== undefined) domainOfSegment.set(s.id, s.routingDomain)
  }
  const byPlane = new Map<string, AnalysisEdge[]>()
  for (const edge of analysis.edges) {
    for (const plane of planesOfLine(edge, domainOfSegment)) {
      byPlane.set(plane, [...(byPlane.get(plane) ?? []), edge])
    }
  }

  const graphs = new Map<string, { vertices: VertexRef[]; edges: UnitEdge[] }>()
  for (const [plane, lines] of byPlane) graphs.set(plane, unitGraph(lines, units))

  const touched = new Set<VertexRef>()
  for (const g of graphs.values()) for (const v of g.vertices) touched.add(v)
  const loose = units.units.map((u) => unitRef(u.id)).filter((v) => !touched.has(v))
  if (loose.length > 0) {
    const main = graphs.get(DEFAULT_PLANE) ?? { vertices: [], edges: [] }
    graphs.set(DEFAULT_PLANE, { vertices: sorted([...main.vertices, ...loose]), edges: main.edges })
  }

  const order = [...graphs.keys()].sort((a, b) =>
    a === DEFAULT_PLANE ? -1 : b === DEFAULT_PLANE ? 1 : compare(a, b),
  )
  return order.map((plane) => {
    const g = graphs.get(plane) ?? { vertices: [], edges: [] }
    return { plane, vertices: g.vertices, edges: g.edges }
  })
}
