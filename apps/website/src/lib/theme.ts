export type ThemePreference = 'light' | 'dark'
export const themeStorageKey = 'theme'
export const darkSchemeQuery = '(prefers-color-scheme: dark)'

/** Anything other than an explicit override (missing, blocked storage, legacy 'system') follows the OS. */
export function readThemePreference(): ThemePreference | null {
  try {
    const value = localStorage.getItem(themeStorageKey)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function isDarkTheme(preference: ThemePreference | null, systemDark: boolean): boolean {
  return preference ? preference === 'dark' : systemDark
}

/** Choosing the OS scheme is not an override: clear it so the page keeps following the OS. */
export function preferenceAfterToggle(dark: boolean, systemDark: boolean): ThemePreference | null {
  const nextDark = !dark
  if (nextDark === systemDark) return null
  return nextDark ? 'dark' : 'light'
}
