// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { segmentRef } from './analysis-graph.js'
import type { AnalysisGraph, Orientation, PlaneGraph, Units, VertexRef } from './stage-types.js'
import { unitRef } from './units.js'

/**
 * Stage 7. Which end of each line of a plane is upstream, counted from what lies outside.
 *
 * The outside of a plane is its vertices with no place: a unit outside every group, a segment
 * with no group, a routing domain (a network whose inside is not written). A plane is also
 * entered where it shares a vertex with another plane: from there, the way out is as long as
 * that vertex's way to the other plane's own outside. Ways are not chained from plane to plane
 * beyond that, so a plane's lines are measured by its own lines and its own outside only, and a
 * path in another plane (out of band, management) does not shorten them.
 *
 * A way is measured first by its virtual lines and then by its other lines: a virtual line (a
 * tunnel, a session) is longer than any way over cables. A line whose ends are at different
 * distances runs from the nearer end (upstream) to the farther (downstream); a line whose ends
 * are at the same distance is even. A line with an end that no way reaches is not listed.
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

  // A virtual line weighs more than every other line of every plane together.
  const virtualWeight = planes.reduce((n, p) => n + p.edges.length, 0) + 1
  const outsideOf = (p: PlaneGraph) => p.vertices.filter((v) => !placed.has(v))
  const own = planes.map((p) =>
    distances(p, new Map(outsideOf(p).map((v) => [v, 0])), virtualWeight),
  )

  return planes.map((plane, i) => {
    const start = new Map(outsideOf(plane).map((v): [VertexRef, number] => [v, 0]))
    for (const v of plane.vertices) {
      for (const [j, d] of own.entries()) {
        const there = j === i ? undefined : d.get(v)
        if (there !== undefined && there < (start.get(v) ?? Number.POSITIVE_INFINITY))
          start.set(v, there)
      }
    }
    const distance = distances(plane, start, virtualWeight)
    const flows: [VertexRef, VertexRef][] = []
    const even: [VertexRef, VertexRef][] = []
    for (const e of plane.edges) {
      const da = distance.get(e.a)
      const db = distance.get(e.b)
      if (da === undefined || db === undefined) continue
      if (da < db) flows.push([e.a, e.b])
      else if (db < da) flows.push([e.b, e.a])
      else even.push([e.a, e.b])
    }
    return { plane: plane.plane, outside: outsideOf(plane), flows, even }
  })
}

/** The shortest ways from the starting vertices, each starting at its own length. */
function distances(
  plane: PlaneGraph,
  start: ReadonlyMap<VertexRef, number>,
  virtualWeight: number,
): Map<VertexRef, number> {
  const neighbours = new Map<VertexRef, { to: VertexRef; weight: number }[]>()
  for (const e of plane.edges) {
    const w = e.lines.every((l) => l.virtual) ? virtualWeight : 1
    neighbours.set(e.a, [...(neighbours.get(e.a) ?? []), { to: e.b, weight: w }])
    neighbours.set(e.b, [...(neighbours.get(e.b) ?? []), { to: e.a, weight: w }])
  }
  const distance = new Map(start)
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
  return distance
}
