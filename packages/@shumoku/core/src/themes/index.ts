/**
 * Theme system exports
 */

export * from './types'
export { modernTheme } from './modern'
export { darkTheme } from './dark'
export { 
  mergeTheme, 
  createTheme, 
  applyThemeToCSS, 
  getThemeFromCSS 
} from './utils'

// Default themes map
import { modernTheme } from './modern'
import { darkTheme } from './dark'

export const themes = {
  modern: modernTheme,
  dark: darkTheme,
} as const

export type ThemeName = keyof typeof themes