// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { compare, sorted } from './keys.js'
import type { Unit, Units } from './stage-types.js'
import type { GroupId, NodeId, RedundancyId, UnitId } from './types.js'

export const unitRef = (id: string) => `unit:${id}`

/** The group each group is written inside, by id. */
export function groupParents(network: input.Network): Map<GroupId, GroupId | undefined> {
  const parents = new Map<GroupId, GroupId | undefined>()
  const walk = (groups: readonly input.Group[] | undefined, parent: GroupId | undefined) => {
    for (const g of groups ?? []) {
      parents.set(g.id, parent)
      walk(g.groups, g.id)
    }
  }
  walk(network.groups, undefined)
  return parents
}

/** The smallest group that holds all of the places; none when a place is outside every group. */
export function commonPlace(
  places: readonly (GroupId | undefined)[],
  parents: ReadonlyMap<GroupId, GroupId | undefined>,
): GroupId | undefined {
  const chains = places.map((p) => {
    const chain: GroupId[] = []
    for (let g = p; g !== undefined; g = parents.get(g)) chain.push(g)
    return chain
  })
  const [first, ...rest] = chains
  if (!first) return undefined
  return first.find((g) => rest.every((c) => c.includes(g)))
}

/**
 * Stage 2. A node folds into its host, down to the lowest host. A redundancy set folds into one
 * unit only when its nodes are in the same place (their group, or the host's when they have
 * none); a node that is a member of a folded set is that set's unit. A set whose nodes are in
 * different places, and sets that share a node, stay as separate nodes.
 */
export function deriveUnits(network: input.Network): Units {
  const nodes = new Map(network.nodes.map((n) => [n.id, n]))
  const sets = new Map((network.redundancy ?? []).map((r) => [r.id, r]))
  const parents = groupParents(network)

  // Where a node or a set is: the node's group, or its host's; a set's members' when they agree.
  const placeMemo = new Map<string, GroupId | undefined>()
  const placing = new Set<string>()
  const placeOf = (id: string): GroupId | undefined => {
    if (placeMemo.has(id)) return placeMemo.get(id)
    if (placing.has(id)) return undefined
    placing.add(id)
    let place: GroupId | undefined
    const set = sets.get(id)
    if (set) {
      const places = set.nodes.map(placeOf)
      place = places.every((p) => p === places[0]) ? places[0] : undefined
    } else {
      const node = nodes.get(id)
      place = node?.group ?? (node?.host === undefined ? undefined : placeOf(node.host))
    }
    placing.delete(id)
    placeMemo.set(id, place)
    return place
  }

  const samePlace = new Map<RedundancyId, boolean>()
  for (const set of sets.values()) {
    const places = set.nodes.map(placeOf)
    samePlace.set(
      set.id,
      places.every((p) => p === places[0]),
    )
  }
  const memberOf = new Map<NodeId, RedundancyId[]>()
  for (const set of sets.values()) {
    if (!samePlace.get(set.id)) continue
    for (const n of set.nodes) memberOf.set(n, [...(memberOf.get(n) ?? []), set.id])
  }
  const folded = new Map<RedundancyId, input.Redundancy>()
  const kept: Units['kept'][number][] = []
  for (const set of sets.values()) {
    if (!samePlace.get(set.id)) kept.push({ redundancy: set.id, why: 'places' })
    else if (set.nodes.some((n) => (memberOf.get(n)?.length ?? 0) > 1))
      kept.push({ redundancy: set.id, why: 'overlap' })
    else folded.set(set.id, set)
  }
  const foldedOf = new Map<NodeId, RedundancyId>()
  for (const set of folded.values()) for (const n of set.nodes) foldedOf.set(n, set.id)

  const unitMemo = new Map<NodeId, UnitId>()
  const unitOf = (id: NodeId): UnitId => {
    const known = unitMemo.get(id)
    if (known !== undefined) return known
    unitMemo.set(id, id)
    const set = foldedOf.get(id)
    let unit: UnitId = id
    if (set !== undefined) unit = set
    else {
      const host = nodes.get(id)?.host
      if (host !== undefined) {
        if (nodes.has(host)) unit = unitOf(host)
        else if (folded.has(host)) unit = host
      }
    }
    unitMemo.set(id, unit)
    return unit
  }

  const byUnit = new Map<UnitId, NodeId[]>()
  for (const id of nodes.keys()) {
    const unit = unitOf(id)
    byUnit.set(unit, [...(byUnit.get(unit) ?? []), id])
  }
  const units: Unit[] = []
  for (const [id, members] of byUnit) {
    const place = commonPlace(
      members.map((m) => placeOf(m)),
      parents,
    )
    units.push({
      id,
      kind: folded.has(id) ? 'redundancy' : members.length > 1 ? 'host' : 'node',
      members: sorted(members),
      ...(place === undefined ? {} : { place }),
    })
  }
  units.sort((a, b) => compare(a.id, b.id))
  kept.sort((a, b) => compare(a.redundancy, b.redundancy))
  return { units, kept }
}
