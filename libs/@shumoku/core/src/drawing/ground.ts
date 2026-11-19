// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The one measure the problem needs before anything is drawn: how much ground a line keeps for
 * itself. The room of a port along its edge (`portRoom`) and the pitch of two lines side by side
 * (`pitchOf`) are made of it. It stands apart from the rest of the spacings (`kin`) because
 * reading the problem uses it, and the stages that come later read the problem, not the other way
 * round. It asks only of a line's stroke.
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
