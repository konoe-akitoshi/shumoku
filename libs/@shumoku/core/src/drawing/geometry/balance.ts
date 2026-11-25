// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { joinKey } from '../../structure/keys.js'
import { splitSide } from '../keys.js'
import type { ItemId, Problem } from '../problem.js'
import type { Plan } from './plan.js'
import { type Axis, type Constraints, none } from './system.js'

/**
 * How hard a box is drawn to stand over the middle of the boxes it hands over to (and under the
 * middle of those it is handed over by), against 1 for a run of a line pulled short. Weak, so a
 * line made straight or a run kept short always wins and this only shares out the room that is
 * left. OGDF weighs balancing 0.1 against 2.0 for the segments of lines (1 to 20); at 0.05 here
 * it moved nothing measurable on the Interbee network, and from 0.5 up it gains a little and
 * then saturates, so it is 1 to 2.
 */
export const BALANCE_WEIGHT = 0.5

/**
 * How much of its weight a pull keeps where it draws a box that hands over to several towards
 * what stands above it: the run its line comes by, and its middle under the middle of the box
 * above. The pulls are least squares, so one long run up outweighed several short ones down, and
 * a switch slid from over its access points towards its uplink until the wall of its frame
 * stopped it. Which boxes these are is read from the relations (`headsOf`), before any
 * coordinate; the weight only says that standing over those below comes first. It is not
 * nothing, so the run still follows the box and a box over such boxes still stands over them.
 */
export const UPWARD_WEIGHT = 0.02

/**
 * The boxes that hand over to two or more ends of the flow (boxes that hand over to nothing, an
 * access switch's access points): each stands over its fan, whatever it is handed over by. A box
 * whose lower boxes hand over further is not held so; it stands where the rest of the drawing
 * pulls it, as boxes cabled across to two others do.
 */
export function headsOf(problem: Pick<Problem, 'above'>): ReadonlySet<ItemId> {
  const below = new Map<ItemId, ItemId[]>()
  for (const { upper, lower } of problem.above)
    below.set(upper, [...(below.get(upper) ?? []), lower])
  return new Set(
    [...below]
      .filter(([, lows]) => lows.length >= 2 && lows.every((l) => !below.has(l)))
      .map(([item]) => item),
  )
}

/** An upper and a lower item as one key, for the pairs whose line bends up into a head. */
export const pairKey = (upper: ItemId, lower: ItemId): string => joinKey([upper, lower])

/**
 * The weak pulls that centre a box on those it is linked to down the flow: for every pair the
 * structure puts one above the other, the middles of the two are drawn together. Least squares,
 * so a box with several below it comes to the mean of their middles and each of those to the
 * middle of those above it, except that a pair in `bentUp` (its line bends on its way into a box
 * that hands over to several) is drawn together only by `UPWARD_WEIGHT` of that. A frame has no
 * middle of its own and follows what it holds. The pairs are taken in the order of
 * `problem.above`, which is sorted.
 */
export function balanceOf(
  plan: Pick<Plan, 'problem'>,
  xAxis: Axis,
  bentUp: ReadonlySet<string> = new Set(),
): Constraints {
  const { above } = plan.problem
  if (above.length === 0) return none
  return {
    sep: [],
    equal: [],
    pair: above.map(({ upper, lower }) => ({
      i: xAxis.midRef(upper).v,
      j: xAxis.midRef(lower).v,
      d: xAxis.midRef(upper).off - xAxis.midRef(lower).off,
      w: bentUp.has(pairKey(upper, lower)) ? BALANCE_WEIGHT * UPWARD_WEIGHT : BALANCE_WEIGHT,
    })),
  }
}

/**
 * How hard a port on a top or bottom edge is drawn to the middle of its edge, against 1 for a run
 * pulled short and `BALANCE_WEIGHT` for a box over the boxes it hands over to. A line made straight
 * is an equality and is not traded; the rest are weighed together, so a box may stand a fraction
 * of a pixel off centre for its ports, and a port mostly stands where nothing else pulls it.
 */
const PORT_MIDDLE_WEIGHT = 0.1

/**
 * The weak pulls that stand the ports of a top or bottom edge about the middle of their box. A
 * port whose line runs straight to its other end is held by nothing but its neighbours and the
 * edge's margins; without this the packing put it at the very end of the edge, and two such ports
 * on boxes stacked one over the other could stand at one x and their lines run on each other.
 */
export function portMiddlesOf(plan: Pick<Plan, 'tracks'>, xAxis: Axis): Constraints['pair'] {
  const pair: Constraints['pair'] = []
  for (const [k, list] of plan.tracks.ports) {
    const { box, side } = splitSide(k)
    if (side !== 'top' && side !== 'bottom') continue
    const mid = xAxis.midRef(box)
    for (const id of list) {
      const port = xAxis.at({ kind: 'port', id })
      pair.push({ i: mid.v, j: port.v, d: mid.off - port.off, w: PORT_MIDDLE_WEIGHT })
    }
  }
  return pair
}
