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
  Side,
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
 * Stage 3. Each line goes to the plane it belongs to, and each plane gets a graph for each side:
 * the lines with a cable of their own, and the virtual ones. A unit with no line in a plane is
 * not in it. A unit with no line at all stays in the physical side of the default plane as a
 * vertex of its own, so that it is not lost. The default plane comes first, then the others by
 * id, the physical side before the virtual one.
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

  const graphs: PlaneGraph[] = []
  for (const [plane, lines] of byPlane) {
    for (const side of ['physical', 'virtual'] as const satisfies readonly Side[]) {
      const own = lines.filter((l) => l.virtual === (side === 'virtual'))
      if (own.length > 0) graphs.push({ plane, side, ...unitGraph(own, units) })
    }
  }

  const touched = new Set<VertexRef>()
  for (const g of graphs) for (const v of g.vertices) touched.add(v)
  const loose = units.units.map((u) => unitRef(u.id)).filter((v) => !touched.has(v))
  if (loose.length > 0) {
    const at = graphs.findIndex((g) => g.plane === DEFAULT_PLANE && g.side === 'physical')
    const main = graphs[at]
    const merged: PlaneGraph = {
      plane: DEFAULT_PLANE,
      side: 'physical',
      vertices: sorted([...(main?.vertices ?? []), ...loose]),
      edges: main?.edges ?? [],
    }
    if (at >= 0) graphs[at] = merged
    else graphs.push(merged)
  }

  const rank = (g: PlaneGraph) => (g.plane === DEFAULT_PLANE ? '0' : `1${g.plane}`)
  return graphs.sort((a, b) => compare(rank(a), rank(b)) || compare(a.side, b.side))
}
