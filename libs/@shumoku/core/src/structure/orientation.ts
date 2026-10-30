// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { sorted } from './keys.js'
import type { Orientation, PlaneGraph, VertexRef } from './stage-types.js'

/**
 * The vertices with lines on both sides, in any planes: where the physical may meet the virtual.
 * They are candidates only. A virtual line is either a way into a network beyond the boundary
 * (a session across an exchange, a cloud connection) or a line laid over the network's own
 * cables (a tunnel, a backup to a cloud), and the lines alone do not tell which; the reader
 * says which candidates are the boundary.
 */
export function boundaryCandidates(planes: readonly PlaneGraph[]): VertexRef[] {
  const on = (side: PlaneGraph['side']) =>
    new Set(
      planes.filter((p) => p.side === side).flatMap((p) => p.edges.flatMap((e) => [e.a, e.b])),
    )
  const virtual = on('virtual')
  return sorted([...on('physical')].filter((v) => virtual.has(v)))
}

/**
 * Stage 4. How near each end of every line is to the given boundary points. A side is measured
 * by its own lines, of every plane together, from the boundary points: the physical side by the
 * lines with a cable; the virtual side by the virtual lines, through the vertices with no cable
 * only. A line whose ends are at different distances is listed nearer end first; a line whose
 * ends are at the same distance is even. A line with an end that no way reaches is not listed.
 *
 * The vertices with a cable are the ground and those without are the space. A virtual line
 * between two grounds can lie over the cables, so it counts on neither side. A virtual line from
 * the ground to a space cannot: the space has no cable to ride on, so it leaves the network, as
 * the lines at the boundary points do. A space that no boundary point reaches is therefore
 * measured from the grounds its virtual lines come from, each at distance 0, through the
 * spaces alone: the ground is the nearer end and the space beyond it the farther. Spaces that
 * join no ground by virtual lines have nothing to be measured from and are not listed. This
 * only adds lines: what the boundary points reach is measured as before, and a ground's own
 * distance is not changed.
 */
export function orientPlanes(
  planes: readonly PlaneGraph[],
  boundary: readonly VertexRef[],
): Orientation[] {
  const at = new Set(boundary)
  const cabled = new Set(
    planes.filter((p) => p.side === 'physical').flatMap((p) => p.edges.flatMap((e) => [e.a, e.b])),
  )
  const virtual = planes.filter((p) => p.side === 'virtual')
  const reached = distances(virtual, boundary, (v) => at.has(v) || !cabled.has(v))
  // The space no boundary point reaches, and the grounds that its virtual lines leave.
  const beyond = (v: VertexRef) => !cabled.has(v) && !reached.has(v)
  const grounds = new Set<VertexRef>()
  for (const e of virtual.flatMap((p) => p.edges)) {
    if (cabled.has(e.a) && beyond(e.b)) grounds.add(e.a)
    if (cabled.has(e.b) && beyond(e.a)) grounds.add(e.b)
  }
  const outward = distances(virtual, [...grounds].sort(), beyond)
  const distance = {
    physical: distances(
      planes.filter((p) => p.side === 'physical'),
      boundary,
      () => true,
    ),
    virtual: reached,
  }
  /** A ground stands at 0 only against a space beyond it; otherwise the distances are the side's own. */
  const near = (side: PlaneGraph['side'], v: VertexRef, other: VertexRef): number | undefined => {
    const own = distance[side].get(v)
    if (own !== undefined || side === 'physical') return own
    if (beyond(v)) return outward.get(v)
    return cabled.has(v) && beyond(other) ? 0 : undefined
  }
  return planes.map((plane) => {
    const flows: [VertexRef, VertexRef][] = []
    const even: [VertexRef, VertexRef][] = []
    for (const e of plane.edges) {
      const da = near(plane.side, e.a, e.b)
      const db = near(plane.side, e.b, e.a)
      if (da === undefined || db === undefined) continue
      if (da < db) flows.push([e.a, e.b])
      else if (db < da) flows.push([e.b, e.a])
      else even.push([e.a, e.b])
    }
    return { plane: plane.plane, side: plane.side, flows, even }
  })
}

/** The number of lines on the shortest way from the `from` points, through the vertices that `may` pass. */
function distances(
  graphs: readonly PlaneGraph[],
  from: readonly VertexRef[],
  may: (v: VertexRef) => boolean,
): Map<VertexRef, number> {
  const neighbours = new Map<VertexRef, VertexRef[]>()
  for (const g of graphs) {
    for (const e of g.edges) {
      neighbours.set(e.a, [...(neighbours.get(e.a) ?? []), e.b])
      neighbours.set(e.b, [...(neighbours.get(e.b) ?? []), e.a])
    }
  }
  const distance = new Map(from.map((v) => [v, 0]))
  const queue = [...from]
  for (let v = queue.shift(); v !== undefined; v = queue.shift()) {
    const here = distance.get(v) ?? 0
    for (const w of neighbours.get(v) ?? []) {
      if (distance.has(w) || !may(w)) continue
      distance.set(w, here + 1)
      queue.push(w)
    }
  }
  return distance
}
