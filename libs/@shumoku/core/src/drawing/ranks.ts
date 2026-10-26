// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Structure } from '../structure/types.js'
import { type ElementId, type Elements, elementIdOf } from './elements.js'

/**
 * Layer 2. A rank for each element: how far along the drawing it goes, an integer. The boundary
 * points are rank 0. The physical side runs up from there (1, 2, ...) by the number of cabled
 * lines from the nearest boundary point; the virtual side runs down (-1, -2, ...) the same way.
 * Which way a rank points on the page is for the layers below to say.
 *
 * The structure says nothing of an element that no way from a boundary point reaches, so the
 * drawing places those by its own rule, which is not part of the structure:
 *  - an element with a line to a ranked element goes one rank farther from the boundary than
 *    the nearest such neighbour, on that neighbour's side (the physical side next to rank 0);
 *  - a separate part that no line joins to a ranked element goes after everything on the
 *    physical side: its best connected element (most lines, then first written) at the rank
 *    after the highest, and the rest by their number of lines from that element.
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

  const neighbours = new Map<ElementId, ElementId[]>(ids.map((id) => [id, []]))
  for (const line of elements.lines) {
    const [a, b] = line.ends
    neighbours.get(a.element)?.push(b.element)
    neighbours.get(b.element)?.push(a.element)
  }

  // Unranked elements next to ranked ones, nearest to the boundary first.
  for (;;) {
    const candidates = new Map<ElementId, number>()
    for (const [id, r] of rank) {
      for (const next of neighbours.get(id) ?? []) {
        if (rank.has(next)) continue
        const proposed = r >= 0 ? r + 1 : r - 1
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
    rank.set(from, base)
    for (const id of queue) {
      for (const next of neighbours.get(id) ?? []) {
        if (rank.has(next)) continue
        rank.set(next, (rank.get(id) ?? base) + 1)
        queue.push(next)
      }
    }
  }
  const degree = (id: ElementId) => neighbours.get(id)?.length ?? 0
  for (;;) {
    const open = ids.filter((id) => !rank.has(id))
    const root = open.reduce<ElementId | undefined>(
      (best, id) => (best === undefined || degree(id) > degree(best) ? id : best),
      undefined,
    )
    if (root === undefined) break
    reached(root, after)
  }
  return rank
}
