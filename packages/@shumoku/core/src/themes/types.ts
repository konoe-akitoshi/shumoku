/**
 * Theme system types
 */

import type { DeviceType } from '../models/index.js'

/**
 * Surface token colors for subgraph rendering
 * Each token provides fill, stroke, and text colors
 */
export interface SurfaceColors {
  fill: string
  stroke: string
  text: string
}

/**
 * Available surface token names
 * Used in SubgraphStyle.fill to reference theme-aware colors
 */
export type SurfaceToken =
  | 'surface-1' // Lightest/default background
  | 'surface-2' // Slightly darker/more prominent
  | 'surface-3' // Most prominent surface
  | 'accent-blue' // Blue accent (cloud, external)
  | 'accent-green' // Green accent (internal, success)
  | 'accent-red' // Red accent (perimeter, security)
  | 'accent-amber' // Amber accent (highlight, warning)
  | 'accent-purple' // Purple accent

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
   * Surface token colors for subgraph rendering
   * Token-based system for theme-aware subgraph colors
   */
  surfaces: Record<SurfaceToken, SurfaceColors>

  /**
   * Grid and guides
   */
  grid: string
  guideline: string
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
