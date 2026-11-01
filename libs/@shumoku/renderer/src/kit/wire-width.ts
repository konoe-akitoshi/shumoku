// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * How wide a link's line is drawn. Speeds come in decades (10M, 100M, 1G ...) and the reader's
 * question is which generation a line is, so one decade is one stroke, the least a width can
 * differ by and still be seen to differ. The origin is the slowest speed any standard names.
 */

import { getStandardSpec, type Link, STANDARD_SPECS } from '@shumoku/core'
import type { Kit } from './measure'

/** The slowest speed any standard names; a line at it is one stroke wide. */
const CATALOG_MIN = Math.min(...Object.values(STANDARD_SPECS).map((s) => s.speedBps))

/** The link's speed: the slower of its ends' standards, else the rate the model gave it. */
export function wireSpeed(link: Link): number | undefined {
  const speeds = [link.from, link.to].flatMap(
    (e) => getStandardSpec(e.plug?.module?.standard)?.speedBps ?? [],
  )
  const speed = speeds.length > 0 ? Math.min(...speeds) : link.rateBps
  return speed !== undefined && speed > 0 ? speed : undefined
}

/** The width a speed is drawn at. */
export function speedWidth(speed: number, kit: Kit): number {
  return kit.tokens.stroke * (1 + Math.log10(speed / CATALOG_MIN))
}

/** The median of the widths the links know: what a link that names no speed is drawn at. */
export function medianWireWidth(links: readonly Link[], kit: Kit): number {
  const known = links
    .flatMap((l) => {
      const speed = wireSpeed(l)
      return speed === undefined ? [] : [speedWidth(speed, kit)]
    })
    .sort((a, b) => a - b)
  if (known.length === 0) return kit.tokens.line.bold
  const m = known.length >> 1
  return known.length % 2 ? (known[m] ?? 0) : ((known[m - 1] ?? 0) + (known[m] ?? 0)) / 2
}

/**
 * The width a link takes across, which is what its neighbours keep off. The width the user wrote
 * wins over the speed; a double line takes its outer band.
 */
export function wireWidth(link: Link, kit: Kit, fallback: number): number {
  const speed = wireSpeed(link)
  const drawn = link.style?.strokeWidth ?? (speed === undefined ? fallback : speedWidth(speed, kit))
  return link.type === 'double' ? drawn * kit.tokens.wire.double.outer : drawn
}
