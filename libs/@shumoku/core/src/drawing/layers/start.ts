// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../../structure/keys.js'
import type { NodeId } from '../../structure/types.js'
import { dummyIn, frameIn, frameKey } from '../keys.js'
import { must } from '../must.js'
import type { FrameId, ItemId } from '../problem.js'
import { inHintOrder } from './order.js'
import type { Basis, Cluster, Row, State, Wires } from './types.js'

/**
 * The order the hints name, laid over the movable children of a frame: the named children stand
 * in the hint's order, and the fewest of them are moved to get there. Those already in that order
 * (the longest such run) stay where they are; each of the rest is taken out and put just after
 * the child the hint names before it, or, named first, just before the one it names after it.
 * Children the hint does not name keep their places; names it has that the frame lacks are
 * ignored. Without a hint for the frame the children are returned as they came.
 */
export function pinned(
  basis: Pick<Basis, 'hints'>,
  frame: FrameId,
  movable: readonly Cluster[],
): readonly Cluster[] {
  const hint = basis.hints.order?.get(frame)
  if (!hint) return movable
  const wanted = new Map(hint.map((id, i) => [id, i] as const))
  const named = movable.filter((c) => wanted.has(c.anchor))
  if (named.length < 2) return movable
  const rankOf = (c: Cluster) => wanted.get(c.anchor) ?? -1
  const kept = inHintOrder(
    named.map((c) => c.anchor),
    hint,
  )

  // the rest, in the hint's order, each put beside what the hint names next to it
  let out = movable.filter((c) => !wanted.has(c.anchor) || kept.has(c.anchor))
  const movers = named.filter((c) => !kept.has(c.anchor)).sort((p, q) => rankOf(p) - rankOf(q))
  for (const c of movers) {
    const placed = new Map(out.map((d, i) => [d.anchor, i] as const))
    const before = hint
      .slice(0, rankOf(c))
      .reverse()
      .find((id) => placed.has(id))
    const after = hint.slice(rankOf(c) + 1).find((id) => placed.has(id))
    const at =
      before !== undefined
        ? (placed.get(before) ?? -1) + 1
        : after !== undefined
          ? (placed.get(after) ?? 0)
          : out.length
    out = [...out.slice(0, at), c, ...out.slice(at)]
  }
  return out
}

/** What the start reads: the problem as looked up, and the dummies, which stand among the children. */
export type StartIn = Pick<
  Basis,
  'problem' | 'tree' | 'anchors' | 'items' | 'frameOfKey' | 'rankOf' | 'hints'
> &
  Pick<Wires, 'dummies'>

/** The order to start from: the flow, followed in id order, from the boundary. */
export function startOf(basis: StartIn): State {
  const { problem, tree, anchors, items, frameOfKey, rankOf } = basis
  const free = new Set(problem.free)
  const next = new Map<string, Set<string>>()
  const link = (a: string, c: string) => {
    next.set(a, (next.get(a) ?? new Set()).add(c))
    next.set(c, (next.get(c) ?? new Set()).add(a))
  }
  const flowDown = new Map<string, Set<string>>()
  for (const { upper, lower } of problem.above) {
    flowDown.set(upper, (flowDown.get(upper) ?? new Set()).add(lower))
    link(upper, lower)
  }
  for (const { a, b: c } of problem.level) link(a, c)
  for (const s of problem.satellites) link(s.item, s.partner)
  const visit = new Map<string, number>()
  const walk = (id: string) => {
    if (visit.has(id)) return
    visit.set(id, visit.size)
    const out = flowDown.get(id)
    for (const n of [...(out ?? [])].sort(compare)) walk(n)
    for (const n of [...(next.get(id) ?? [])].sort(compare)) walk(n)
  }
  const ids = problem.items.map((i) => i.id).sort(compare)
  // the roots stand in the order the reader named the boundary, then the rest of rank 0 by id
  for (const id of problem.boundary.filter((i) => items.has(i))) walk(id)
  for (const id of ids.filter((i) => rankOf(i) === 0)) walk(id)
  for (const id of ids) walk(id)
  const firstVisit = (key: string): number => {
    const f = frameIn(frameOfKey, key)
    if (f !== undefined)
      return Math.min(
        Number.POSITIVE_INFINITY,
        ...(tree.within.get(f) ?? []).map((i) => visit.get(i.id) ?? 0),
      )
    const d = dummyIn(basis.dummies, key)
    if (d) {
      const l = problem.lines.find((x) => x.id === d.lines[0])
      return l
        ? (must(visit, l.a.item, 'visit of item') + must(visit, l.b.item, 'visit of item')) / 2
        : 0
    }
    return must(visit, key, 'visit of item')
  }

  const rows: Map<FrameId, Row> = new Map()
  for (const frame of problem.frames) {
    const here = tree.itemsIn.get(frame.id) ?? []
    const keys = [
      ...here.filter((i) => !anchors.has(i.id) && !free.has(i.id)).map((i) => i.id),
      ...(tree.framesIn.get(frame.id) ?? []).map((f) => frameKey(f.id)),
      ...[...basis.dummies.values()].filter((d) => d.frame === frame.id).map((d) => d.key),
    ].sort((p, q) => firstVisit(p) - firstVisit(q) || compare(p, q))
    const satellitesOf = (anchor: string) =>
      [...anchors]
        .filter(([sat, a]) => a === anchor && tree.parentOf.get(sat) === frame.id)
        .map(([sat]) => sat)
        .sort(compare)
    const movable = keys.map((anchor): Cluster => ({ anchor, satellites: satellitesOf(anchor) }))
    rows.set(frame.id, {
      movable,
      // A free item keeps what sits on it beside it, as a movable one does.
      tail: here
        .filter((i) => free.has(i.id))
        .map((i) => i.id)
        .sort(compare)
        .flatMap((id) => [id, ...satellitesOf(id)]),
    })
  }
  const members = new Map<ItemId, NodeId[]>(
    problem.items.flatMap((i): [ItemId, NodeId[]][] =>
      i.kind === 'unit'
        ? [
            [
              i.id,
              [
                ...(basis.hints.members?.get(i.id) ??
                  i.members.map((m) => m.node.id).sort(compare)),
              ],
            ],
          ]
        : [],
    ),
  )
  return {
    rows: new Map([...rows].map(([f, r]) => [f, { ...r, movable: pinned(basis, f, r.movable) }])),
    members,
  }
}
