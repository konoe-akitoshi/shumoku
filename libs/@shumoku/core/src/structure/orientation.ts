// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { segmentRef } from './analysis-graph.js'
import type { AnalysisGraph, Orientation, PlaneGraph, Units, VertexRef } from './stage-types.js'
import { unitRef } from './units.js'

/**
 * Stage 7. Which way each line of a plane runs, counted from what lies outside the plane.
 *
 * The outside of a plane is its vertices with no place: a unit outside every group, a segment
 * with no group, a routing domain (a network whose inside is not written). A plane with none of
 * its own is entered where it meets another plane's outside: its vertices that have, in some
 * other plane, a line to a vertex with no place.
 *
 * Each vertex is as far from the outside as the shortest way there, where a way is measured
 * first by its virtual lines and then by its other lines: a virtual line (a tunnel, a session)
 * is longer than any way over cables. A line whose ends are at different distances runs from
 * the nearer end to the farther; a line whose ends are at the same distance runs beside. A line
 * with an end the outside does not reach has no way and is not listed.
 */
export function orientPlanes(
  planes: readonly PlaneGraph[],
  analysis: Pick<AnalysisGraph, 'vertices'>,
  units: Units,
): Orientation[] {
  const placed = new Set<VertexRef>()
  for (const u of units.units) if (u.place !== undefined) placed.add(unitRef(u.id))
  for (const v of analysis.vertices)
    if (v.kind === 'segment' && v.group !== undefined) placed.add(segmentRef(v.id))

  // The vertices that touch, in each plane, a vertex with no place.
  const touchesOutside = planes.map((p) => {
    const out = new Set<VertexRef>()
    for (const e of p.edges) {
      if (!placed.has(e.b)) out.add(e.a)
      if (!placed.has(e.a)) out.add(e.b)
    }
    return out
  })

  return planes.map((plane, i) => {
    const own = plane.vertices.filter((v) => !placed.has(v))
    const met = plane.vertices.filter((v) =>
      touchesOutside.some((touch, j) => j !== i && touch.has(v)),
    )
    return orient(plane, own.length > 0 ? own : met)
  })
}

function orient(plane: PlaneGraph, outside: readonly VertexRef[]): Orientation {
  // A virtual line weighs more than every other line of the plane together.
  const virtualWeight = plane.edges.length + 1
  const weightOf = (e: PlaneGraph['edges'][number]) =>
    e.lines.every((l) => l.virtual) ? virtualWeight : 1

  const neighbours = new Map<VertexRef, { to: VertexRef; weight: number }[]>()
  for (const e of plane.edges) {
    const w = weightOf(e)
    neighbours.set(e.a, [...(neighbours.get(e.a) ?? []), { to: e.b, weight: w }])
    neighbours.set(e.b, [...(neighbours.get(e.b) ?? []), { to: e.a, weight: w }])
  }
  const distance = new Map<VertexRef, number>(outside.map((v) => [v, 0]))
  const done = new Set<VertexRef>()
  for (;;) {
    let next: VertexRef | undefined
    for (const [v, d] of distance) {
      if (done.has(v)) continue
      if (next === undefined || d < (distance.get(next) ?? 0)) next = v
    }
    if (next === undefined) break
    done.add(next)
    const here = distance.get(next) ?? 0
    for (const { to, weight } of neighbours.get(next) ?? []) {
      const known = distance.get(to)
      if (known === undefined || here + weight < known) distance.set(to, here + weight)
    }
  }

  const above: [VertexRef, VertexRef][] = []
  const beside: [VertexRef, VertexRef][] = []
  for (const e of plane.edges) {
    const da = distance.get(e.a)
    const db = distance.get(e.b)
    if (da === undefined || db === undefined) continue
    if (da < db) above.push([e.a, e.b])
    else if (db < da) above.push([e.b, e.a])
    else beside.push([e.a, e.b])
  }
  return { plane: plane.plane, outside: [...outside], above, beside }
}
