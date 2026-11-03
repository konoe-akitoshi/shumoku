// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { columnKey } from '../corridors.js'
import type { Ledger } from '../ledger.js'
import { type Var, varKey } from '../tracks.js'
import type { Plan } from './plan.js'
import { type Axis, type Sep, same } from './system.js'
import type { Step } from './widths.js'

interface Elem {
  /** The box (the unit, for its members) or the run. */
  readonly key: string
  readonly rank: number
  readonly pos: number
}
interface Link {
  readonly upper: Var
  readonly lower: Var
  readonly up: Elem
  readonly low: Elem
}

const elemOf = (pl: Pick<Plan, 'tracks' | 'corridors'>, v: Var): Elem | undefined => {
  const { tracks, corridors } = pl
  if (v.kind === 'port') {
    const ent = tracks.entities.get(v.id)
    const info = ent ? corridors.boxes.get(ent.box) : undefined
    if (!ent || !info) return undefined
    return { key: info.item, rank: info.rank, pos: (corridors.slotOf.get(ent.box) ?? 0) * 1000 }
  }
  const lane = tracks.lanes.get(v.key)
  const node = lane ? corridors.nodes[lane.node] : undefined
  if (!lane || node?.kind !== 'column') return undefined
  const at = (tracks.columns.get(lane.node) ?? []).indexOf(v.key)
  return {
    key: v.key,
    rank: node.rank,
    pos: (corridors.slotOf.get(columnKey(lane.node)) ?? 0) * 1000 + 1 + at,
  }
}
const sideOf = (pl: Pick<Plan, 'tracks'>, v: Var) =>
  v.kind === 'port' ? pl.tracks.entities.get(v.id)?.side : undefined

/** The steps between neighbouring ranks, by the lower element's key. */
function linksByLower(
  pl: Pick<Plan, 'tracks' | 'corridors'>,
  steps: readonly Step[],
): Map<string, Link[]> {
  const linksOf = new Map<string, Link[]>()
  for (const st of steps) {
    const [ea, eb] = [elemOf(pl, st.a), elemOf(pl, st.b)]
    if (!ea || !eb || Math.abs(ea.rank - eb.rank) !== 1) continue
    const [upper, lower, up, low] = ea.rank < eb.rank ? [st.a, st.b, ea, eb] : [st.b, st.a, eb, ea]
    if (sideOf(pl, upper) !== undefined && sideOf(pl, upper) !== 'bottom') continue
    if (sideOf(pl, lower) !== undefined && sideOf(pl, lower) !== 'top') continue
    linksOf.set(low.key, [...(linksOf.get(low.key) ?? []), { upper, lower, up, low }])
  }
  return linksOf
}

/** The lower elements of each gap (by the rank of the gap's top), with the coordinates they take. */
function lowerElements(
  pl: Pick<Plan, 'layers' | 'tracks' | 'corridors'>,
  linksOf: ReadonlyMap<string, Link[]>,
) {
  const { layers, tracks, corridors } = pl
  const lowerElems = new Map<number, { elem: Elem; vars: Var[] }[]>()
  const seenLow = new Set<string>()
  for (const links of linksOf.values()) {
    for (const l of links) {
      if (seenLow.has(l.low.key)) continue
      seenLow.add(l.low.key)
      let vars: Var[]
      if (l.lower.kind === 'port') {
        const members = layers.members.get(l.low.key) ?? [
          corridors.boxes.get(l.low.key)?.item ?? '',
        ]
        const keys = layers.members.has(l.low.key) ? members : [l.low.key]
        vars = keys.flatMap((k) =>
          (tracks.ports.get(`${k}\0top`) ?? []).map((id): Var => ({ kind: 'port', id })),
        )
      } else vars = [l.lower]
      const list = lowerElems.get(l.low.rank - 1) ?? []
      list.push({ elem: l.low, vars })
      lowerElems.set(l.low.rank - 1, list)
    }
  }
  return lowerElems
}

/** What alignment reads of the plan. */
export type AlignPlan = Pick<Plan, 'tracks' | 'corridors' | 'layers'>

/**
 * Alignment, after Brandes and Koepf: down the gaps, each box (or run) takes the line at the
 * median of its top edge to stand straight with, if that keeps the lines from crossing and
 * forms no ring (the ledger says whether the equality fits); a box gives one line down and takes
 * one up. Returns the equalities chosen, and holds them in the ledger.
 */
export function alignDown(pl: AlignPlan, X: Axis, steps: readonly Step[], held: Ledger): Sep[] {
  const linksOf = linksByLower(pl, steps)
  const lowerElems = lowerElements(pl, linksOf)
  const straight: Sep[] = []
  const usedDown = new Set<string>()
  const usedUp = new Set<string>()
  for (let g = 0; g < pl.layers.ranks.max; g++) {
    const row = (lowerElems.get(g) ?? []).sort((p, q) => p.elem.pos - q.elem.pos)
    let last = -1
    for (const { elem, vars } of row) {
      if (usedUp.has(elem.key) || vars.length === 0) continue
      const medians = [
        ...new Set([Math.floor((vars.length - 1) / 2), Math.ceil((vars.length - 1) / 2)]),
      ]
      let done = false
      for (const m of medians) {
        const v = vars[m]
        if (!v || done) continue
        const link = (linksOf.get(elem.key) ?? []).find(
          (l) => varKey(l.lower) === varKey(v) && l.up.pos > last && !usedDown.has(l.up.key),
        )
        if (!link) continue
        const eq = same(X.at(link.upper), X.at(link.lower))
        if (eq.i !== eq.j && !held.admits(eq)) continue
        if (eq.i !== eq.j) {
          held.add(eq)
          straight.push(eq)
        }
        usedDown.add(link.up.key)
        usedUp.add(elem.key)
        last = link.up.pos
        done = true
      }
    }
  }
  return straight
}
