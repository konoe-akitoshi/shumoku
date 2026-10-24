// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { compare, setKey } from './keys.js'
import type {
  AnalysisGraph,
  PlaneStage,
  ShapeClass,
  Shapes,
  StageSubject,
  SubjectShape,
  Units,
  VertexRef,
} from './stage-types.js'
import type { GroupId } from './types.js'
import { groupParents, unitRef } from './units.js'

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

/** The vertices in each written group, with those in the groups inside it. */
function groupVertices(
  network: input.Network,
  analysis: AnalysisGraph,
  units: Units,
): Map<GroupId, VertexRef[]> {
  const parents = groupParents(network)
  const placeOf = new Map<VertexRef, GroupId | undefined>()
  for (const u of units.units) placeOf.set(unitRef(u.id), u.place)
  for (const v of analysis.vertices) if (v.kind !== 'node') placeOf.set(v.ref, v.group)

  const members = new Map<GroupId, VertexRef[]>()
  for (const [v, place] of placeOf) {
    for (let g = place; g !== undefined; g = parents.get(g)) {
      members.set(g, [...(members.get(g) ?? []), v])
    }
  }
  for (const [g, vs] of members) members.set(g, vs.sort(compare))
  return members
}

const kindOf = (ref: VertexRef) => ref.slice(0, ref.indexOf(':'))

/**
 * Stage 6. The form inside each written group and each bundle of twins. A group's inside is the
 * units placed in it (and the segments and routing domains written in it), with the lines among
 * them in the default plane. A bundle's inside is its members and the neighbours they share,
 * with the lines among them in its plane, the shared neighbours told apart from the members.
 * Subjects that are too large get no form and are not compared.
 */
export function deriveShapes(
  network: input.Network,
  analysis: AnalysisGraph,
  units: Units,
  planes: readonly PlaneStage[],
): Shapes {
  const countIn = (plane: PlaneStage | undefined) => {
    const lineCount = new Map<string, number>()
    for (const e of plane?.edges ?? []) lineCount.set(`${e.a}\0${e.b}`, e.multiplicity)
    return (a: VertexRef, b: VertexRef) =>
      lineCount.get(compare(a, b) <= 0 ? `${a}\0${b}` : `${b}\0${a}`) ?? 0
  }
  const formOf = (
    labels: readonly string[],
    vertices: readonly VertexRef[],
    plane?: PlaneStage,
  ) => {
    if (vertices.length > SHAPE_LIMIT) {
      return { kind: 'too-large', size: vertices.length } as const
    }
    const between = countIn(plane)
    const mult = vertices.map((a) => vertices.map((b) => (a === b ? 0 : between(a, b))))
    return { kind: 'exact', canonical: canonicalForm(labels, mult) } as const
  }

  const shapes: SubjectShape[] = []
  const defaultPlane = planes.find((p) => p.plane === 'default')
  const groups = [...groupVertices(network, analysis, units).entries()].sort(([a], [b]) =>
    compare(a, b),
  )
  for (const [id, vertices] of groups) {
    shapes.push({
      subject: { group: id },
      vertices,
      form: formOf(vertices.map(kindOf), vertices, defaultPlane),
    })
  }
  const seen = new Set<string>()
  for (const plane of planes) {
    for (const t of plane.twins) {
      const key = `${setKey(t.members)}\u0001${t.adjacent}`
      if (seen.has(key)) continue
      seen.add(key)
      const vertices = [...t.members, ...t.neighbours]
      const labels = [
        ...t.members.map((m) => `twin:${kindOf(m)}`),
        ...t.neighbours.map((m) => `with:${kindOf(m)}`),
      ]
      shapes.push({
        subject: { twins: t.members },
        vertices,
        form: formOf(labels, vertices, plane),
      })
    }
  }
  return { limit: SHAPE_LIMIT, shapes, same: sameForm(shapes) }
}

function sameForm(shapes: readonly SubjectShape[]): ShapeClass[] {
  const byForm = new Map<string, SubjectShape[]>()
  for (const s of shapes) {
    if (s.form.kind !== 'exact') continue
    byForm.set(s.form.canonical, [...(byForm.get(s.form.canonical) ?? []), s])
  }
  const same: ShapeClass[] = []
  for (const [canonical, list] of byForm) {
    if (list.length < 2) continue
    // Subjects with the very same insides, such as a group holding only another, are one thing.
    if (new Set(list.map((s) => setKey(s.vertices))).size < 2) continue
    same.push({
      canonical,
      subjects: list
        .sort((x, y) => compare(subjectKey(x.subject), subjectKey(y.subject)))
        .map((s) => s.subject),
    })
  }
  return same.sort((a, b) => compare(a.canonical, b.canonical))
}

const subjectKey = (s: StageSubject) => ('group' in s ? `g\0${s.group}` : `t\0${setKey(s.twins)}`)
