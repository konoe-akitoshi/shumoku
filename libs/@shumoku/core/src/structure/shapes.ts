// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, setKey } from './keys.js'
import type { Decomposition, PartShape, Parts, ShapeClass, Shapes, VertexRef } from './types.js'

/** The largest part, in vertices, whose form is made; the search is exact, so it must stay small. */
export const SHAPE_LIMIT = 10

/**
 * The canonical form of a small graph with coloured vertices and counted edges: equal forms if
 * and only if the graphs are the same up to renaming. Colours are refined until they settle,
 * then a vertex of the first cell that is still undecided is told apart in each possible way
 * and the least result is kept. Vertices that can be swapped without changing anything need
 * only one try.
 */
export function canonicalForm(
  labels: readonly string[],
  mult: readonly (readonly number[])[],
): string {
  const n = labels.length
  const names = [...new Set(labels)].sort(compare)
  const start = labels.map((l) => names.indexOf(l))

  const refine = (colours: readonly number[]): number[] => {
    let col = [...colours]
    let classes = new Set(col).size
    while (true) {
      const sigs = col.map((c, i) => {
        const around: string[] = []
        for (let j = 0; j < n; j++) {
          const m = mult[i]?.[j] ?? 0
          if (m > 0) around.push(`${col[j]}x${m}`)
        }
        return `${c}|${around.sort(compare).join(',')}`
      })
      const ranks = [...new Set(sigs)].sort(compare)
      col = sigs.map((s) => ranks.indexOf(s))
      if (ranks.length === classes) return col
      classes = ranks.length
    }
  }

  const swappable = (u: number, t: number) => {
    for (let w = 0; w < n; w++) {
      if (w !== u && w !== t && (mult[u]?.[w] ?? 0) !== (mult[t]?.[w] ?? 0)) return false
    }
    return true
  }

  let best: string | undefined
  const search = (colours: readonly number[]): void => {
    const col = refine(colours)
    const cells = new Map<number, number[]>()
    for (const [v, c] of col.entries()) cells.set(c, [...(cells.get(c) ?? []), v])
    const cell = [...cells.entries()].sort(([a], [b]) => a - b).find(([, vs]) => vs.length > 1)
    if (!cell) {
      const order = col
        .map((c, v) => [c, v] as const)
        .sort(([a], [b]) => a - b)
        .map(([, v]) => v)
      const parts = order.map((v) => labels[v] ?? '')
      for (const [i, v] of order.entries()) {
        for (const w of order.slice(i + 1)) parts.push(String(mult[v]?.[w] ?? 0))
      }
      const form = parts.join('\u0001')
      if (best === undefined || compare(form, best) < 0) best = form
      return
    }
    const tried: number[] = []
    for (const v of cell[1]) {
      if (tried.some((t) => swappable(v, t))) continue
      tried.push(v)
      search(col.map((c, u) => c * 2 + (c === cell[0] && u !== v ? 1 : 0)))
    }
  }
  search(start)
  return `${n}\u0002${best ?? ''}`
}

/** Stage 6. The form inside each part: its vertices by kind, and the lines among them. */
export function deriveShapes(decomposition: Decomposition, parts: Parts): Shapes {
  const lineCount = new Map<string, number>()
  for (const e of decomposition.edges) lineCount.set(`${e.a}\0${e.b}`, e.multiplicity)
  const countBetween = (a: VertexRef, b: VertexRef) =>
    lineCount.get(compare(a, b) <= 0 ? `${a}\0${b}` : `${b}\0${a}`) ?? 0

  const shapes: PartShape[] = parts.parts.map((p) => {
    if (p.members.length > SHAPE_LIMIT) {
      return { part: p.members, form: { kind: 'too-large', size: p.members.length } }
    }
    const labels = p.members.map((m) => m.slice(0, m.indexOf(':')))
    const mult = p.members.map((a) => p.members.map((b) => (a === b ? 0 : countBetween(a, b))))
    return { part: p.members, form: { kind: 'exact', canonical: canonicalForm(labels, mult) } }
  })

  const byForm = new Map<string, VertexRef[][]>()
  for (const s of shapes) {
    if (s.form.kind !== 'exact') continue
    byForm.set(s.form.canonical, [...(byForm.get(s.form.canonical) ?? []), [...s.part]])
  }
  const same: ShapeClass[] = [...byForm.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([canonical, list]) => ({
      canonical,
      parts: list.sort((a, b) => compare(setKey(a), setKey(b))),
    }))
    .sort((a, b) => compare(a.canonical, b.canonical))
  return { limit: SHAPE_LIMIT, shapes, same }
}
