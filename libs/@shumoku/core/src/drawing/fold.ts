// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { FrameId, ItemId, Problem } from './problem.js'
import type { Ranks } from './ranks.js'

/**
 * The most boxes of one fan that stand side by side in a row once it is folded. A count, not a
 * length, like every other choice made before the coordinates; it is the same whatever the boxes
 * measure. Measured on a network whose switches carry fans of 7, 11 and 14 terminals: the drawing
 * came to 26376 wide with none folded, 23216 at 10, 20787 at 5 (and the least area), 20062 at 3
 * but taller; below 5 the rows cost more height than they save width.
 */
export const FAN_WIDTH = 5

/**
 * The widest fan left in one row. A fan one box past `FAN_WIDTH` would fold into two short rows
 * for no gain in width worth the height, so folding starts above this.
 */
export const FAN_FOLD = FAN_WIDTH + 1

/**
 * What a fold decides: the least rank of each box dealt to a later row (`rank`, a `ranksOf` hint)
 * and, for each of them, the box of the first row it stands under (`under`, a `layersOf` hint:
 * the rows are one block, row after row in one column, not a staircase).
 */
export interface Fold {
  rank: Map<ItemId, number>
  under: Map<ItemId, ItemId>
  /** The boxes of each folded fan, every row (a `ranksOf` hint: the rows stand one above the other). */
  fans: ItemId[][]
}

/**
 * Where a wide fan folds, and how its rows stand: see `Fold`.
 *
 * A fan is the boxes of one frame that stand at one rank, hand nothing on (no box below them),
 * are tied to nothing by a level or a host, and are handed to by exactly the same boxes: the
 * terminals on one switch. A fan of `n` boxes wider than `FAN_FOLD` folds into `ceil(n /
 * FAN_WIDTH)` rows, as equal as they can be with the larger rows first. The boxes are dealt to the
 * rows in the order the frame's `order` names them, then by id, so the same input folds the same
 * way and a box a person drops into a later row is cut into it again. The first row keeps its
 * rank and gets no entry; a box in a later row gets its rank plus the row.
 */
export function foldsOf(
  problem: Problem,
  ranks: Pick<Ranks, 'rank'>,
  order: ReadonlyMap<FrameId, readonly string[]> = new Map(),
  width: number = FAN_WIDTH,
  fold: number = FAN_FOLD,
): Fold {
  const handsOn = new Set(problem.above.map((e) => e.upper))
  const tied = new Set<ItemId>(problem.free)
  for (const { a, b } of problem.level) {
    tied.add(a)
    tied.add(b)
  }
  for (const s of problem.satellites) {
    tied.add(s.item)
    tied.add(s.partner)
  }
  const uppers = new Map<ItemId, string[]>()
  for (const { upper, lower } of problem.above) {
    uppers.set(lower, [...(uppers.get(lower) ?? []), upper])
  }

  const fans = new Map<string, ItemId[]>()
  for (const item of problem.items) {
    const above = uppers.get(item.id)
    // a portal is a point on the edge of a leaf group, not a box to deal into rows
    if (!above || handsOn.has(item.id) || tied.has(item.id) || item.kind === 'portal') continue
    const rank = ranks.rank.get(item.id)
    if (rank === undefined) continue
    const key = JSON.stringify([item.frame, rank, [...new Set(above)].sort(compare)])
    fans.set(key, [...(fans.get(key) ?? []), item.id])
  }

  const rank = new Map<ItemId, number>()
  const under = new Map<ItemId, ItemId>()
  const folded: ItemId[][] = []
  for (const [key, ids] of [...fans].sort(([a], [b]) => compare(a, b))) {
    if (ids.length <= fold) continue
    const [frame, top] = JSON.parse(key) as [FrameId, number]
    const named = new Map((order.get(frame) ?? []).map((k, at) => [k, at]))
    const dealt = [...ids].sort((a, b) => {
      const [na, nb] = [named.get(a), named.get(b)]
      if (na !== undefined && nb !== undefined) return na - nb
      if (na !== undefined) return -1
      if (nb !== undefined) return 1
      return compare(a, b)
    })
    const rows = Math.ceil(dealt.length / width)
    const base = Math.floor(dealt.length / rows)
    const larger = dealt.length % rows
    const first = dealt.slice(0, base + (0 < larger ? 1 : 0))
    folded.push(dealt)
    let at = 0
    for (let row = 0; row < rows; row++) {
      const size = base + (row < larger ? 1 : 0)
      if (row > 0) {
        for (const [column, id] of dealt.slice(at, at + size).entries()) {
          rank.set(id, top + row)
          const lead = first[column]
          if (lead !== undefined) under.set(id, lead)
        }
      }
      at += size
    }
  }
  return { rank, under, fans: folded }
}
