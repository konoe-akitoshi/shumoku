// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Metrics } from './metrics.js'
import type { Line } from './problem.js'
import { EPS } from './tolerance.js'

/**
 * Every spacing the drawing keeps comes from here, and from nowhere else: the white by what stands
 * next to a line (a twin, a stranger, a card, a port), counted from the line's edge, so that half
 * its width is added. A line's width is its stroke (`Line.stroke`, read once with the problem); the
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
function pitchOfAny(metrics: Metrics, p: Line | undefined, q: Line | undefined): number {
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

/**
 * The ground a line keeps for itself: from its centre to the edge of its band. A line is seen as a
 * line when the ground it stands on is as wide as the line (a grating of line and white is
 * counted when neither is the finer, so the white is not under the line), and that ground is
 * shared out half to each side.
 */
export function haloOf(line: Line): number {
  return line.stroke
}

/** The white off a card or a frame, which a line's own ground is added to. */
export function whiteOf(metrics: Metrics): number {
  return metrics.gapApart
}

/**
 * The radius a line turns with: the white off a card and the line's own ground, the radius it turns
 * a card's corner with. A corner is a quarter circle of it, so it leaves the straight this far
 * before the vertex on either leg: the room a turn takes along both runs it joins.
 */
export function cornerOf(metrics: Metrics, line: Line): number {
  return whiteOf(metrics) + haloOf(line)
}

/**
 * The turns of a line, read on its straights in order (the axis-parallel pieces between its
 * vertices): which straights are a jog. A step is a straight whose two neighbours leave it to
 * opposite sides (two corners turning opposite ways); its two quarter circles of radius `R` need it
 * `2R` long. A shorter step is one 45° straight instead, both ends 135° vertices rounded with the
 * same `R`: it is the corner of a short step, not a corner cut. Two jogs never share a straight: a
 * step next to a jog is read as corners. The same rule is read by realize, on a solution, to give a
 * jog its room, and by shape, on the wires, to draw it.
 */
export function jogsOf(
  straights: readonly { length: number; step: boolean }[],
  radius: number,
): boolean[] {
  const out: boolean[] = []
  for (const [i, s] of straights.entries()) {
    const inner = i > 0 && i + 1 < straights.length
    out.push(inner && s.step && s.length < 2 * radius - EPS && !out[i - 1])
  }
  return out
}

/**
 * The least step a jog is drawn on: its 45° straight, `√2` times the step, holds the tangents of
 * its two rounded ends, half each, so `√2·Δ / 2 ≥ (√2 − 1)·R`, or `Δ ≥ (2 − √2)·R`.
 */
export function jogLeastOf(radius: number): number {
  return (2 - Math.SQRT2) * radius
}

/**
 * The straight a line keeps out of a card before its corner may begin: the lead-out less its white.
 * The white of a lead-out keeps another row's line off the port's label; a line's own corner is no
 * other row, and a turn laid a lead-out and the line's half from the card (where realize lays it)
 * leaves exactly its corner's radius after the label: `leadOut + halo − (leadOut − white) = white + halo`.
 */
export function labelBandOf(metrics: Metrics): number {
  return metrics.leadOut - whiteOf(metrics)
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
