// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Theme system exports
 */

export { darkTheme } from './dark.js'
export { lightTheme } from './light.js'
export * from './types.js'
export {
  applyThemeToCSS,
  createTheme,
  getThemeFromCSS,
  mergeTheme,
} from './utils.js'

import { darkTheme } from './dark.js'
import { lightTheme } from './light.js'

// Default themes map
export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const

export type ThemeName = keyof typeof themes
