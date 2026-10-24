// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, setKey, sorted } from './keys.js'
import type { PlaneGraph, TwinSet } from './stage-types.js'

/**
 * Stage 5. Within one plane, vertices of the same kind that touch the same set of vertices are
 * twins that do not touch each other (same open neighbourhood); those that touch each other and
 * each other's neighbours are adjacent twins (same closed neighbourhood). A vertex that touches
 * nothing has no neighbours to share, and adjacent twins that share none are left out.
 */
export function findTwins(graph: Pick<PlaneGraph, 'vertices' | 'edges'>): TwinSet[] {
  const near = new Map<string, Set<string>>()
  for (const v of graph.vertices) near.set(v, new Set())
  for (const e of graph.edges) {
    near.get(e.a)?.add(e.b)
    near.get(e.b)?.add(e.a)
  }
  const kindOf = (ref: string) => ref.slice(0, ref.indexOf(':'))

  const open = new Map<string, string[]>()
  const closed = new Map<string, string[]>()
  for (const [v, ns] of near) {
    if (ns.size === 0) continue
    const kind = kindOf(v)
    const openKey = `${kind}\u0001${setKey([...ns])}`
    open.set(openKey, [...(open.get(openKey) ?? []), v])
    const closedKey = `${kind}\u0001${setKey([...ns, v])}`
    closed.set(closedKey, [...(closed.get(closedKey) ?? []), v])
  }

  const twins: TwinSet[] = []
  for (const [adjacent, groups] of [
    [false, open],
    [true, closed],
  ] as const) {
    for (const members of groups.values()) {
      if (members.length < 2) continue
      const own = new Set(members)
      const neighbours = sorted([...(near.get(members[0] ?? '') ?? [])].filter((v) => !own.has(v)))
      if (adjacent && neighbours.length === 0) continue
      twins.push({ members: sorted(members), neighbours, adjacent })
    }
  }
  return twins.sort(
    (a, b) =>
      compare(setKey(a.members), setKey(b.members)) || Number(a.adjacent) - Number(b.adjacent),
  )
}
