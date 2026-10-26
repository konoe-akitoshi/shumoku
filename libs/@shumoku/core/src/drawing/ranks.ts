// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { GroupId, Structure } from '../structure/types.js'
import { type ElementId, type Elements, elementIdOf } from './elements.js'

/**
 * Layer 2. A rank for each element: how far along the drawing it goes, an integer. The boundary
 * points are rank 0. The physical side runs up from there (1, 2, ...) by the number of cabled
 * lines from the nearest boundary point; the virtual side runs down (-1, -2, ...) the same way.
 * Which way a rank points on the page is for the layers below to say.
 *
 * The structure says nothing of an element that no way from a boundary point reaches, so the
 * drawing places those by its own rule, which is not part of the structure:
 *  - a hosted element goes one rank farther from the boundary than its host's element, on its
 *    host's side, whatever else it is joined to (its layout line to the host says so);
 *  - an element with a line to a ranked element goes one rank farther from the boundary than
 *    the nearest such neighbour, on that neighbour's side (the physical side next to rank 0),
 *    unless that would take it out of the ranks its own group already spans. A group's frame
 *    spans the ranks of the elements in it (and in the groups inside it) that the structure
 *    reaches, hosted ones included. An element the structure does not reach takes the rank in
 *    that span nearest to the one the rule gives, so that it does not stretch its group's
 *    frame, and the frames around it, over ranks they have nothing else in. An element in no
 *    group, or in a group (or groups around it) with no such element, keeps the rule as it is;
 *  - a separate part that no line joins to a ranked element goes after everything on the
 *    physical side: its best connected element (most lines, then first written) at the rank
 *    after the highest, and the rest by their number of lines from that element; the ranks
 *    of its elements that stand in a group are kept in the span as above.
 */
export function rankElements(elements: Elements, structure: Structure): Map<ElementId, number> {
  const rank = new Map<ElementId, number>()
  const ids = elements.elements.map((e) => e.id)
  const known = new Set(ids)

  // The structure's lines are [nearer, farther] and each is one step; a side's distance is the
  // number of steps from a boundary point along them.
  const refOf = elementIdOf
  const boundary = structure.boundary.map(refOf).filter((id) => known.has(id))
  for (const side of ['physical', 'virtual'] as const) {
    const farther = new Map<ElementId, ElementId[]>()
    for (const plane of structure.planes) {
      if (plane.side !== side) continue
      for (const [near, far] of plane.flows) {
        const list = farther.get(refOf(near)) ?? []
        list.push(refOf(far))
        farther.set(refOf(near), list)
      }
    }
    const distance = new Map(boundary.map((id) => [id, 0]))
    const queue = [...boundary]
    for (const id of queue) {
      for (const next of farther.get(id) ?? []) {
        if (distance.has(next)) continue
        distance.set(next, (distance.get(id) ?? 0) + 1)
        queue.push(next)
      }
    }
    for (const [id, d] of distance) {
      if (d === 0) rank.set(id, 0)
      else if (known.has(id)) rank.set(id, side === 'physical' ? d : -d)
    }
  }

  // The host of each hosted element, and the other way.
  const hostOf = new Map<ElementId, ElementId>()
  const hostedOn = new Map<ElementId, ElementId[]>()
  for (const line of elements.lines) {
    if (!line.layoutOnly) continue
    const [host, hosted] = line.ends
    hostOf.set(hosted.element, host.element)
    hostedOn.set(host.element, [...(hostedOn.get(host.element) ?? []), hosted.element])
  }
  const beyond = (r: number) => (r >= 0 ? r + 1 : r - 1)
  /** Ranks every hosted element whose host is ranked, down the chain of hosts. */
  const rankHosted = () => {
    const queue = [...rank.keys()]
    for (const id of queue) {
      for (const hosted of hostedOn.get(id) ?? []) {
        if (rank.has(hosted)) continue
        rank.set(hosted, beyond(rank.get(id) ?? 0))
        queue.push(hosted)
      }
    }
  }

  // The ranks each group's frame spans already: its elements, and those in the groups inside
  // it, that the structure (or a host) has ranked. Fixed here, before the drawing's own rule
  // ranks anything, so that the rule never stretches a span.
  rankHosted()
  const parentOf = new Map(elements.groups.map((g) => [g.id, g.parent]))
  const placeOf = new Map(elements.elements.map((e) => [e.id, e.place]))
  const span = new Map<GroupId, readonly [number, number]>()
  for (const [id, r] of rank) {
    for (let g = placeOf.get(id); g !== undefined; g = parentOf.get(g)) {
      const had = span.get(g)
      span.set(g, had === undefined ? [r, r] : [Math.min(had[0], r), Math.max(had[1], r)])
    }
  }
  /** The rank nearest to `r` among those the element's group spans; `r` when none is. */
  const within = (id: ElementId, r: number): number => {
    for (let g = placeOf.get(id); g !== undefined; g = parentOf.get(g)) {
      const own = span.get(g)
      if (own) return Math.min(Math.max(r, own[0]), own[1])
    }
    return r
  }

  // Lines that draw something; a layout line is not a way to be reached.
  const neighbours = new Map<ElementId, ElementId[]>(ids.map((id) => [id, []]))
  for (const line of elements.lines) {
    if (line.layoutOnly) continue
    const [a, b] = line.ends
    neighbours.get(a.element)?.push(b.element)
    neighbours.get(b.element)?.push(a.element)
  }

  // Unranked elements next to ranked ones, nearest to the boundary first.
  for (;;) {
    rankHosted()
    const candidates = new Map<ElementId, number>()
    for (const [id, r] of rank) {
      for (const next of neighbours.get(id) ?? []) {
        if (rank.has(next) || hostOf.has(next)) continue
        const proposed = within(next, beyond(r))
        const best = candidates.get(next)
        if (best === undefined || Math.abs(proposed) < Math.abs(best))
          candidates.set(next, proposed)
      }
    }
    if (candidates.size === 0) break
    const nearest = Math.min(...[...candidates.values()].map(Math.abs))
    for (const [id, r] of [...candidates].sort(([a], [b]) => compare(a, b))) {
      if (Math.abs(r) === nearest) rank.set(id, r)
    }
  }

  // Separate parts.
  const after = Math.max(-1, ...rank.values()) + 1
  const reached = (from: ElementId, base: number) => {
    const queue = [from]
    rank.set(from, within(from, base))
    for (const id of queue) {
      const here = rank.get(id) ?? base
      for (const hosted of hostedOn.get(id) ?? []) {
        if (rank.has(hosted)) continue
        rank.set(hosted, beyond(here))
        queue.push(hosted)
      }
      for (const next of neighbours.get(id) ?? []) {
        if (rank.has(next) || hostOf.has(next)) continue
        rank.set(next, within(next, here + 1))
        queue.push(next)
      }
    }
  }
  const degree = (id: ElementId) => neighbours.get(id)?.length ?? 0
  for (;;) {
    const open = ids.filter((id) => !rank.has(id))
    const roots = open.filter((id) => !hostOf.has(id))
    const root = (roots.length > 0 ? roots : open).reduce<ElementId | undefined>(
      (best, id) => (best === undefined || degree(id) > degree(best) ? id : best),
      undefined,
    )
    if (root === undefined) break
    reached(root, after)
  }
  return rank
}
