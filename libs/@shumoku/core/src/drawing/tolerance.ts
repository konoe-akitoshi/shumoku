// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Where floating-point noise stops mattering: two computed numbers nearer than this are the same
 * number. It is for comparing what was computed, never a length that is drawn; how near two
 * coordinates must be to count as one place on the page is `snapOf` in `kin.ts`, which follows
 * from the stroke.
 */
export const EPS = 1e-6

/** Coordinates are keyed after rounding to this grid, so that equal edges of different boxes agree. */
const PER_UNIT = Math.round(1 / EPS)
export const round = (v: number) => Math.round(v * PER_UNIT) / PER_UNIT
