// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { assertNever, must } from './must.js'
import type { Line } from './problem.js'
import type { Side } from './scene.js'

/**
 * Which sides of its box a line leaves each of its two ends by, from the ranks of the two ends
 * alone: a line between two ranks leaves the upper one by its bottom and enters the lower by its
 * top, so every hand-over is vertical; between equals (the same rank) the line leaves by the
 * sides, left or right. `undefined` for a line inside a unit, which is not routed.
 */
export function sidesByRank(
  line: Line,
  rank: ReadonlyMap<string, number>,
): { a: readonly Side[]; b: readonly Side[] } | undefined {
  switch (line.role) {
    case 'inside':
      return undefined
    case 'oriented':
      // a line down the flow goes from the bottom of the end upstream, whatever the ranks say
      if (line.flow === 'a above b') return { a: ['bottom'], b: ['top'] }
      if (line.flow === 'b above a') return { a: ['top'], b: ['bottom'] }
      return byRanks(line, rank)
    case 'unrelated':
      return byRanks(line, rank)
    default:
      return assertNever(line, 'line role')
  }
}

/** Where the structure puts the ends no higher or lower, the ranks do. */
function byRanks(
  line: Line,
  rank: ReadonlyMap<string, number>,
): { a: readonly Side[]; b: readonly Side[] } {
  const ra = must(rank, line.a.item, 'rank of item')
  const rb = must(rank, line.b.item, 'rank of item')
  if (ra === rb) return { a: ['left', 'right'], b: ['left', 'right'] }
  return ra < rb ? { a: ['bottom'], b: ['top'] } : { a: ['top'], b: ['bottom'] }
}
