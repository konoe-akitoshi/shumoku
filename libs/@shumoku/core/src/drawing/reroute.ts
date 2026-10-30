// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type Ordering, orderBundles } from './bundle-order.js'
import type { createRouter, GlobalRoute } from './global.js'
import type { Line, Problem } from './problem.js'
import type { Space } from './space.js'

export interface Rerouted {
  /** The order of the lines at the doors, for the routes as they stand. */
  ordering: Ordering
  /** The lines that were laid again, and how many of those were kept. */
  tried: number
  accepted: number
  /** For each kept route: its length over the length of the one it replaced. */
  stretch: number[]
}

const lengthOf = (r: GlobalRoute) =>
  r.points.reduce(
    (n, p, i) =>
      i === 0
        ? n
        : n +
          Math.abs(p.x - (r.points[i - 1]?.x ?? p.x)) +
          Math.abs(p.y - (r.points[i - 1]?.y ?? p.y)),
    0,
  )

/**
 * Not called by the layout. Measured on the large network, it took the crossings down by making
 * the lines far longer (the worst nine times as long as the straight way) and took seconds, while
 * most of those crossings go by changing only the orders at the doors, which makes no line
 * longer. So the orders are settled first (`orderBundles`), and a route is laid again only for
 * the crossings that are left, and only to a route that is not longer.
 *
 * Lays again the lines that cross others, worst first, with the crossings of the lines already
 * laid counted in the search, and keeps a route only if the crossings that the orders at the doors
 * then count are fewer in all (and, if they are as many, the lines shorter in all). Where they
 * are not, the route and the orders are as they were. Each kept route lowers the count, so this
 * stops; it is at most once for each line.
 *
 * The crossings are only known once the order of the lines at the doors is: a route is chosen
 * by an estimate, and what that comes to is for the order to say.
 */
export function rerouteForCrossings(
  problem: Problem,
  space: Space,
  router: ReturnType<typeof createRouter>,
): Rerouted {
  const { routes } = router.result
  const { pitch } = problem.metrics
  const lines = new Map<string, Line>(problem.lines.map((l) => [l.id, l]))
  let ordering = orderBundles(space, router.result, pitch)
  let total = [...routes.values()].reduce((n, r) => n + lengthOf(r), 0)
  let tried = 0
  let accepted = 0
  const stretch: number[] = []
  for (let pass = 0; pass < lines.size; pass++) {
    const crossing = new Map<string, number>()
    for (const [a, b] of ordering.pairs) {
      for (const id of a === b ? [a] : [a, b]) crossing.set(id, (crossing.get(id) ?? 0) + 1)
    }
    const worst = [...crossing].sort((p, q) => q[1] - p[1] || compare(p[0], q[0]))
    let improved = false
    for (const [id] of worst) {
      const line = lines.get(id)
      const old = routes.get(id)
      if (!line || !old) continue
      router.lay(old, -1)
      routes.delete(id)
      const found = router.reroute(line, (cell) => ordering.chords.get(cell) ?? [])
      tried++
      let kept: Ordering | undefined
      if (found) {
        routes.set(id, found)
        router.lay(found, 1)
        const next = orderBundles(space, router.result, pitch)
        const length = total - lengthOf(old) + lengthOf(found)
        if (
          next.crossings < ordering.crossings ||
          (next.crossings === ordering.crossings && length < total - 1e-6)
        ) {
          kept = next
          total = length
          stretch.push(lengthOf(found) / Math.max(lengthOf(old), 1e-9))
        } else {
          router.lay(found, -1)
          routes.delete(id)
        }
      }
      if (kept) {
        ordering = kept
        accepted++
        improved = true
      } else {
        routes.set(id, old)
        router.lay(old, 1)
      }
    }
    if (!improved) break
  }
  return { ordering, tried, accepted, stretch }
}
