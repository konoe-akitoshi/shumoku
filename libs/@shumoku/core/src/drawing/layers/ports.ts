// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../../structure/keys.js'
import { type PortKey, type SideKey, sideKey } from '../keys.js'
import { median } from './median.js'
import type { Basis, Ported, PortGroup, Wires } from './types.js'

/** The ports of every top and bottom side of a box, and which of them belong to each rank. */
export function portGroupsOf(
  basis: Pick<Basis, 'ranks' | 'rankOf' | 'ownerOf'>,
  wires: Pick<Wires, 'portInfo'>,
): Ported {
  const portGroups: PortGroup[] = []
  const bySide = new Map<SideKey, { box: string; side: 'top' | 'bottom'; ids: PortKey[] }>()
  for (const [id, info] of [...wires.portInfo].sort((p, q) => compare(p[0], q[0]))) {
    const key = sideKey(info.box, info.side)
    bySide.set(key, { box: info.box, side: info.side, ids: [...(bySide.get(key)?.ids ?? []), id] })
  }
  for (const [key, { box, side, ids }] of bySide)
    portGroups.push({
      key,
      box,
      side,
      ids,
      partners: ids.map((id) => wires.portInfo.get(id)?.partners ?? []),
    })
  const groupsAt: PortGroup[][] = Array.from({ length: basis.ranks.max + 1 }, () => [])
  for (const g of portGroups) groupsAt[basis.rankOf(basis.ownerOf.get(g.box) ?? g.box)]?.push(g)
  return { portGroups, groupsAt }
}

/** The ports of a side in the order of the places their lines lead to. */
export const portsOf = (
  g: PortGroup,
  at: (k: string) => number | undefined,
): readonly PortKey[] => {
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
  sorted: readonly PortKey[],
  at: (k: string) => number | undefined,
): [PortKey, number][] =>
  sorted.map((id, k): [PortKey, number] => [id, (at(g.box) ?? 0) + (k + 0.5) / sorted.length])
