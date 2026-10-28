// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { solveHorizontal } from './horizontal.js'
import { cutKey, cutsOf, liftFlows } from './lift.js'
import { estimateCrossings, orderSiblings } from './order.js'
import type { Problem } from './problem.js'
import { solveVertical } from './vertical.js'

/**
 * What decides between two ways of stacking, most important first. Both put crossings first;
 * they differ on whether a drawing that is closer to the target shape or one with less room
 * wasted wins. `aspect-first` is the design's order, `fill-first` the brief's.
 */
export type StackOrder = 'aspect-first' | 'fill-first'

/** What a way of stacking comes to, each smaller the better. */
type Score = readonly [number, number, number]

/** Floating point noise is not a difference. */
const EPS = 1e-9

function lower(a: Score, b: Score): boolean {
  for (const [i, v] of a.entries()) {
    const w = b[i] ?? 0
    if (Math.abs(v - w) > EPS) return v < w
  }
  return false
}

/**
 * Places the problem as far as the heights, the order and the columns go and scores it: the
 * crossings of the lines that place things, the distance of the shape from the target (in the
 * log of width over height, so that twice too wide and twice too tall are as far), and the
 * share of the drawing's area that holds nothing, which is what a tight drawing has least of.
 */
function score(problem: Problem, how: StackOrder): Score {
  const y = solveVertical(problem)
  const order = orderSiblings(problem, y)
  const geo = solveHorizontal(problem, y, order)
  const boxes = problem.items.flatMap((i) => geo.boxes.get(i.id) ?? [])
  if (boxes.length === 0) return [0, 0, 0]
  const x0 = Math.min(...boxes.map((b) => b.x))
  const x1 = Math.max(...boxes.map((b) => b.x + b.width))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const y1 = Math.max(...boxes.map((b) => b.y + b.height))
  const width = x1 - x0
  const height = y1 - y0
  const shape = Math.abs(Math.log(width / height) - Math.log(problem.metrics.aspect))
  const empty = 1 - boxes.reduce((sum, b) => sum + b.width * b.height, 0) / (width * height)
  const crossings = estimateCrossings(problem, geo)
  return how === 'aspect-first' ? [crossings, shape, empty] : [crossings, empty, shape]
}

/**
 * Chooses which cuts between layers of siblings are on, that is, how far the siblings that the
 * flows put in order are stacked. It starts with everything stacked, which is the narrowest and
 * the tallest, and turns off one cut at a time, the one that scores best, for as long as that
 * scores better than where it stands. Nothing is turned back on, so it ends after as many steps
 * as there are cuts. Stacking is the one freedom the flows leave to the shape: it moves nothing
 * upstream or downstream of where the flows put it.
 */
export function chooseStacks(problem: Problem, how: StackOrder): Problem {
  // Two cards are held apart by their flow whatever a cut says, so only the cuts a frame is
  // stacked across are worth turning off.
  const isFrame = (key: string) => !problem.items.some((i) => i.id === key)
  const cuts = liftFlows(problem).flatMap((s) =>
    Array.from({ length: cutsOf(s) }, (_, k) => k)
      .filter((k) =>
        s.pairs.some((p) => p.from <= k && k < p.to && (isFrame(p.upper) || isFrame(p.lower))),
      )
      .map((k) => cutKey(s.frame, k)),
  )
  let stack: Problem['stack'] = {}
  let best = score({ ...problem, stack }, how)
  for (;;) {
    let pick: { key: string; at: Score } | undefined
    for (const key of cuts) {
      if (stack[key] === false) continue
      const at = score({ ...problem, stack: { ...stack, [key]: false } }, how)
      if (lower(at, pick?.at ?? best)) pick = { key, at }
    }
    if (!pick) break
    stack = { ...stack, [pick.key]: false }
    best = pick.at
  }
  return { ...problem, stack }
}
