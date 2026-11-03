// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Metrics } from './metrics.js'

/**
 * The two measures the problem needs before anything is drawn: how much ground a line keeps for
 * itself, and how much room a port takes. They stand apart from the rest of the spacings (`kin`)
 * because reading the problem uses them, and the stages that come later read the problem, not the
 * other way round. They ask only of a line's stroke.
 */

/**
 * The ground a line keeps for itself: from its centre to the edge of its band. A line is seen as a
 * line when the ground it stands on is as wide as the line (a grating of line and white is
 * counted when neither is the finer, so the white is not under the line), and that ground is
 * shared out half to each side.
 */
export function haloOf(line: { stroke: number }): number {
  return line.stroke
}

/**
 * The room one port takes along the edge of its box: the names written beside the ports, and the
 * widest of the lines that end there with the white off its neighbour. That is the most any two
 * neighbouring ports ask for between their centres; only the lines of this box are counted, so a
 * wide line elsewhere widens nothing here.
 */
export function slotOf(
  metrics: Metrics,
  labels: readonly (string | undefined)[],
  lines: readonly { stroke: number }[],
): number {
  return Math.max(
    metrics.portSlot(labels),
    metrics.gapApart + 2 * Math.max(0, ...lines.map((l) => haloOf(l))),
  )
}
