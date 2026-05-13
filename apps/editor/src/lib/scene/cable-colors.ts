// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { CableGrade } from '@shumoku/core'

/**
 * Canonical display order for cable grades — copper before fiber,
 * legacy before modern, and DAC / AOC tail since they're rack-level
 * not building-level cabling. Used by the in-canvas legend so the
 * column always reads top-to-bottom by familiarity rather than alpha.
 */
export const CABLE_GRADE_ORDER: readonly CableGrade[] = [
  'cat5e',
  'cat6',
  'cat6a',
  'cat7',
  'cat8',
  'om3',
  'om4',
  'om5',
  'os1',
  'os2',
  'dac',
  'aoc',
]

/**
 * Human-friendly label for a grade. We capitalize the family ("Cat",
 * "OM", "OS") and keep the numeric tier as-is so existing terminology
 * survives. DAC / AOC stay all-caps — those are acronyms in the wild.
 */
export function cableGradeLabel(grade: CableGrade): string {
  if (grade === 'cat5e') return 'Cat 5e'
  if (grade === 'cat6') return 'Cat 6'
  if (grade === 'cat6a') return 'Cat 6a'
  if (grade === 'cat7') return 'Cat 7'
  if (grade === 'cat8') return 'Cat 8'
  if (grade === 'om3') return 'OM3 (MMF)'
  if (grade === 'om4') return 'OM4 (MMF)'
  if (grade === 'om5') return 'OM5 (MMF)'
  if (grade === 'os1') return 'OS1 (SMF)'
  if (grade === 'os2') return 'OS2 (SMF)'
  if (grade === 'dac') return 'DAC'
  if (grade === 'aoc') return 'AOC'
  return grade
}

/**
 * Wire stroke color for a given cable grade in Scene mode.
 *
 * The palette mixes two sources:
 *
 * - **Fiber grades follow TIA-598-C**, the international jacket-color
 *   standard. OM3 / OM4 = aqua, OM5 = lime, OS1 / OS2 = yellow. Using
 *   the same colors in the floor-plan as the physical jackets means
 *   "the orange one on the diagram" matches "the orange one in your
 *   hand" with no translation step.
 *
 * - **Copper grades follow industry custom**, not a formal standard.
 *   TIA/EIA does not regulate Cat-cable jacket color, but vendors and
 *   installers have converged on Cat 6 = blue, Cat 6a = green-ish,
 *   Cat 7 = dark / shielded look, Cat 8 = green. Cat 5e = gray for
 *   "legacy/old" connotation.
 *
 * - **DAC / AOC** (rack-internal copper / active optical) don't have
 *   color standards. We pick a near-black for DAC (matches typical
 *   passive copper jackets) and pink for AOC so it's visually
 *   distinct in rack-dense scenes.
 *
 * Returns the slate default when the link has no `cable.category`
 * set — same as the pre-color-code era, so unconfigured scenes don't
 * suddenly look broken. Callers should pass `undefined` for "no
 * category known", not a sentinel value.
 *
 * See `CABLE_COLORS.md` for the full standards reference.
 */
export function cableCategoryColor(grade: CableGrade | undefined): string {
  switch (grade) {
    // ── Copper (industry custom) ────────────────────────────────────
    case 'cat5e':
      return '#94A3B8' // slate-400: legacy gray
    case 'cat6':
      return '#2563EB' // blue-600: the most common Cat 6 jacket
    case 'cat6a':
      return '#10B981' // emerald-500: 10G-access shorthand
    case 'cat7':
      return '#52525B' // zinc-700: shielded / heavier look
    case 'cat8':
      return '#16A34A' // green-600: DC-grade copper
    // ── Fiber (TIA-598-C) ───────────────────────────────────────────
    case 'om3':
      return '#06B6D4' // cyan-500 ≈ standard MMF aqua
    case 'om4':
      return '#0EA5E9' // sky-500: slightly bluer MMF
    case 'om5':
      return '#84CC16' // lime-500: TIA-598-C 2016 wideband
    case 'os1':
    case 'os2':
      return '#EAB308' // yellow-500: SMF jacket color
    // ── Other assemblies ────────────────────────────────────────────
    case 'dac':
      return '#1F2937' // gray-800: near-black for rack-internal copper
    case 'aoc':
      return '#F472B6' // pink-400: distinguishes from DAC at a glance
    default:
      return '#475569' // slate-600: scene-mode default (unchanged)
  }
}
