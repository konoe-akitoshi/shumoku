// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * How wide a link's line is drawn. Speeds come in decades (100M, 1G, 10G, 100G ...) and the
 * reader's question is which generation a line is, so each decade adds the same width. 1G, the
 * most common speed, is four strokes; a decade adds seven strokes and a half, so a 100G line is
 * about five 1G lines wide and reads as a trunk at a glance. Two strokes and a half per decade
 * (1G at 7.5, 100G at 12.5) drew the fastest lines barely thicker than the commonest. A line is
 * never under two strokes, so 100M and slower are drawn alike, thin but still a line.
 */

import { type Link, linkSpeedBps } from '@shumoku/core'
import type { Kit } from './measure.js'

/** The speed a line is drawn at its origin width: 1G. */
const ORIGIN_BPS = 1e9

/** The width at 1G, in strokes. */
const AT_ORIGIN = 4

/** What a decade of speed adds to a line's width, in strokes. */
const PER_DECADE = 7.5

/** The least a line is drawn at, in strokes. */
const FLOOR = 2

/** The width a speed is drawn at. */
function speedWidth(speed: number, kit: Kit): number {
  const strokes = AT_ORIGIN + PER_DECADE * Math.log10(speed / ORIGIN_BPS)
  return Math.max(FLOOR, strokes) * kit.tokens.stroke
}

/** The median of the widths the links know: what a link that names no speed is drawn at (a 1G line when no link names one). */
export function medianWireWidth(links: readonly Link[], kit: Kit): number {
  const known = links
    .flatMap((l) => {
      const speed = linkSpeedBps(l)
      return speed === undefined ? [] : [speedWidth(speed, kit)]
    })
    .sort((a, b) => a - b)
  if (known.length === 0) return AT_ORIGIN * kit.tokens.stroke
  const m = known.length >> 1
  return known.length % 2 ? (known[m] ?? 0) : ((known[m - 1] ?? 0) + (known[m] ?? 0)) / 2
}

/** The width a link's line is drawn at: by its speed; `unnamed` when the speed is not known. */
export function lineWidth(link: Link, kit: Kit, unnamed: number): number {
  const speed = linkSpeedBps(link)
  return speed === undefined ? unnamed : speedWidth(speed, kit)
}
