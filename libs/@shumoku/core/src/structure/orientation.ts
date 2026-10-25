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
 * only, so a virtual line laid over the network (one whose far end has cables of its own and is
 * not a boundary point) counts on neither side. A line whose ends are at different distances is
 * listed nearer end first; a line whose ends are at the same distance is even. A line with an
 * end that no way from a boundary point reaches is not listed.
 */
export function orientPlanes(
  planes: readonly PlaneGraph[],
  boundary: readonly VertexRef[],
): Orientation[] {
  const at = new Set(boundary)
  const cabled = new Set(
    planes.filter((p) => p.side === 'physical').flatMap((p) => p.edges.flatMap((e) => [e.a, e.b])),
  )
  const distance = {
    physical: distances(
      planes.filter((p) => p.side === 'physical'),
      boundary,
      () => true,
    ),
    virtual: distances(
      planes.filter((p) => p.side === 'virtual'),
      boundary,
      (v) => at.has(v) || !cabled.has(v),
    ),
  }
  return planes.map((plane) => {
    const d = distance[plane.side]
    const flows: [VertexRef, VertexRef][] = []
    const even: [VertexRef, VertexRef][] = []
    for (const e of plane.edges) {
      const da = d.get(e.a)
      const db = d.get(e.b)
      if (da === undefined || db === undefined) continue
      if (da < db) flows.push([e.a, e.b])
      else if (db < da) flows.push([e.b, e.a])
      else even.push([e.a, e.b])
    }
    return { plane: plane.plane, side: plane.side, flows, even }
  })
}

/** The number of lines on the shortest way from a boundary point, through the vertices that `may` pass. */
function distances(
  graphs: readonly PlaneGraph[],
  boundary: readonly VertexRef[],
  may: (v: VertexRef) => boolean,
): Map<VertexRef, number> {
  const neighbours = new Map<VertexRef, VertexRef[]>()
  for (const g of graphs) {
    for (const e of g.edges) {
      neighbours.set(e.a, [...(neighbours.get(e.a) ?? []), e.b])
      neighbours.set(e.b, [...(neighbours.get(e.b) ?? []), e.a])
    }
  }
  const distance = new Map(boundary.map((v) => [v, 0]))
  const queue = [...boundary]
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
