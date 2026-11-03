// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { planOf } from '../geometry/plan.js'
import { basisOf } from '../layers/basis.js'
import { judgeOf } from '../layers/cost.js'
import { linesOf } from '../layers/lines.js'
import { portGroupsOf } from '../layers/ports.js'
import { startOf } from '../layers/start.js'
import type { Lookup } from '../layers/types.js'
import { layoutParts } from '../layout.js'
import type { Hints } from '../ranks.js'
import { ranksOf } from '../ranks.js'
import { networkOf, problemOf, testMetrics } from './support.js'

/**
 * The inputs of the sub-stages of `layersOf`, made by the stages before them on a real network,
 * so that a test of one sub-stage does not build a context by hand.
 */
export function layerStagesOf(
  yaml: string,
  boundary: string[],
  hints: Pick<Hints, 'order' | 'members'> = {},
) {
  const problem = problemOf(yaml, boundary)
  const ranks = ranksOf(problem)
  const basis = basisOf(problem, ranks, hints)
  const wires = linesOf(basis)
  const lookup: Lookup = { ...basis, ...wires, ...portGroupsOf(basis, wires) }
  const initial = startOf(lookup)
  return { lookup, initial, judge: judgeOf(lookup, initial) }
}

/** The plan `placeAll` makes, from the stages before it, on a real network. */
export function planningOf(yaml: string, boundary: string[]) {
  const { network, structure } = networkOf(yaml, boundary)
  const parts = layoutParts(network, structure, testMetrics)
  return planOf(parts.problem, parts.ranks, parts.layers, parts.corridors, parts.tracks)
}
