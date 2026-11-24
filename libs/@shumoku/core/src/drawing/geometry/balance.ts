// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { splitSide } from '../keys.js'
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
 * The weak pulls that centre a box on those it is linked to down the flow: for every pair the
 * structure puts one above the other, the middles of the two are drawn together. Least squares,
 * so a box with several below it comes to the mean of their middles and each of those to the
 * middle of those above it. A frame has no middle of its own and follows what it holds. The pairs
 * are taken in the order of `problem.above`, which is sorted.
 */
export function balanceOf(plan: Pick<Plan, 'problem'>, xAxis: Axis): Constraints {
  const { above } = plan.problem
  if (above.length === 0) return none
  return {
    sep: [],
    equal: [],
    pair: above.map(({ upper, lower }) => ({
      i: xAxis.midRef(upper).v,
      j: xAxis.midRef(lower).v,
      d: xAxis.midRef(upper).off - xAxis.midRef(lower).off,
      w: BALANCE_WEIGHT,
    })),
  }
}

/**
 * How hard a port on a top or bottom edge is drawn to the middle of its edge, against 1 for a run
 * pulled short. Weaker than the balance of boxes: a line made straight, a run kept short or a box
 * centred always wins, and this only decides where a port stands when nothing else does.
 */
export const PORT_MIDDLE_WEIGHT = 0.1

/**
 * The weak pulls that stand the ports of a top or bottom edge about the middle of their box. A
 * port whose line runs straight to its other end is held by nothing but its neighbours and the
 * edge's margins; without this the packing put it at the very end of the edge, and two such ports
 * on boxes stacked one over the other could stand at one x and their lines run on each other.
 */
export function portMiddlesOf(plan: Pick<Plan, 'problem' | 'tracks'>, xAxis: Axis): Constraints {
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
  return pair.length === 0 ? none : { sep: [], equal: [], pair }
}
