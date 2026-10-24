// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, setKey, sorted } from './keys.js'
import type { Decomposition, Twins } from './types.js'

/**
 * Stage 4. Vertices of the same kind that touch the same set of vertices are twins. A vertex
 * that touches nothing has no neighbours to share.
 */
export function findTwins(decomposition: Decomposition): Twins[] {
  const near = new Map<string, Set<string>>()
  for (const v of decomposition.vertices) near.set(v, new Set())
  for (const e of decomposition.edges) {
    near.get(e.a)?.add(e.b)
    near.get(e.b)?.add(e.a)
  }
  const kindOf = (ref: string) => ref.slice(0, ref.indexOf(':'))

  const byNeighbours = new Map<string, string[]>()
  for (const [v, ns] of near) {
    if (ns.size === 0) continue
    const key = `${kindOf(v)}\u0001${setKey([...ns])}`
    byNeighbours.set(key, [...(byNeighbours.get(key) ?? []), v])
  }
  const twins: Twins[] = []
  for (const members of byNeighbours.values()) {
    if (members.length < 2) continue
    const first = members[0]
    twins.push({
      members: sorted(members),
      neighbours: sorted(near.get(first ?? '') ?? []),
    })
  }
  return twins.sort((a, b) => compare(setKey(a.members), setKey(b.members)))
}
