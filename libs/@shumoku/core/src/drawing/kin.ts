// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Metrics } from './metrics.js'
import type { Line } from './problem.js'

/**
 * Two lines are twins when they run between the same two items. A unit's members share the
 * unit's item, so two lines from one spine to the two members of one unit are twins.
 */
export function twin(p: Line, q: Line): boolean {
  return (
    (p.a.item === q.a.item && p.b.item === q.b.item) ||
    (p.a.item === q.b.item && p.b.item === q.a.item)
  )
}

/** The centre-to-centre distance two neighbouring parallel lines keep: the white and half of each. */
export function pitchOf(metrics: Metrics, p: Line, q: Line): number {
  return (
    (twin(p, q) ? metrics.gapTwin : metrics.gapApart) +
    (metrics.width(p.link) + metrics.width(q.link)) / 2
  )
}

/** The most any two lines can ask for between them. */
export function pitchMax(metrics: Metrics, lines: readonly Line[]): number {
  return metrics.gapApart + Math.max(0, ...lines.map((l) => metrics.width(l.link)))
}
