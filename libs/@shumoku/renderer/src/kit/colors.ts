// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Every colour the kit draws with, read off a theme. Nothing in the kit names a colour of its
 * own; what a theme does not say is not drawn.
 */

import { lightTheme, type Theme } from '@shumoku/core'

export interface KitColors {
  background: string
  /** A card's fill and edge, and what its text is set in. */
  card: { fill: string; stroke: string; text: string; textSecondary: string }
  /** What a link is drawn in when nothing says otherwise. */
  link: string
  /** The tone groups are drawn in, each in the hue its id picks. */
  groupTone: Theme['colors']['groupTone']
  textSecondary: string
  port: Theme['colors']['port']
  hull: string
  shadow: string
  lineTone: Theme['colors']['lineTone']
}

export function kitColors(theme: Theme = lightTheme): KitColors {
  const { colors } = theme
  return {
    background: colors.background,
    card: {
      fill: colors.surface,
      stroke: colors.textSecondary,
      text: colors.text,
      textSecondary: colors.textSecondary,
    },
    link: colors.textSecondary,
    groupTone: colors.groupTone,
    textSecondary: colors.textSecondary,
    port: colors.port,
    hull: colors.hull,
    shadow: colors.shadow,
    lineTone: colors.lineTone,
  }
}
