// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a wire looks like: the one place that turns a link's meaning into a spec. The component
 * draws the spec as it is and reads no link field itself.
 */

import type { Link } from '@shumoku/core'
import type { RenderColors } from '../lib/render-colors'
import { vlanStroke } from './geometry'
import type { Tokens } from './tokens'

interface WireLook {
  color: string
  /** The width the line is drawn at. */
  stroke: number
  /** Dash and gap lengths along the line; solid when absent. */
  dash?: number[]
}

/** A pattern given as multiples of a line's own stroke, as lengths on that line. */
export function dashOf(pattern: readonly number[], stroke: number): number[] {
  return pattern.map((r) => r * stroke)
}

/** Dashed for a virtual link, dotted for one assumed rather than confirmed. */
function patternOf(link: Link, { wire }: Tokens): readonly number[] | undefined {
  if (link.type === 'dashed') return wire.dashed
  if (link.type === 'dotted') return wire.dotted
  return undefined
}

/**
 * A wire's look. The colour is what the user wrote, else the VLAN's, else the theme's. Dashes
 * are multiples of the line's own stroke, so a thick line keeps the look of a thin one.
 */
export function wireLook(
  { link, stroke }: { link: Link; stroke: number },
  tokens: Tokens,
  colors: RenderColors,
): WireLook {
  const color = link.style?.stroke ?? vlanStroke(link.vlan) ?? colors.linkStroke
  const written = link.style?.strokeDasharray
    ?.split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  const pattern = patternOf(link, tokens)
  const dash = pattern ? dashOf(pattern, stroke) : written?.some(Number.isNaN) ? undefined : written
  return { color, stroke, ...(dash && dash.length > 0 && { dash }) }
}
