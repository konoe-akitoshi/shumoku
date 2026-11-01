// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type Ordering, passingName } from './bundle-order.js'
import { pitchOf } from './kin.js'
import type { Point } from './metrics.js'
import type { Band, Problem } from './problem.js'
import type { RunSeg } from './realize-wires.js'

const EPS = 1e-6

/**
 * The bands of the lines. A band is not found by looking for lines that happen to lie on the same
 * coordinate: the order of the lines at a door says which run is next to which, and a run is next
 * to the one beside it when the two are no further apart than the pitch they keep. A run's band is
 * the lines beside it, at every door it goes through, and those beside them, outward from it.
 */
export function bandsOf(problem: Problem, ordering: Ordering, runs: readonly RunSeg[]): Band[] {
  const lines = new Map(problem.lines.map((l) => [l.id, l]))
  const byName = new Map(runs.map((r) => [passingName(r), r]))
  /** Where the run lies across its direction. */
  const across = (r: RunSeg): number => (Math.abs(r.a.y - r.b.y) < EPS ? r.a.y : r.a.x)
  const bands: Band[] = []
  for (const run of runs) {
    const me = passingName(run)
    const beside = new Map<string, RunSeg>()
    for (const door of run.doors) {
      const order = (ordering.doors.get(door) ?? []).flatMap((p) => {
        const r = byName.get(passingName(p))
        return r ? [r] : []
      })
      const at = order.findIndex((r) => passingName(r) === me)
      if (at < 0) continue
      for (const step of [-1, 1]) {
        let prev = run
        for (let k = at + step; k >= 0 && k < order.length; k += step) {
          const next = order[k]
          const other = next && lines.get(next.line)
          const from = lines.get(prev.line)
          if (!next || !other || !from || next.line === run.line) break
          if (Math.abs(across(next) - across(prev)) > pitchOf(problem.metrics, from, other) + EPS)
            break
          beside.set(passingName(next), next)
          prev = next
        }
      }
    }
    if (beside.size === 0) continue
    const place = ({ line, a, b }: { line: string; a: Point; b: Point }) => ({ line, a, b })
    bands.push({ line: run.line, a: run.a, b: run.b, beside: [...beside.values()].map(place) })
  }
  return bands
}
