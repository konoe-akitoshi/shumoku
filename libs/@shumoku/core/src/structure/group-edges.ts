// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { routingDomainRef, segmentRef } from './analysis-graph.js'
import { compare } from './keys.js'
import type {
  AnalysisGraph,
  Beyond,
  End,
  GroupEdge,
  PlaneStage,
  Units,
  VertexRef,
} from './stage-types.js'
import type { GroupId, NodeId, UnitId } from './types.js'
import { groupParents, unitRef } from './units.js'

const beyondKey = (b: Beyond): string => ('group' in b ? `g\0${b.group}` : `v\0${b.vertex}`)

/**
 * Stage 11. For each group, the units inside it that have a line (not a virtual one) leaving it
 * in the default plane, and what each reaches: the place beside the group that holds the other
 * end (the highest group holding it that does not hold this group), or the other end itself
 * when it has no such place. A redundancy set folded into one unit also lists, for each of its
 * nodes, what that node reaches, when the nodes do not all reach the same.
 */
export function findGroupEdges(
  network: input.Network,
  analysis: Pick<AnalysisGraph, 'vertices'>,
  units: Units,
  plane: Pick<PlaneStage, 'edges'> | undefined,
): GroupEdge[] {
  if (!plane) return []
  const parents = groupParents(network)
  const chain = (g: GroupId | undefined): GroupId[] => {
    const out: GroupId[] = []
    for (let p = g; p !== undefined; p = parents.get(p)) out.push(p)
    return out
  }
  const unitOfNode = new Map<NodeId, UnitId>()
  const unitById = new Map(units.units.map((u) => [u.id, u]))
  const placeOf = new Map<VertexRef, GroupId | undefined>()
  for (const u of units.units) {
    for (const m of u.members) unitOfNode.set(m, u.id)
    placeOf.set(unitRef(u.id), u.place)
  }
  for (const v of analysis.vertices)
    if (v.kind === 'segment') placeOf.set(segmentRef(v.id), v.group)
  const refOf = (end: End): VertexRef | undefined => {
    if ('segment' in end) return segmentRef(end.segment)
    if ('routingDomain' in end) return routingDomainRef(end.routingDomain)
    const unit = unitOfNode.get(end.node)
    return unit === undefined ? undefined : unitRef(unit)
  }

  // group, unit -> what the unit reaches, in total and node by node.
  const reach = new Map<string, Map<string, Beyond>>()
  const byNode = new Map<string, Map<NodeId, Map<string, Beyond>>>()
  const subject = new Map<string, { group: GroupId; unit: UnitId }>()
  for (const line of plane.edges.flatMap((e) => e.lines)) {
    if (line.virtual) continue
    for (const [self, other] of [
      [line.ends[0], line.ends[1]],
      [line.ends[1], line.ends[0]],
    ] as const) {
      if (!('node' in self)) continue
      const unit = unitOfNode.get(self.node)
      const there = refOf(other)
      if (unit === undefined || there === undefined || there === unitRef(unit)) continue
      const ownPlace = unitById.get(unit)?.place
      if (ownPlace === undefined) continue
      const thereChain = chain(placeOf.get(there))
      for (const group of chain(ownPlace)) {
        if (thereChain.includes(group)) continue
        const holdsGroup = new Set(chain(group))
        const beside = [...thereChain].reverse().find((g) => !holdsGroup.has(g))
        const target: Beyond = beside === undefined ? { vertex: there } : { group: beside }
        const key = `${group}\0${unit}`
        subject.set(key, { group, unit })
        const all = reach.get(key) ?? new Map()
        all.set(beyondKey(target), target)
        reach.set(key, all)
        const nodes = byNode.get(key) ?? new Map<NodeId, Map<string, Beyond>>()
        const mine = nodes.get(self.node) ?? new Map()
        mine.set(beyondKey(target), target)
        nodes.set(self.node, mine)
        byNode.set(key, nodes)
      }
    }
  }

  const list = (m: ReadonlyMap<string, Beyond> | undefined): Beyond[] =>
    [...(m ?? [])].sort(([a], [b]) => compare(a, b)).map(([, b]) => b)
  const keyOf = (bs: readonly Beyond[]) => bs.map(beyondKey).join('\u0001')

  return [...subject.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([key, { group, unit }]): GroupEdge => {
      const toward = list(reach.get(key))
      const members = unitById.get(unit)?.members ?? []
      const perNode = members.map((node) => ({
        node,
        toward: list(byNode.get(key)?.get(node)),
      }))
      const differ =
        unitById.get(unit)?.kind === 'redundancy' &&
        new Set(perNode.map((m) => keyOf(m.toward))).size > 1
      return differ ? { group, unit, toward, members: perNode } : { group, unit, toward }
    })
}
