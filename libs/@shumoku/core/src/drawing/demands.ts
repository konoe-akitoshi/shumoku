// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Box, Point } from './metrics.js'
import { type Demand, frameKey, type Geometry, type Problem, ROOT } from './problem.js'

const EPS = 1e-3

/** A straight stretch of a line along one axis. */
interface Run {
  line: string
  at: number
  from: number
  to: number
}

/**
 * What the lines ask of the placement. Where K lines that place things run side by side between
 * two boxes, the boxes must stand `(K - 1)` pitches and a lead-out from each side apart, the same
 * room the report measures. Where they stand closer, the two boxes are asked to stand the needed
 * distance apart; the request only ever grows the space. Lines laid over the drawing are not
 * counted: they take the room that is left, in the lanes of their bands.
 *
 * Each line counts once, wherever it was put: lines that the solution had no room to keep apart
 * are still lines that need the room. The runs are read from the lines as drawn, not from what was planned for them, so the room asked
 * for is the room that the drawing lacks. A line's first and last stretch belong to its port and
 * not to a corridor.
 */
export function demandsOf(
  problem: Problem,
  geometry: Geometry,
  wires: ReadonlyMap<string, readonly Point[]>,
): Demand[] {
  const { pitch, leadOut } = problem.metrics
  // A box is its card, or each member of a unit; the demand is for the item that holds it.
  const boxes: [string, Box][] = [
    ...problem.items.flatMap((item) =>
      (item.kind === 'unit' ? (item.members ?? []).map((m) => m.node.id) : [item.id]).flatMap(
        (id): [string, Box][] => {
          const b = geometry.boxes.get(id)
          return b ? [[item.id, b]] : []
        },
      ),
    ),
    ...problem.frames
      .filter((f) => f.id !== ROOT)
      .flatMap((f): [string, Box][] => {
        const b = geometry.boxes.get(frameKey(f.id))
        return b ? [[frameKey(f.id), b]] : []
      }),
  ]
  const placing = new Set(problem.lines.filter((l) => l.role === 'oriented').map((l) => l.id))
  const demands = new Map<string, Demand>()
  for (const horizontal of [true, false]) {
    const runs: Run[] = []
    for (const [id, points] of wires) {
      if (!placing.has(id)) continue
      for (let i = 1; i + 2 < points.length; i++) {
        const p = points[i]
        const q = points[i + 1]
        if (!p || !q) continue
        const [at, a, b, off] = horizontal ? [p.y, p.x, q.x, q.y - p.y] : [p.x, p.y, q.y, q.x - p.x]
        if (Math.abs(off) > EPS || Math.abs(b - a) <= EPS) continue
        runs.push({ line: id, at, from: Math.min(a, b), to: Math.max(a, b) })
      }
    }
    const extent = (b: Box): [number, number] =>
      horizontal ? [b.x, b.x + b.width] : [b.y, b.y + b.height]
    const across = (b: Box): [number, number] =>
      horizontal ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
    for (const run of runs) {
      let before: [string, Box] | undefined
      let after: [string, Box] | undefined
      for (const entry of boxes) {
        const [key, b] = entry
        const [e0, e1] = extent(b)
        if (e0 >= run.to - EPS || e1 <= run.from + EPS) continue
        const [c0, c1] = across(b)
        if (c1 <= run.at + EPS) {
          const [, p] = before ?? [key, undefined]
          const best = p ? across(p)[1] : Number.NEGATIVE_INFINITY
          if (
            !before ||
            c1 > best + EPS ||
            (Math.abs(c1 - best) <= EPS && compare(key, before[0]) < 0)
          ) {
            before = entry
          }
        } else if (c0 >= run.at - EPS) {
          const best = after ? across(after[1])[0] : Number.POSITIVE_INFINITY
          if (
            !after ||
            c0 < best - EPS ||
            (Math.abs(c0 - best) <= EPS && compare(key, after[0]) < 0)
          ) {
            after = entry
          }
        }
      }
      if (!before || !after) continue
      const lo = across(before[1])[1]
      const hi = across(after[1])[0]
      const inside = runs.filter(
        (r) => r.at > lo - EPS && r.at < hi + EPS && r.from < run.to - EPS && r.to > run.from + EPS,
      )
      let k = 1
      for (const start of [run.from, ...inside.map((r) => r.from).filter((x) => x > run.from)]) {
        const here = new Set(
          inside.filter((r) => r.from <= start + EPS && start < r.to - EPS).map((r) => r.line),
        )
        k = Math.max(k, here.size)
      }
      const need = (k - 1) * pitch + 2 * leadOut
      if (hi - lo >= need - EPS) continue
      const key = `${horizontal ? 'y' : 'x'}\0${before[0]}\0${after[0]}`
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
  }
  return [...demands.values()].sort(
    (p, q) => compare(p.axis, q.axis) || compare(p.before, q.before) || compare(p.after, q.after),
  )
}
