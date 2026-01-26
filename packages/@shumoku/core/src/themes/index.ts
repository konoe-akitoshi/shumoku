/**
 * Theme system exports
 */

export { darkTheme } from './dark.js'
export { lightTheme, modernTheme } from './light.js'
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
  /** @deprecated Use 'light' instead */
  modern: lightTheme,
} as const

export type ThemeName = keyof typeof themes
