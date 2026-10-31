// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { boxKey, boxOf } from './ports.js'
import type { Geometry, Line, Problem } from './problem.js'
import type { Side } from './scene.js'

/**
 * Which sides of its box a line leaves each of its two ends by. The sides follow from the
 * relation the structure gives the two ends, not from where the boxes happen to stand:
 *
 * - the line runs down the flow (one end is above the other): the upper end leaves by its bottom,
 *   the lower end by its top, so a flow is always a vertical hand-over;
 * - the two ends are level: a line between equals leaves by the sides, left or right, whichever
 *   faces the other;
 * - the structure relates the two ends in no way (`unrelated`): each leaves by the side that faces
 *   the other end's box where that box lies wholly above or below it, as a line down the flow
 *   does; where it does not (or the boxes are not known), by the side the line itself gives, up
 *   for a virtual line, which leads toward what lies beyond the boundary, down for one on the
 *   cables.
 *
 * The relation is the line's own (`upper`), read from the structure once and followed through any
 * chain of directions, so a hand-over from one end of a chain to the other is a flow too.
 * `undefined` for a line inside a unit, which is not routed.
 */
export function sidesOf(
  line: Line,
  geometry?: Geometry,
): { a: readonly Side[]; b: readonly Side[] } | undefined {
  if (line.role === 'unrelated') {
    const given: Side = line.edge === 'bottom' ? 'bottom' : 'top'
    const facing = (own: Line['a'], other: Line['a']): Side => {
      const m = geometry && boxOf(geometry, own)
      const o = geometry && boxOf(geometry, other)
      if (!m || !o) return given
      if (o.y >= m.y + m.height) return 'bottom'
      if (o.y + o.height <= m.y) return 'top'
      return given
    }
    return { a: [facing(line.a, line.b)], b: [facing(line.b, line.a)] }
  }
  if (line.role !== 'oriented') return undefined
  if (line.upper === 'a') return { a: ['bottom'], b: ['top'] }
  if (line.upper === 'b') return { a: ['top'], b: ['bottom'] }
  return { a: ['left', 'right'], b: ['left', 'right'] }
}

/**
 * The sides of each box that a line leaves by, before any line is routed: the rule above fixes
 * them, except for the sides a level pair may choose between, which both count. A box is a card,
 * a bus or a cloud, or the member of a unit, by `boxKey`.
 */
export function portSides(problem: Problem, geometry?: Geometry): Map<string, Set<Side>> {
  const out = new Map<string, Set<Side>>()
  for (const line of problem.lines) {
    const sides = sidesOf(line, geometry)
    if (!sides) continue
    for (const [end, list] of [
      [line.a, sides.a],
      [line.b, sides.b],
    ] as const) {
      const set = out.get(boxKey(end)) ?? new Set<Side>()
      for (const s of list) set.add(s)
      out.set(boxKey(end), set)
    }
  }
  return out
}
