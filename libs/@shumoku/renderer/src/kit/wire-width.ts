// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * How wide a link's line is drawn. Speeds come in decades (10M, 100M, 1G ...) and the reader's
 * question is which generation a line is, so each decade adds one step. A step is a stroke and a
 * half: a network drawing is mostly read shrunk to fit, where a step of one stroke (1G at 3, 10G
 * at 4) drew lines too thin to read and too alike to tell apart. The origin is the slowest speed
 * any standard names.
 */

import { type Link, linkSpeedBps, STANDARD_SPECS } from '@shumoku/core'
import type { Kit } from './measure.js'

/** The slowest speed any standard names; a line at it is one step wide. */
const CATALOG_MIN = Math.min(...Object.values(STANDARD_SPECS).map((s) => s.speedBps))

/** One step, in strokes: what a decade of speed adds to a line's width. */
const STEP = 1.5

/**
 * The width a speed is drawn at. It is never under a stroke, the least a width can differ by, so
 * a speed under the slowest standard's is still drawn as a line.
 */
function speedWidth(speed: number, kit: Kit): number {
  return Math.max(
    kit.tokens.stroke,
    STEP * kit.tokens.stroke * (1 + Math.log10(speed / CATALOG_MIN)),
  )
}

/** The median of the widths the links know: what a link that names no speed is drawn at (a bold line, a step wide per stroke, when no link names one). */
export function medianWireWidth(links: readonly Link[], kit: Kit): number {
  const known = links
    .flatMap((l) => {
      const speed = linkSpeedBps(l)
      return speed === undefined ? [] : [speedWidth(speed, kit)]
    })
    .sort((a, b) => a - b)
  if (known.length === 0) return STEP * kit.tokens.line.bold
  const m = known.length >> 1
  return known.length % 2 ? (known[m] ?? 0) : ((known[m - 1] ?? 0) + (known[m] ?? 0)) / 2
}

/** The width a link's line is drawn at: what the user wrote wins over the speed; `unnamed` when neither. */
export function lineWidth(link: Link, kit: Kit, unnamed: number): number {
  const speed = linkSpeedBps(link)
  return link.style?.strokeWidth ?? (speed === undefined ? unnamed : speedWidth(speed, kit))
}
