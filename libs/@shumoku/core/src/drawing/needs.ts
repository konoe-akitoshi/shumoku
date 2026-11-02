// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { splitKey } from '../structure/keys.js'
import { widen } from './ports.js'
import type { Problem } from './problem.js'
import type { Tracks } from './tracks.js'

/**
 * How long each box's edges must be to hold the ports on them a slot apart and clear of the
 * corners: the problem with every box made large enough, units refitted. The ports are known
 * from the tracks, so a short edge is met by lengthening the side and not by bending a line.
 */
export function needsOf(problem: Problem, tracks: Tracks): Problem {
  const widths = new Map<string, number>()
  const heights = new Map<string, number>()
  for (const [key, list] of tracks.ports) {
    const [box, side] = splitKey(key)
    if (box === undefined || list.length === 0) continue
    const extent = (list.length + 1) * (problem.slots.get(box) ?? 0)
    const into = side === 'top' || side === 'bottom' ? widths : heights
    into.set(box, Math.max(into.get(box) ?? 0, extent))
  }
  return widen(problem, widths, heights)
}
