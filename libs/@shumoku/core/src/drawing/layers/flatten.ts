// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { FrameId } from '../problem.js'
import { endsOf, portsOf } from './ports.js'
import type { Lookup, State, Whole } from './types.js'

/** What flattening reads of the problem: the things that can stand in a row, and the ports. */
export type FlattenIn = Pick<
  Lookup,
  'ranks' | 'dummies' | 'items' | 'frameOfKey' | 'rankOf' | 'portGroups'
>

/** The rows, from an order: every rank'state elements left to right, and where each stands. */
export function flatten(lookup: FlattenIn, state: State): Whole {
  const { dummies, items, frameOfKey, rankOf } = lookup
  const seq: string[][] = Array.from({ length: lookup.ranks.max + 1 }, () => [])
  const emit = (key: string) => {
    const inner = frameOfKey.get(key)
    if (inner !== undefined) return visitFrame(inner)
    const d = dummies.get(key)
    if (d) return void seq[d.rank]?.push(key)
    const item = items.get(key)
    if (!item) return
    if (item.kind === 'unit')
      for (const m of state.members.get(key) ?? []) seq[rankOf(key)]?.push(m)
    else seq[rankOf(key)]?.push(key)
  }
  const visitFrame = (f: FrameId) => {
    const row = state.rows.get(f)
    if (!row) return
    for (const c of row.movable) for (const k of [c.anchor, ...c.satellites]) emit(k)
    for (const k of row.tail) emit(k)
  }
  visitFrame('')
  const pos = new Map<string, number>()
  for (const row of seq) for (const [i, k] of row.entries()) pos.set(k, i)
  // the ports of a side stand in the order of the places their lines lead to
  const ports = new Map<string, readonly string[]>()
  const end = new Map<string, number>()
  for (const g of lookup.portGroups) {
    const sorted = portsOf(g, (k) => pos.get(k))
    ports.set(g.key, sorted)
    for (const [id, at] of endsOf(g, sorted, (k) => pos.get(k))) end.set(id, at)
  }
  return { seq, pos, end, ports }
}
