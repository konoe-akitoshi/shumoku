// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Box } from './metrics.js'
import { type Demand, frameKey, type Geometry, type Problem, ROOT } from './problem.js'
import type { Bundle } from './tracks.js'

const EPS = 1e-3

/**
 * What the routes ask of the placement. A corridor that holds a bundle of K lines that place things needs
 * `(K - 1)` pitches between the first and the last line and a lead-out clear on both sides, so
 * where the two boxes that make the corridor stand closer than that, they are asked to stand
 * the needed distance apart. The request only ever grows the space.
 */
export function demandsOf(
  problem: Problem,
  geometry: Geometry,
  bundles: readonly Bundle[],
): Demand[] {
  const { pitch, leadOut } = problem.metrics
  const boxes: [string, Box][] = [
    ...problem.items.flatMap((i): [string, Box][] => {
      const box = geometry.boxes.get(i.id)
      return box ? [[i.id, box]] : []
    }),
    ...problem.frames
      .filter((f) => f.id !== ROOT)
      .flatMap((f): [string, Box][] => {
        const box = geometry.boxes.get(frameKey(f.id))
        return box ? [[frameKey(f.id), box]] : []
      }),
  ]
  const demands = new Map<string, Demand>()
  for (const bundle of bundles) {
    // Lines laid over the drawing are not counted: they take the room that is left, and what
    // does not fit goes around the outside, so they never widen a corridor.
    if (bundle.core < 2) continue
    const need = (bundle.core - 1) * pitch + 2 * leadOut
    const horizontal = bundle.axis === 'h'
    // The boxes the bundle runs between, across its direction, among those it runs alongside.
    const along = (b: Box) =>
      horizontal
        ? b.x < bundle.hi - EPS && b.x + b.width > bundle.lo + EPS
        : b.y < bundle.hi - EPS && b.y + b.height > bundle.lo + EPS
    const start = (b: Box) => (horizontal ? b.y : b.x)
    const end = (b: Box) => (horizontal ? b.y + b.height : b.x + b.width)
    let before: [string, Box] | undefined
    let after: [string, Box] | undefined
    for (const entry of boxes) {
      const [key, box] = entry
      if (!along(box)) continue
      if (end(box) <= bundle.coord + EPS) {
        if (
          !before ||
          end(box) > end(before[1]) ||
          (end(box) === end(before[1]) && compare(key, before[0]) < 0)
        ) {
          before = entry
        }
      } else if (start(box) >= bundle.coord - EPS) {
        if (
          !after ||
          start(box) < start(after[1]) ||
          (start(box) === start(after[1]) && compare(key, after[0]) < 0)
        ) {
          after = entry
        }
      }
    }
    if (!before || !after) continue
    if (start(after[1]) - end(before[1]) >= need) continue
    const key = `${bundle.axis}\0${before[0]}\0${after[0]}`
    const known = demands.get(key)
    if (!known || known.min < need) {
      demands.set(key, {
        axis: horizontal ? 'y' : 'x',
        before: before[0],
        after: after[0],
        min: need,
      })
    }
  }
  return [...demands.values()].sort(
    (p, q) => compare(p.axis, q.axis) || compare(p.before, q.before) || compare(p.after, q.after),
  )
}
