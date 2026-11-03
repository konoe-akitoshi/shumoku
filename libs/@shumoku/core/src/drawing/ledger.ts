// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { EPS } from './tolerance.js'

interface Arrow {
  to: number
  d: number
}

/**
 * Which equalities a set of separations still admits, by the longest paths between the two
 * variables. A separation `v[j] - v[i] >= d` is an arrow i to j of length d; an equality is the
 * arrow both ways (d and -d). The values exist as long as no ring of arrows is longer than
 * nothing, so an equality `v[j] - v[i] = d` fits exactly when the longest way from j to i is at
 * most -d and the longest from i to j at most d. Asking costs a walk over the arrows, not a
 * solve of all the values, and an equality that fits is added with no solve at all.
 */
export interface Ledger {
  /** Whether `v[j] - v[i] = d` can be added to what is held. */
  admits(e: { i: number; j: number; d: number }): boolean
  /** Holds the equality from now on; the caller has asked `admits` first. */
  add(e: { i: number; j: number; d: number }): void
}

export function ledgerOf(
  n: number,
  sep: readonly { i: number; j: number; d: number }[],
  equal: readonly { i: number; j: number; d: number }[],
): Ledger {
  const out: Arrow[][] = Array.from({ length: n }, () => [])
  for (const { i, j, d } of sep) out[i]?.push({ to: j, d })
  const add = ({ i, j, d }: { i: number; j: number; d: number }) => {
    out[i]?.push({ to: j, d })
    out[j]?.push({ to: i, d: -d })
  }
  for (const e of equal) add(e)

  const reach = new Float64Array(n).fill(Number.NEGATIVE_INFINITY)
  const touched: number[] = []
  /** Whether the longest way from one variable to another is longer than a limit. */
  const longer = (from: number, to: number, limit: number): boolean => {
    let found = false
    reach[from] = 0
    touched.push(from)
    const queue = [from]
    const queued = new Set<number>([from])
    for (let head = 0; head < queue.length && !found; head++) {
      const c = queue[head] as number
      queued.delete(c)
      const here = reach[c] as number
      for (const a of out[c] ?? []) {
        const need = here + a.d
        if ((reach[a.to] as number) >= need - EPS) continue
        if (reach[a.to] === Number.NEGATIVE_INFINITY) touched.push(a.to)
        reach[a.to] = need
        if (a.to === to && need > limit + EPS) {
          found = true
          break
        }
        if (!queued.has(a.to)) {
          queued.add(a.to)
          queue.push(a.to)
        }
      }
    }
    for (const t of touched) reach[t] = Number.NEGATIVE_INFINITY
    touched.length = 0
    return found
  }
  return {
    admits: ({ i, j, d }) => !longer(j, i, -d) && !longer(i, j, d),
    add,
  }
}
