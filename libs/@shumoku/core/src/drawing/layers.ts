// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { NodeId } from '../structure/types.js'
import { type DummyKey, dummyIn, type PortKey, type SideKey } from './keys.js'
import { basisOf } from './layers/basis.js'
import { judgeOf, total } from './layers/cost.js'
import { flatten } from './layers/flatten.js'
import { linesOf } from './layers/lines.js'
import { portGroupsOf } from './layers/ports.js'
import { siftFrom } from './layers/sift.js'
import { startOf } from './layers/start.js'
import { sweepFrom } from './layers/sweep.js'
import type { Element, Lookup } from './layers/types.js'
import type { FrameId, ItemId, Problem } from './problem.js'
import type { Hints, Ranks } from './ranks.js'

export type { Element } from './layers/types.js'

export interface Layers {
  ranks: Ranks
  /** Rank by rank, the elements left to right. A frame's elements lie in one stretch of each. */
  sequences: readonly (readonly Element[])[]
  /** Each frame's children, left to right: item ids, `frameKey`s and dummy keys. Satellites follow their anchor, free items come last. */
  siblings: ReadonlyMap<FrameId, readonly string[]>
  /** The members of each unit, left to right. */
  members: ReadonlyMap<ItemId, readonly NodeId[]>
  /** Where each element stands in its rank's row. */
  position: ReadonlyMap<string, number>
  /** The dummies by key. */
  dummies: ReadonlyMap<DummyKey, Extract<Element, { kind: 'dummy' }>>
  /** The pairs of lines that must cross between two neighbouring ranks, and the cost of passing level lines round what lies between. */
  crossings: number
  /** The ports on the top and bottom of each box, left to right. */
  ports: ReadonlyMap<SideKey, readonly PortKey[]>
  /** The crossings by gap (g between ranks g and g+1), and the cost of level lines by rank. */
  byGap: { gap: readonly number[]; level: readonly number[] }
}

/**
 * The left-to-right order of every rank's row, decided from ranks and places alone, never from a
 * length. One order of each frame's children serves every rank, so a frame is one stretch of each
 * row it reaches and two frames stand the same way round in all of them. The order is swept down
 * and up the ranks, each child moved towards the median place of what its lines lead to, and
 * then neighbours are swapped where that leaves fewer crossings; the sweeps stop when an order
 * comes back with the sweep that follows it, whatever the size.
 */
export function layersOf(
  problem: Problem,
  ranks: Ranks,
  hints: Pick<Hints, 'order' | 'members' | 'under'> = {},
  options: { verify?: boolean } = {},
): Layers {
  // what the lines say of the rows, and the ports they end at
  const basis = basisOf(problem, ranks, hints)
  const wires = linesOf(basis)
  const lookup: Lookup = { ...basis, ...wires, ...portGroupsOf(basis, wires) }

  // the order to start from, then the median sweeps, then sifting from the best of them
  const initial = startOf(lookup)
  const judge = judgeOf(lookup, initial)
  const swept = sweepFrom(lookup, judge, initial)
  const current = siftFrom(lookup, judge, swept, options)

  const flat = flatten(lookup, current)
  const cost = judge.costs(flat)
  // the lines of a dummy are put in id order only now: the stages above read them in the order
  // the lines were met
  const dummies = new Map(
    [...lookup.dummies].map(([key, d]) => [key, { ...d, lines: [...d.lines].sort(compare) }]),
  )
  const elementOf = (k: string): Element => {
    const d = dummyIn(dummies, k)
    return d ?? { kind: 'box', key: k, item: lookup.ownerOf.get(k) ?? k }
  }
  return {
    ranks,
    sequences: flat.seq.map((row) => row.map(elementOf)),
    siblings: new Map(
      [...current.rows].map(([f, r]) => [
        f,
        [...r.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...r.tail],
      ]),
    ),
    members: current.members,
    ports: flat.ports,
    position: flat.pos,
    dummies,
    crossings: total(cost)[1],
    byGap: { gap: cost.gap, level: cost.level },
  }
}
