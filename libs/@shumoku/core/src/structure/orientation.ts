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
 * by its own lines, of every plane together. A line whose ends are at different distances is
 * listed nearer end first; a line whose ends are at the same distance is even. A line with an
 * end that no way reaches is not listed.
 *
 * The physical side is measured from the boundary points through the lines with a cable. A
 * cable has no outside, so the boundary points are all that says where the network ends.
 *
 * The virtual side is told by the network and the reader together. The vertices with a cable are
 * the ground and those without are the space. A virtual line between two grounds can lie over
 * the cables, so it counts on neither side (unless both ends are boundary points, which are at
 * distance 0 alike). A virtual line from the ground to a space cannot: the space has no cable to
 * ride on, so it leaves the network, as the lines at the boundary points do. What the network
 * alone says, for each connected set of spaces: its exits, the grounds its virtual lines leave
 * from. What only the reader can say is which exits are the edge of the network: the boundary
 * points among the set and its exits. Where the reader named some, they are where the set is
 * measured from; where the reader named none, every exit is. The distance is then one breadth
 * first search from those, through the set, and a virtual line counts only if both its ends
 * were reached by it. The reader's choice wins over the network's default because it is the
 * more particular: an exit the reader did not name is a cable-bearing vertex with a line laid
 * over the network, not a way out of it.
 */
export function orientPlanes(
  planes: readonly PlaneGraph[],
  boundary: readonly VertexRef[],
): Orientation[] {
  const physical = planes.filter((p) => p.side === 'physical')
  const virtual = planes.filter((p) => p.side === 'virtual')
  const cabled = new Set(physical.flatMap((p) => p.edges.flatMap((e) => [e.a, e.b])))
  const at = new Set(boundary)
  const reach = (side: PlaneGraph['side']) => neighbours(planes.filter((p) => p.side === side))

  const away = distances(reach('physical'), boundary, () => true)
  const sets = spaces(virtual, cabled)
  const measured = new Map<Space, Map<VertexRef, number>>()
  for (const set of sets) {
    const from = pick(set, at)
    measured.set(
      set,
      distances(reach('virtual'), from, (v) => set.members.has(v)),
    )
  }
  const spaceOf = new Map(sets.flatMap((set) => [...set.members].map((v) => [v, set] as const)))

  /** The two ends' distances; undefined for a line that is laid over the cables or not reached. */
  const near = (side: PlaneGraph['side'], a: VertexRef, b: VertexRef) => {
    if (side === 'physical') return [away.get(a), away.get(b)] as const
    const set = spaceOf.get(a) ?? spaceOf.get(b)
    if (set === undefined) return [at.has(a) ? 0 : undefined, at.has(b) ? 0 : undefined] as const
    const distance = measured.get(set)
    return [distance?.get(a), distance?.get(b)] as const
  }
  return planes.map((plane) => {
    const flows: [VertexRef, VertexRef][] = []
    const even: [VertexRef, VertexRef][] = []
    for (const e of plane.edges) {
      const [da, db] = near(plane.side, e.a, e.b)
      if (da === undefined || db === undefined) continue
      if (da < db) flows.push([e.a, e.b])
      else if (db < da) flows.push([e.b, e.a])
      else even.push([e.a, e.b])
    }
    return { plane: plane.plane, side: plane.side, flows, even }
  })
}

/** A connected set of spaces, and the grounds its virtual lines leave from. */
interface Space {
  readonly members: ReadonlySet<VertexRef>
  readonly exits: readonly VertexRef[]
}

/** The connected sets of spaces (vertices with no cable), joined by virtual lines, with their exits. */
function spaces(virtual: readonly PlaneGraph[], cabled: ReadonlySet<VertexRef>): Space[] {
  const next = neighbours(virtual)
  const sets: Space[] = []
  const seen = new Set<VertexRef>()
  for (const start of sorted([...next.keys()])) {
    if (cabled.has(start) || seen.has(start)) continue
    const members = new Set<VertexRef>(distances(next, [start], (v) => !cabled.has(v)).keys())
    for (const v of members) seen.add(v)
    const exits = sorted(
      [...members].flatMap((v) => (next.get(v) ?? []).filter((w) => cabled.has(w))),
    )
    sets.push({ members, exits: [...new Set(exits)] })
  }
  return sets
}

/**
 * Where a set is measured from: the boundary points among it and its exits, or, if the reader
 * named none, all its exits. The one place the reader's choice meets the network's.
 */
function pick(set: Space, boundary: ReadonlySet<VertexRef>): VertexRef[] {
  const named = [...set.members, ...set.exits].filter((v) => boundary.has(v))
  return named.length > 0 ? named : [...set.exits]
}

/** The vertices each vertex shares a line with. */
function neighbours(graphs: readonly PlaneGraph[]): Map<VertexRef, VertexRef[]> {
  const next = new Map<VertexRef, VertexRef[]>()
  for (const g of graphs) {
    for (const e of g.edges) {
      next.set(e.a, [...(next.get(e.a) ?? []), e.b])
      next.set(e.b, [...(next.get(e.b) ?? []), e.a])
    }
  }
  return next
}

/** The number of lines on the shortest way from the `from` points, through the vertices that `may` pass. */
function distances(
  next: ReadonlyMap<VertexRef, readonly VertexRef[]>,
  from: readonly VertexRef[],
  may: (v: VertexRef) => boolean,
): Map<VertexRef, number> {
  const distance = new Map(from.map((v) => [v, 0]))
  const queue = [...from]
  for (let v = queue.shift(); v !== undefined; v = queue.shift()) {
    const here = distance.get(v) ?? 0
    for (const w of next.get(v) ?? []) {
      if (distance.has(w) || !may(w)) continue
      distance.set(w, here + 1)
      queue.push(w)
    }
  }
  return distance
}
