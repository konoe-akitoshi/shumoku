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
   * Adds the orders of the lines that run side by side in a cell on `axis`, as far as the orders
   * made so far on both axes and the rooms decide them. Gives how many were added.
   */
  separate(axis: Axis, which: 'forced' | 'free'): number
  /**
   * Orders the pairs on `axis` that the relations left undecided, as a solution of both axes
   * shows them: side by side, in the order shown. Gives how many were added.
   */
  settle(axis: Axis, value: (a: Axis, i: number) => number): number
  /** How many pairs on `axis` are still undecided: not ordered, and not shown apart for certain. */
  undecided(axis: Axis): number
  /** The pairs settled on a solution, each as its key and the piece that came first. */
  settled: string[]
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
  /** How the lane orders were decided: by the relations, by a solution, and how many solutions it took. */
  lanes: {
    byRelation: number
    bySolution: number
    undecided: number
    solves: number
    /** The pairs settled on a solution, each as its key and the piece that came first. */
    settled: string[]
  }
}

/**
 * Solves the two axes. The orders of the lines side by side in a cell are read from what the
 * other axis's orders say (`separate`), each axis's new orders deciding more of the other's, until
 * neither adds any: no coordinate is estimated for it. What the relations leave undecided is then
 * read off a solution of both axes (`settle`): pairs shown side by side are ordered as shown, the
 * axes solved again, and so on until the solution adds no order. Orders are only added and the
 * pairs are finite, so this ends.
 */
export function solveXY(c: Constraints): SolvedXY {
  const { U, tolerance } = c
  let byRelation = 0
  let bySolution = 0
  let solves = 0
  // The orders the legs force cost no solve, and each may decide more: those first, until none is
  // added; then the pairs nothing forces, one solve an axis; and again, until neither adds any.
  const relate = () => {
    for (;;) {
      for (;;) {
        const added = c.separate('x', 'forced') + c.separate('y', 'forced')
        byRelation += added
        if (added === 0) break
      }
      const added = c.separate('x', 'free') + c.separate('y', 'free')
      byRelation += added
      if (added === 0) return
    }
  }
  let solvedX: Solved
  let solvedY: Solved
  for (;;) {
    relate()
    solvedX = U.x.solve(tolerance)
    c.boundPieces('y', solvedX.value)
    solvedY = U.y.solve(tolerance)
    solves++
    const at = (a: Axis, i: number) => (a === 'x' ? solvedX : solvedY).value(i)
    const added = c.settle('x', at) + c.settle('y', at)
    bySolution += added
    if (added === 0) break
  }
  const wantX = U.x.shortages(c.inOrder('x'), tolerance)
  const wantY = U.y.shortages(c.inOrder('y'), tolerance)
  return {
    solved: { x: solvedX, y: solvedY },
    want: { x: wantX, y: wantY },
    lanes: {
      byRelation,
      bySolution,
      undecided: c.undecided('x') + c.undecided('y'),
      solves,
      settled: c.settled,
    },
  }
}
