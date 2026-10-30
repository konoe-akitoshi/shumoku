// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { boxKey } from './ports.js'
import type { Line, Problem } from './problem.js'
import type { Side } from './scene.js'

/**
 * Which sides of its box a line leaves each of its two ends by. The sides follow from the
 * relation the structure gives the two ends, not from where the boxes happen to stand:
 *
 * - the line runs down the flow (one end is above the other): the upper end leaves by its bottom,
 *   the lower end by its top, so a flow is always a vertical hand-over;
 * - the two ends are level: a line between equals leaves by the sides, left or right, whichever
 *   faces the other;
 * - a line laid over the drawing leaves by the side of the band it is bundled in.
 *
 * `undefined` for a line that has no such relation (a line inside a unit is not routed, and a
 * line that places things but was given neither a direction nor a level is the problem's to
 * report, not for the routes to guess a side for).
 */
export function sidesOf(
  problem: Problem,
  line: Line,
): { a: readonly Side[]; b: readonly Side[] } | undefined {
  if (line.role === 'overlay') {
    const side: Side = line.band === 'bottom' ? 'bottom' : 'top'
    return { a: [side], b: [side] }
  }
  if (line.role !== 'oriented') return undefined
  // A node that sits on a host stands for the host in the flow.
  const host = new Map(
    problem.satellites.filter((s) => s.why === 'host').map((s) => [s.item, s.partner]),
  )
  const a = host.get(line.a.item) ?? line.a.item
  const b = host.get(line.b.item) ?? line.b.item
  const down = problem.above.find(
    (p) => (p.upper === a && p.lower === b) || (p.upper === b && p.lower === a),
  )
  if (down) return down.upper === a ? { a: ['bottom'], b: ['top'] } : { a: ['top'], b: ['bottom'] }
  const level = problem.level.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))
  if (level) return { a: ['left', 'right'], b: ['left', 'right'] }
  return undefined
}

/**
 * The sides of each box that a line leaves by, before any line is routed: the rule above fixes
 * them, except for the sides a level pair may choose between, which both count. A box is a card,
 * a bus or a cloud, or the member of a unit, by `boxKey`.
 */
export function portSides(problem: Problem): Map<string, Set<Side>> {
  const out = new Map<string, Set<Side>>()
  for (const line of problem.lines) {
    const sides = sidesOf(problem, line)
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
