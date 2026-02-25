/**
 * Theme utilities
 */

import type { DeepPartial, Theme, ThemeOptions } from './types.js'
import { lightTheme } from './light.js'

/**
 * Merge theme with overrides
 */
export function mergeTheme(base: Theme, overrides?: DeepPartial<Theme>): Theme {
  if (!overrides) return base

  return deepMerge(base, overrides) as Theme
}

/**
 * Create custom theme
 */
export function createTheme(options: ThemeOptions): Theme {
  const base = options.extends || getDefaultTheme()
  return mergeTheme(base, options.overrides)
}

/**
 * Apply theme to CSS variables
 */
export function applyThemeToCSS(theme: Theme, root: HTMLElement = document.documentElement): void {
  const prefix = '--shumoku'

  // Colors
  root.style.setProperty(`${prefix}-bg`, theme.colors.background)
  root.style.setProperty(`${prefix}-surface`, theme.colors.surface)
  root.style.setProperty(`${prefix}-text`, theme.colors.text)
  root.style.setProperty(`${prefix}-text-secondary`, theme.colors.textSecondary)
  root.style.setProperty(`${prefix}-primary`, theme.colors.primary)
  root.style.setProperty(`${prefix}-secondary`, theme.colors.secondary)
  root.style.setProperty(`${prefix}-success`, theme.colors.success)
  root.style.setProperty(`${prefix}-warning`, theme.colors.warning)
  root.style.setProperty(`${prefix}-error`, theme.colors.error)
  root.style.setProperty(`${prefix}-info`, theme.colors.info)

  // Dimensions
  root.style.setProperty(`${prefix}-radius-sm`, `${theme.dimensions.radius.small}px`)
  root.style.setProperty(`${prefix}-radius-md`, `${theme.dimensions.radius.medium}px`)
  root.style.setProperty(`${prefix}-radius-lg`, `${theme.dimensions.radius.large}px`)

  // Spacing
  root.style.setProperty(`${prefix}-space-xs`, `${theme.dimensions.spacing.xs}px`)
  root.style.setProperty(`${prefix}-space-sm`, `${theme.dimensions.spacing.sm}px`)
  root.style.setProperty(`${prefix}-space-md`, `${theme.dimensions.spacing.md}px`)
  root.style.setProperty(`${prefix}-space-lg`, `${theme.dimensions.spacing.lg}px`)
  root.style.setProperty(`${prefix}-space-xl`, `${theme.dimensions.spacing.xl}px`)

  // Typography
  root.style.setProperty(`${prefix}-font-sans`, theme.typography.fontFamily.sans)
  root.style.setProperty(`${prefix}-font-mono`, theme.typography.fontFamily.mono)

  // Shadows
  const shadowToCSS = (shadow: Theme['shadows'][keyof Theme['shadows']]) => {
    const alpha = shadow.alpha || 1
    const color = hexToRgba(shadow.color, alpha)
    return `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${color}`
  }

  root.style.setProperty(`${prefix}-shadow-sm`, shadowToCSS(theme.shadows.small))
  root.style.setProperty(`${prefix}-shadow-md`, shadowToCSS(theme.shadows.medium))
  root.style.setProperty(`${prefix}-shadow-lg`, shadowToCSS(theme.shadows.large))

  // Set theme variant
  root.setAttribute('data-theme', theme.variant)
}

/**
 * Get theme from CSS variables
 */
export function getThemeFromCSS(root: HTMLElement = document.documentElement): Partial<Theme> {
  const prefix = '--shumoku'
  const style = getComputedStyle(root)

  const getVar = (name: string) => style.getPropertyValue(`${prefix}-${name}`).trim()

  return {
    variant: (root.getAttribute('data-theme') as 'light' | 'dark') || 'light',
    colors: {
      background: getVar('bg'),
      surface: getVar('surface'),
      text: getVar('text'),
      textSecondary: getVar('text-secondary'),
      primary: getVar('primary'),
      secondary: getVar('secondary'),
      success: getVar('success'),
      warning: getVar('warning'),
      error: getVar('error'),
      info: getVar('info'),
    } as Theme['colors'],
  }
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex: string, alpha = 1): string {
  if (hex === 'transparent') return 'transparent'

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex

  const r = Number.parseInt(result[1], 16)
  const g = Number.parseInt(result[2], 16)
  const b = Number.parseInt(result[3], 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Deep merge utility
 */
// biome-ignore lint/suspicious/noExplicitAny: generic deep merge requires any types
function deepMerge(target: any, source: any): any {
  if (!source) return target

  const result = { ...target }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
  }

  return result
}

/**
 * Get default theme
 */
function getDefaultTheme(): Theme {
  return lightTheme
}
