// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a group's frame looks like. Nobody picks it: a group is drawn in the hue of the theme's
 * `groupTone` its id picks (`groupHueOf`), a step further from the background with each depth.
 * Fill, edge and heading all follow; nothing written on the group changes them. The heading sits in a band above the contents, as tall as
 * the heading's line and the air above and below it.
 */

import { groupColors, groupHueOf, type Subgraph } from '@shumoku/core'
import type { KitColors } from './colors.js'
import type { Box } from './scene.js'
import type { Tokens } from './tokens.js'

export interface GroupLook {
  id: string
  frame: {
    x: number
    y: number
    width: number
    height: number
    rx: number
    fill: string
    stroke: string
    strokeWidth: number
  }
  heading: { text: string; x: number; y: number; fill: string }
}

/** A group frame's insets around its contents: the heading band sits above, padding elsewhere. */
export function groupInsets(group: Subgraph, { group: frame }: Tokens) {
  const padding = group.style?.padding ?? frame.padding
  return { top: frame.labelBand, right: padding, bottom: padding, left: padding }
}

export function groupLook(
  group: Subgraph,
  box: Box,
  depth: number,
  tokens: Tokens,
  colors: KitColors,
): GroupLook {
  const surface = groupColors(colors.groupTone, depth, groupHueOf(colors.groupTone, group.id))
  return {
    id: group.id,
    frame: {
      ...box,
      rx: tokens.group.cornerRadius,
      fill: surface.fill,
      stroke: surface.stroke,
      strokeWidth: tokens.line.heavy,
    },
    heading: {
      text: group.label,
      x: box.x + tokens.group.labelX,
      y: box.y + tokens.group.labelBand / 2 + tokens.text.groupLabel.shift,
      fill: surface.text,
    },
  }
}
