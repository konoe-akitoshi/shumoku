// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { compare, crosses, setKey, sorted } from './keys.js'
import type {
  AnalysisGraph,
  Candidate,
  Decomposition,
  GroupId,
  Origin,
  Part,
  Parts,
  Spanning,
  Twins,
  Units,
  VertexRef,
} from './types.js'
import { groupParents, unitRef } from './units.js'

/** The vertices of the unit graph in each written group, with those in the groups inside it. */
function groupMembers(
  network: input.Network,
  analysis: AnalysisGraph,
  units: Units,
  vertices: readonly VertexRef[],
): Map<GroupId, Set<VertexRef>> {
  const parents = groupParents(network)
  const placeOf = new Map<VertexRef, GroupId | undefined>()
  for (const u of units.units) placeOf.set(unitRef(u.id), u.place)
  for (const v of analysis.vertices) if (v.kind !== 'node') placeOf.set(v.ref, v.group)

  const members = new Map<GroupId, Set<VertexRef>>()
  for (const v of vertices) {
    for (let g = placeOf.get(v); g !== undefined; g = parents.get(g)) {
      const set = members.get(g) ?? new Set<VertexRef>()
      set.add(v)
      members.set(g, set)
    }
  }
  return members
}

/** Each side of a cut vertex: what stays together in its component when it is taken out. */
function sidesOf(decomposition: Decomposition): { cut: VertexRef; members: VertexRef[] }[] {
  const near = new Map<VertexRef, VertexRef[]>()
  for (const v of decomposition.vertices) near.set(v, [])
  for (const e of decomposition.edges) {
    near.get(e.a)?.push(e.b)
    near.get(e.b)?.push(e.a)
  }
  const sides: { cut: VertexRef; members: VertexRef[] }[] = []
  for (const { vertex: cut } of decomposition.cutVertices) {
    const seen = new Set<VertexRef>([cut])
    for (const start of sorted(near.get(cut) ?? [])) {
      if (seen.has(start)) continue
      const side = [start]
      seen.add(start)
      for (let i = 0; i < side.length; i++) {
        for (const w of near.get(side[i] as VertexRef) ?? []) {
          if (seen.has(w)) continue
          seen.add(w)
          side.push(w)
        }
      }
      sides.push({ cut, members: sorted(side) })
    }
  }
  return sides
}

/**
 * Stage 5. The candidates are the twins and each side of a cut vertex, of two or more vertices.
 * A candidate that crosses no written group and no other candidate is a part, and so is each
 * group; the parts nest. A candidate that crosses something spans, and is kept as such.
 */
export function derivePartTree(
  network: input.Network,
  analysis: AnalysisGraph,
  units: Units,
  decomposition: Decomposition,
  twins: readonly Twins[],
): Parts {
  const groups = groupMembers(network, analysis, units, decomposition.vertices)

  const found = new Map<string, { members: VertexRef[]; origins: Origin[] }>()
  const offer = (members: readonly VertexRef[], origin: Origin) => {
    if (members.length < 2) return
    const key = setKey(members)
    const entry = found.get(key) ?? { members: sorted(members), origins: [] }
    entry.origins.push(origin)
    found.set(key, entry)
  }
  for (const t of twins) offer(t.members, { kind: 'twins' })
  for (const s of sidesOf(decomposition)) offer(s.members, { kind: 'side', cut: s.cut })
  const candidates: Candidate[] = [...found.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, c]) => ({
      members: c.members,
      origins: c.origins.sort((a, b) =>
        compare(
          `${a.kind}${a.kind === 'side' ? a.cut : ''}`,
          `${b.kind}${b.kind === 'side' ? b.cut : ''}`,
        ),
      ),
    }))

  const candidateSets = candidates.map((c) => new Set(c.members))
  const groupList = [...groups.entries()].sort(([a], [b]) => compare(a, b))
  const spanning: Spanning[] = []
  const kept: Candidate[] = []
  for (const [i, c] of candidates.entries()) {
    const set = candidateSets[i] as Set<VertexRef>
    const crossed: Spanning['crosses'][number][] = []
    for (const [id, g] of groupList) if (crosses(set, g)) crossed.push({ kind: 'group', of: id })
    for (const [j, other] of candidates.entries()) {
      if (j !== i && crosses(set, candidateSets[j] as Set<VertexRef>))
        crossed.push({ kind: 'candidate', of: other.members })
    }
    if (crossed.length > 0) spanning.push({ ...c, crosses: crossed })
    else kept.push(c)
  }

  // One part for each distinct set of members, whether written, derived or both.
  const sets = new Map<string, { members: VertexRef[]; groups: GroupId[]; origins: Origin[] }>()
  const place = (members: readonly VertexRef[]) => {
    const key = setKey(members)
    const entry = sets.get(key) ?? { members: sorted(members), groups: [], origins: [] }
    sets.set(key, entry)
    return entry
  }
  for (const [id, g] of groupList) place([...g]).groups.push(id)
  for (const c of kept) place(c.members).origins.push(...c.origins)

  const ordered = [...sets.values()].sort(
    (a, b) => b.members.length - a.members.length || compare(setKey(a.members), setKey(b.members)),
  )
  const memberSets = ordered.map((p) => new Set(p.members))
  const childrenOf = ordered.map(() => [] as number[])
  const topLevel: number[] = []
  for (const [i, p] of ordered.entries()) {
    // The smallest part before it that holds all of it; parts are laminar, so it is one chain.
    let parent = -1
    for (let j = i - 1; j >= 0; j--) {
      const outer = ordered[j]
      const holds = memberSets[j]
      if (!outer || !holds || outer.members.length === p.members.length) continue
      if (p.members.every((m) => holds.has(m))) {
        parent = j
        break
      }
    }
    if (parent < 0) topLevel.push(i)
    else childrenOf[parent]?.push(i)
  }

  const describe = (members: readonly VertexRef[], kids: readonly number[]) => {
    const inside = new Set(kids.flatMap((k) => ordered[k]?.members ?? []))
    return {
      own: members.filter((m) => !inside.has(m)),
      children: kids
        .map((k) => ordered[k]?.members ?? [])
        .sort((a, b) => compare(setKey(a), setKey(b))),
    }
  }
  const parts: Part[] = ordered
    .map((p, i) => ({
      members: p.members,
      groups: sorted(p.groups),
      origins: p.origins,
      ...describe(p.members, childrenOf[i] ?? []),
    }))
    .sort((a, b) => compare(setKey(a.members), setKey(b.members)))
  const all = [...decomposition.vertices]
  spanning.sort((a, b) => compare(setKey(a.members), setKey(b.members)))
  return {
    parts,
    root: { members: sorted(all), ...describe(all, topLevel) },
    spanning,
  }
}
