// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../../structure/keys.js'
import type { NodeId } from '../../structure/types.js'
import { dummyIn, frameIn, frameKey } from '../keys.js'
import type { FrameId, ItemId } from '../problem.js'
import type { Basis, Cluster, Row, State, Wires } from './types.js'

/** The order the hints name, laid over the movable children of a frame. */
export function pinned(
  basis: Pick<Basis, 'hints'>,
  frame: FrameId,
  movable: readonly Cluster[],
): readonly Cluster[] {
  const hint = basis.hints.order?.get(frame)
  if (!hint) return movable
  const slots = movable.flatMap((c, i) => (hint.includes(c.anchor) ? [i] : []))
  const named = movable
    .filter((c) => hint.includes(c.anchor))
    .sort((p, q) => hint.indexOf(p.anchor) - hint.indexOf(q.anchor))
  const out = [...movable]
  for (const [i, slot] of slots.entries()) {
    const c = named[i]
    if (c) out[slot] = c
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
      return l ? ((visit.get(l.a.item) ?? 0) + (visit.get(l.b.item) ?? 0)) / 2 : 0
    }
    return visit.get(key) ?? 0
  }

  const rows: Map<FrameId, Row> = new Map()
  for (const frame of problem.frames) {
    const here = tree.itemsIn.get(frame.id) ?? []
    const keys = [
      ...here.filter((i) => !anchors.has(i.id) && !free.has(i.id)).map((i) => i.id),
      ...(tree.framesIn.get(frame.id) ?? []).map((f) => frameKey(f.id)),
      ...[...basis.dummies.values()].filter((d) => d.frame === frame.id).map((d) => d.key),
    ].sort((p, q) => firstVisit(p) - firstVisit(q) || compare(p, q))
    const movable = keys.map(
      (anchor): Cluster => ({
        anchor,
        satellites: [...anchors]
          .filter(([sat, a]) => a === anchor && tree.parentOf.get(sat) === frame.id)
          .map(([sat]) => sat)
          .sort(compare),
      }),
    )
    rows.set(frame.id, {
      movable,
      tail: here
        .filter((i) => free.has(i.id))
        .map((i) => i.id)
        .sort(compare),
    })
  }
  const members = new Map<ItemId, NodeId[]>(
    problem.items
      .filter((i) => i.kind === 'unit')
      .map((i) => [
        i.id,
        [
          ...(basis.hints.members?.get(i.id) ??
            (i.members ?? []).map((m) => m.node.id).sort(compare)),
        ],
      ]),
  )
  return {
    rows: new Map([...rows].map(([f, r]) => [f, { ...r, movable: pinned(basis, f, r.movable) }])),
    members,
  }
}
