// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Metrics } from './metrics.js'
import { type Line, linesById, type Problem } from './problem.js'

/**
 * Every spacing the drawing keeps comes from here, and from nowhere else: the white by what stands
 * next to a line (a twin, a stranger, a card, a port), counted from the line's edge, so that half
 * its width is added. A line's width is its own (`Line.width`, read once with the problem); the
 * metrics' white is read only in this file.
 */

/**
 * Two lines are twins when they run between the same two items. A unit's members share the
 * unit's item, so two lines from one spine to the two members of one unit are twins.
 */
export function twin(p: Line, q: Line): boolean {
  return p.family === q.family
}

/**
 * The centre-to-centre distance two neighbouring parallel lines keep. Each line stands on a
 * ground as wide as itself (`haloOf`), and the two grounds touch for twins, and a white of a row
 * lies between them for lines that part somewhere.
 */
export function pitchOf(metrics: Metrics, p: Line, q: Line): number {
  return (twin(p, q) ? 0 : metrics.gapApart) + haloOf(p) + haloOf(q)
}

/** The pitch of two lines where both are known; the white of strangers where one is not. */
export function pitchOfAny(metrics: Metrics, p: Line | undefined, q: Line | undefined): number {
  return p && q ? pitchOf(metrics, p, q) : metrics.gapApart
}

/** What the lines in a corridor keep: the distance between two neighbours, and from a box. */
export interface Keeps {
  /** The pitch of two neighbouring lines; the white of strangers where one is not known. */
  between(a: string | number | undefined, b: string | number | undefined): number
  /** A line's ground, which a box's white is added to. */
  halo(a: string | number | undefined): number
}

/** The spacings of the lines `lineAt` names: the pitch between two, and the ground of one. */
export function keepsOf(
  metrics: Metrics,
  lineAt: (id: string | number | undefined) => Line | undefined,
): Keeps {
  return {
    between: (a, b) => pitchOfAny(metrics, lineAt(a), lineAt(b)),
    halo: (a) => {
      const line = lineAt(a)
      return line ? haloOf(line) : 0
    },
  }
}

/** What the order layer is given of the problem's spacing, for lines known by their ids. */
export interface Spacing {
  /** The pitch between two neighbouring lines. */
  pitch(a: string, b: string): number
  /** The room one port takes, by box. */
  slots: ReadonlyMap<string, number>
  /** The family of a line: twins have the same. */
  family(line: string): string
}

export function spacingOf(problem: Pick<Problem, 'metrics' | 'lines' | 'slots'>): Spacing {
  const byId = linesById(problem)
  const keeps = keepsOf(problem.metrics, (id) => byId.get(String(id)))
  return {
    pitch: keeps.between,
    slots: problem.slots,
    family: (id) => byId.get(id)?.family ?? id,
  }
}

/**
 * The ground a line keeps for itself: from its centre to the edge of its band. A line is seen as a
 * line when the ground it stands on is as wide as the line (a grating of line and white is
 * counted when neither is the finer, so the white is not under the line), and that ground is
 * shared out half to each side.
 */
export function haloOf(line: Line): number {
  return line.width
}

/** The white off a card or a frame, which a line's own ground is added to. */
export function whiteOf(metrics: Metrics): number {
  return metrics.gapApart
}

/** How far a line keeps from the side of a box: a lead-out where ports leave it, else the white. */
export function keepOff(metrics: Metrics, ported: boolean): number {
  return ported ? metrics.leadOut : metrics.gapApart
}

/**
 * How near two coordinates must be to count as one place. Two lines are never closer than the
 * least white, which is one stroke (a twin of the thinnest lines); a tolerance each side may move by must leave that
 * white standing, so it is at most half of it. That is a bound, not a value: any fraction under
 * half does, and a quarter is the one that has been used (it is not derived).
 */
export function snapOf(metrics: Metrics): number {
  return metrics.stroke / 4
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
  lines: readonly Line[],
): number {
  return Math.max(
    metrics.portSlot(labels),
    metrics.gapApart + 2 * Math.max(0, ...lines.map((l) => haloOf(l))),
  )
}

/**
 * The room a flow needs between two items one above the other: a lead-out off each, and the white
 * of a line between them.
 */
export function flowRoom(metrics: Metrics): number {
  return 2 * keepOff(metrics, true) + whiteOf(metrics)
}

/** How far a card's obstacle reaches past its edge: the white a line keeps off it. */
export function inflate(metrics: Metrics): number {
  return whiteOf(metrics)
}

/**
 * How far a line keeps from the side of a card beyond the white the card's cell already keeps
 * from it: on a side with ports, up to a lead-out, so that a line that passes the card is a
 * lead-out from it, as far as the lines that leave it go straight; on a side with none, nothing.
 */
export function clearance(metrics: Metrics, ported: boolean): number {
  return Math.max(0, keepOff(metrics, ported) - whiteOf(metrics))
}

/**
 * Where the centre of a line lies when it keeps `off` from an edge, counted from its own edge: the
 * edge it keeps off plus `off` plus half the line, going up in coordinates (`above`), or down.
 */
export function above(edge: number, off: number, half: number): number {
  return edge + off + half
}
export function below(edge: number, off: number, half: number): number {
  return edge - off - half
}

/** `count` things a `slot` apart, and the offsets of their centres from the first one's. */
export function slotRow(count: number, slot: number): { length: number; offsets: number[] } {
  const length = Math.max(0, count - 1) * slot
  return { length, offsets: Array.from({ length: count }, (_, i) => i * slot) }
}
