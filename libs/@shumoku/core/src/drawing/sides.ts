// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

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
  if (line.role === 'inside') return undefined
  if (line.upper === 'a') return { a: ['bottom'], b: ['top'] }
  if (line.upper === 'b') return { a: ['top'], b: ['bottom'] }
  const ra = rank.get(line.a.item) ?? 0
  const rb = rank.get(line.b.item) ?? 0
  if (ra === rb) return { a: ['left', 'right'], b: ['left', 'right'] }
  return ra < rb ? { a: ['bottom'], b: ['top'] } : { a: ['top'], b: ['bottom'] }
}
