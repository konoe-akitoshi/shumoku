// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a wire's caption looks like: a quiet chip in the card's own fill and edge, centred on the
 * point the layout gave it, with its lines stacked about the centre.
 */

import type { Link } from '@shumoku/core'
import type { KitColors } from './colors.js'
import { captionContent } from './content.js'
import { captionSize, type Kit } from './measure.js'
import type { Point } from './scene.js'

export interface CaptionLook {
  box: {
    x: number
    y: number
    width: number
    height: number
    rx: number
    fill: string
    stroke: string
    strokeOpacity: number
    strokeWidth: number
  }
  lines: { text: string; x: number; y: number }[]
}

/** The caption of a link at `at`; none when the link has nothing to say. */
export function captionLook(
  link: Link,
  at: Point,
  kit: Kit,
  colors: KitColors,
): CaptionLook | undefined {
  const size = captionSize(link, kit)
  if (!size) return undefined
  const { tokens } = kit
  const lines = captionContent(link, kit)
  return {
    box: {
      x: at.x - size.width / 2,
      y: at.y - size.height / 2,
      ...size,
      rx: tokens.caption.cornerRadius,
      fill: colors.card.fill,
      stroke: colors.card.stroke,
      strokeOpacity: tokens.quiet.opacity,
      strokeWidth: tokens.quiet.width,
    },
    lines: lines.map((text, i) => ({
      text,
      x: at.x,
      y:
        at.y +
        (i - (lines.length - 1) / 2) * tokens.caption.lineHeight +
        tokens.text.linkCaption.shift,
    })),
  }
}
