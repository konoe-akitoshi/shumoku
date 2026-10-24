// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { routingDomainRef, segmentRef } from './analysis-graph.js'
import { compare, sorted } from './keys.js'
import type { AnalysisGraph, End, Entrance, PlaneStage, Units, VertexRef } from './stage-types.js'
import { unitRef } from './units.js'

/**
 * Stage 7. The places where the network meets what lies outside it, from what is written. A
 * vertex with a place (a unit or a segment) is an entrance when it has either
 * (a) a line that is not virtual to a vertex with no place, or
 * (b) a line, virtual or not, to a routing domain.
 * What it meets is listed with it. Only vertices of the default plane are entrances.
 */
export function findEntrances(
  analysis: AnalysisGraph,
  units: Units,
  plane: Pick<PlaneStage, 'vertices'> | undefined,
): Entrance[] {
  if (!plane) return []
  const unitOfNode = new Map<string, string>()
  const placed = new Set<VertexRef>()
  for (const u of units.units) {
    for (const m of u.members) unitOfNode.set(m, u.id)
    if (u.place !== undefined) placed.add(unitRef(u.id))
  }
  for (const v of analysis.vertices) {
    if (v.kind === 'segment' && v.group !== undefined) placed.add(segmentRef(v.id))
  }
  const refOf = (end: End): VertexRef | undefined => {
    if ('segment' in end) return segmentRef(end.segment)
    if ('routingDomain' in end) return routingDomainRef(end.routingDomain)
    const unit = unitOfNode.get(end.node)
    return unit === undefined ? undefined : unitRef(unit)
  }

  const toward = new Map<VertexRef, Set<VertexRef>>()
  const meet = (inside: VertexRef, outside: VertexRef) => {
    toward.set(inside, (toward.get(inside) ?? new Set()).add(outside))
  }
  for (const edge of analysis.edges) {
    const x = refOf(edge.ends[0])
    const y = refOf(edge.ends[1])
    if (x === undefined || y === undefined || x === y) continue
    for (const [self, other] of [
      [x, y],
      [y, x],
    ] as const) {
      if (!placed.has(self)) continue
      const toDomain = other.startsWith('routingDomain:')
      if (toDomain || (!edge.virtual && !placed.has(other))) meet(self, other)
    }
  }

  const inPlane = new Set(plane.vertices)
  return [...toward.entries()]
    .filter(([v]) => inPlane.has(v))
    .sort(([a], [b]) => compare(a, b))
    .map(([vertex, others]) => ({ vertex, toward: sorted(others) }))
}
