// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../../structure/keys.js'
import { median } from './median.js'
import type { Basis, Ported, PortGroup, Wires } from './types.js'

/** The ports of every top and bottom side of a box, and which of them belong to each rank. */
export function portGroupsOf(b: Basis, w: Pick<Wires, 'portInfo'>): Ported {
  const portGroups: PortGroup[] = []
  const byBox = new Map<string, string[]>()
  const sides = new Map<string, 'top' | 'bottom'>()
  for (const [id, info] of [...w.portInfo].sort((p, q) => compare(p[0], q[0]))) {
    const key = `${info.box}\0${info.side}`
    byBox.set(key, [...(byBox.get(key) ?? []), id])
    sides.set(key, info.side)
  }
  for (const [key, ids] of byBox)
    portGroups.push({
      key,
      box: key.slice(0, key.indexOf('\0')),
      side: sides.get(key) ?? 'top',
      ids,
      partners: ids.map((id) => w.portInfo.get(id)?.partners ?? []),
    })
  const groupsAt: PortGroup[][] = Array.from({ length: b.ranks.max + 1 }, () => [])
  for (const g of portGroups) groupsAt[b.rankOf(b.ownerOf.get(g.box) ?? g.box)]?.push(g)
  return { portGroups, groupsAt }
}

/** The ports of a side in the order of the places their lines lead to. */
export const portsOf = (g: PortGroup, at: (k: string) => number | undefined): string[] => {
  if (g.ids.length < 2) return g.ids
  const where = g.partners.map((ps) => {
    if (ps.length === 1) return at(ps[0] ?? '') ?? 0
    return median(ps.map((k) => at(k) ?? 0))
  })
  return g.ids
    .map((id, i) => ({ id, at: where[i] ?? 0, i }))
    .sort((p, q) => p.at - q.at || p.i - q.i)
    .map((e) => e.id)
}

/** Where each port of a side stands: its box's place and a part of it. */
export const endsOf = (
  g: PortGroup,
  sorted: readonly string[],
  at: (k: string) => number | undefined,
): [string, number][] =>
  sorted.map((id, k): [string, number] => [id, (at(g.box) ?? 0) + (k + 0.5) / sorted.length])
