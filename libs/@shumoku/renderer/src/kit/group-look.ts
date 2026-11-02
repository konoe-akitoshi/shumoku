// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a group's frame looks like. A group is drawn in what the user wrote, else in the surface
 * it names, else in the default surface. The heading sits in a band above the contents, as tall
 * as the heading's line and the air above and below it.
 */

import type { Subgraph } from '@shumoku/core'
import type { KitColors } from './colors'
import type { Box } from './scene'
import type { Tokens } from './tokens'

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
    dash?: string
  }
  heading: { text: string; x: number; y: number; fill: string }
}

/** A group frame's insets around its contents: the heading band sits above, padding elsewhere. */
export function groupInsets(group: Subgraph, { group: frame }: Tokens) {
  const padding = group.style?.padding ?? frame.padding
  return { top: frame.labelBand, right: padding, bottom: padding, left: padding }
}

export function groupLook(group: Subgraph, box: Box, tokens: Tokens, colors: KitColors): GroupLook {
  const style = group.style ?? {}
  // A fill that names a surface takes that surface's fill, stroke and text.
  const surface =
    style.fill && Object.hasOwn(colors.surfaces, style.fill)
      ? colors.surfaces[style.fill as keyof typeof colors.surfaces]
      : undefined
  const base = surface ?? colors.group
  return {
    id: group.id,
    frame: {
      ...box,
      rx: tokens.group.cornerRadius,
      fill: surface ? surface.fill : (style.fill ?? base.fill),
      stroke: style.stroke ?? base.stroke,
      strokeWidth: style.strokeWidth ?? tokens.line.heavy,
      ...(style.strokeDasharray ? { dash: style.strokeDasharray } : {}),
    },
    heading: {
      text: group.label,
      x: box.x + tokens.group.labelX,
      y: box.y + tokens.group.labelBand / 2 + tokens.text.groupLabel.shift,
      fill: base.text,
    },
  }
}
