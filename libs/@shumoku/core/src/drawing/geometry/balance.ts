// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

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
