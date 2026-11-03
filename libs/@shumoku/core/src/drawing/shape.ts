// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Point } from './metrics.js'
import type { Geometry, Problem } from './problem.js'
import { drawTurns, dropNearCollinear, type Turn, turnsOf } from './turns.js'

/**
 * Draws the realized (axis-parallel) wires with the turns realize gave them (`Turn`): a line has one
 * radius `R = cornerOf` (`whiteOf + haloOf`), and every turn is a 45° straight from `leg` before its
 * vertex to `leg` after it, both ends rounded with `R`; the least of them is the quarter circle of
 * `R` (concentric `R_0 + D` in a nest), a longer one a 45° straight of the route, and a step may be
 * crossed by one 45° straight.
 *
 * How long each 45° straight is, and the room it takes, are realize's (`diagonalsOf`, from the room
 * the realized lines and boxes leave): nothing is measured here and no turn is cut. Without the
 * turns, the wires are drawn with the room realize keeps for every turn (`turnsOf`: quarter circles,
 * and a short step as one 45° straight).
 */
interface Shaped {
  wires: Map<string, { points: Point[]; radii: number[] }>
}

export function shapeWires(
  problem: Problem,
  _geometry: Geometry,
  wires: ReadonlyMap<string, Point[]>,
  turns?: ReadonlyMap<string, readonly Turn[]>,
): Shaped {
  const skeleton = new Map<string, Point[]>()
  for (const [id, pts] of wires) skeleton.set(id, dropNearCollinear(pts))
  const given = turns ?? turnsOf(problem, skeleton)
  const out = new Map<string, { points: Point[]; radii: number[] }>()
  for (const [id, pts] of skeleton) out.set(id, drawTurns(pts, given.get(id) ?? []))
  return { wires: out }
}
