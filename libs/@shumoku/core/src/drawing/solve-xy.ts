// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Wall } from './space.js'
import type { Unknowns } from './unknowns.js'

export type Axis = 'x' | 'y'

/** What the two axes are solved from: the unknowns of each, and the steps that add orders to them. */
export interface Constraints {
  U: Record<Axis, Unknowns>
  /** What a solve keeps to: what is nearer than this is one place. */
  tolerance: number
  /**
   * Adds the orders of the lines that run side by side in a cell on `axis`, reading the other
   * axis from `known`.
   */
  separate(axis: Axis, known: (a: Axis, i: number) => number): void
  /** Bounds the pieces along `axis` by the boxes along the stretch, given the solved other axis. */
  boundPieces(axis: Axis, solvedOther: (i: number) => number): void
  /** Whether room may be asked between two boxes that end a chain of orders on `axis`. */
  inOrder(axis: Axis): (before: Wall, after: Wall) => boolean
}

type Solved = ReturnType<Unknowns['solve']>
type Shortages = ReturnType<Unknowns['shortages']>

/** The solution of both axes, and what fell short on each. */
export interface SolvedXY {
  solved: Record<Axis, Solved>
  want: Record<Axis, Shortages>
}

/**
 * Solves x, then y from the x it found. The orders of the lines side by side are read with the
 * other axis as it was estimated for x, and as solved for y.
 */
export function solveXY(c: Constraints): SolvedXY {
  const { U, tolerance } = c
  c.separate('x', (a, i) => U[a].guess(i))
  const wantX = U.x.shortages(c.inOrder('x'), tolerance)
  const solvedX = U.x.solve(tolerance)
  c.boundPieces('y', solvedX.value)
  c.separate('y', (a, i) => (a === 'x' ? solvedX.value(i) : U.y.guess(i)))
  const wantY = U.y.shortages(c.inOrder('y'), tolerance)
  const solvedY = U.y.solve(tolerance)
  return { solved: { x: solvedX, y: solvedY }, want: { x: wantX, y: wantY } }
}
