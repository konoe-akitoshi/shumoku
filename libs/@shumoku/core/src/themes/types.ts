// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Theme system types
 */

import type { DeviceType } from '../models/index.js'

import type { GroupTone } from './group-tone.js'
import type { LineTone } from './tone.js'

/** What a group is drawn in: its fill, its edge and its heading. */
export interface SurfaceColors {
  fill: string
  stroke: string
  text: string
}

export interface ThemeColors {
  /**
   * Background colors
   */
  background: string
  surface: string
  surfaceHover: string

  /**
   * Text colors
   */
  text: string
  textSecondary: string
  textDisabled: string

  /**
   * Primary palette
   */
  primary: string
  primaryHover: string
  primaryActive: string

  /**
   * Secondary palette
   */
  secondary: string
  secondaryHover: string
  secondaryActive: string

  /**
   * Status colors
   */
  success: string
  warning: string
  error: string
  info: string

  /**
   * Link colors
   */
  link: string
  linkHover: string
  linkDown: string

  /**
   * Device type colors
   */
  devices: Partial<Record<DeviceType | string, string>>

  /**
   * Module colors (for Bento Grid)
   * @deprecated Use zonePresets instead
   */
  modules: {
    core: string
    distribution: string
    access: string
    dmz: string
    cloud: string
    default: string
  }

  /**
   * The neutral surfaces, by depth: the first at the top level, each next one a step further from
   * the background; deeper groups take the last. What a page around a drawing is set in (the
   * HTML output's panels). Held by `surfaces.test.ts`.
   */
  groupSurfaces: readonly [SurfaceColors, SurfaceColors, SurfaceColors]

  /**
   * The tone groups are drawn in, each in the hue its id picks (see `GroupTone`; the theme tests
   * hold every hue of it to what `groupSurfaces` keep)
   */
  groupTone: GroupTone

  /**
   * Grid and guides
   */
  grid: string
  guideline: string

  /**
   * Where a link meets a card: the square marker and the chip that names it
   */
  port: {
    fill: string
    stroke: string
    labelBackground: string
    labelText: string
  }

  /**
   * The slab behind a redundancy set (HA pair, stack); the one colour that serves on both variants' canvas
   */
  hull: string

  /**
   * The drop shadow under a card
   */
  shadow: string

  /**
   * The tone lines are told apart in, such as one colour per VLAN (see `LineTone`; the theme tests
   * hold it to being seen against every background here)
   */
  lineTone: LineTone
}

export interface ThemeDimensions {
  /**
   * Device dimensions
   */
  device: {
    small: { width: number; height: number }
    medium: { width: number; height: number }
    large: { width: number; height: number }
  }

  /**
   * Font sizes
   */
  fontSize: {
    tiny: number
    small: number
    medium: number
    large: number
    huge: number
  }

  /**
   * Line widths
   */
  lineWidth: {
    thin: number
    normal: number
    thick: number
    emphasis: number
  }

  /**
   * Spacing
   */
  spacing: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
  }

  /**
   * Border radius
   */
  radius: {
    small: number
    medium: number
    large: number
    round: number
  }
}

export interface ThemeShadows {
  /**
   * Shadow definitions
   */
  none: ShadowDefinition
  small: ShadowDefinition
  medium: ShadowDefinition
  large: ShadowDefinition
  glow: ShadowDefinition
}

export interface ShadowDefinition {
  color: string
  blur: number
  offsetX: number
  offsetY: number
  alpha?: number
}

export interface ThemeAnimations {
  /**
   * Animation durations in ms
   */
  duration: {
    instant: number
    fast: number
    normal: number
    slow: number
  }

  /**
   * Easing functions
   */
  easing: {
    linear: string
    easeIn: string
    easeOut: string
    easeInOut: string
    bounce: string
  }
}

export interface ThemeTypography {
  /**
   * Font families
   */
  fontFamily: {
    sans: string
    mono: string
    display: string
  }

  /**
   * Font weights
   */
  fontWeight: {
    light: number
    regular: number
    medium: number
    semibold: number
    bold: number
  }

  /**
   * Letter spacing
   */
  letterSpacing: {
    tight: number
    normal: number
    wide: number
  }
}

export interface Theme {
  /**
   * Theme name
   */
  name: string

  /**
   * Theme variant
   */
  variant: 'light' | 'dark'

  /**
   * Color definitions
   */
  colors: ThemeColors

  /**
   * Size definitions
   */
  dimensions: ThemeDimensions

  /**
   * Shadow definitions
   */
  shadows: ThemeShadows

  /**
   * Animation settings
   */
  animations: ThemeAnimations

  /**
   * Typography settings
   */
  typography: ThemeTypography

  /**
   * Custom properties
   */
  custom?: Record<string, unknown>
}

export interface ThemeOptions {
  /**
   * Base theme to extend
   */
  extends?: Theme

  /**
   * Partial overrides
   */
  overrides?: DeepPartial<Theme>
}

// Utility type for deep partial
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer U)[]
      ? readonly DeepPartial<U>[]
      : DeepPartial<T[P]>
}
