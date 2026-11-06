// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What the slab behind a redundancy set looks like: one outline round its members' cards, in the
 * theme's hull colour, with the kind of set written above its corner.
 */

import type { KitColors } from './colors.js'
import { buildHaHullPath } from './hull-geometry.js'
import type { Box } from './scene.js'
import type { Tokens } from './tokens.js'

export interface HullLook {
  d: string
  fill: string
  label?: { text: string; x: number; y: number; fill: string }
}

/** The hull of a set, or `undefined` where its members give no outline to draw. */
export function hullLook(
  hull: { boxes: Box[]; seams: number[]; kind?: string },
  tokens: Tokens,
  colors: KitColors,
): HullLook | undefined {
  const { pad, outerRadius, notchHeight, notchMin, filletRadius, labelX, labelY } = tokens.hull
  const shape = buildHaHullPath(
    { members: hull.boxes, seams: hull.seams.map((y) => ({ y })) },
    { pad, outerR: outerRadius, notchH: notchHeight, notchMin, filletR: filletRadius },
  )
  if (!shape.d) return undefined
  return {
    d: shape.d,
    fill: colors.hull,
    ...(hull.kind
      ? {
          label: {
            text: hull.kind.toUpperCase(),
            x: shape.bounds.x + labelX,
            y: shape.bounds.y - labelY,
            fill: colors.textSecondary,
          },
        }
      : {}),
  }
}
