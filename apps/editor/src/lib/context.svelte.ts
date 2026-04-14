import { darkTheme, lightTheme, type Theme } from '@shumoku/core'

// =========================================================================
// Editor state — module-level $state, importable from any component
// =========================================================================

let mode = $state<'edit' | 'view'>('view')
let isDark = $state(false)

export const editorState = {
  get mode() {
    return mode
  },
  set mode(v: 'edit' | 'view') {
    mode = v
  },
  get isDark() {
    return isDark
  },
  set isDark(v: boolean) {
    isDark = v
  },
  get theme(): Theme {
    return isDark ? darkTheme : lightTheme
  },
  get interactive() {
    return mode === 'edit'
  },
  toggleMode() {
    mode = mode === 'edit' ? 'view' : 'edit'
  },
  toggleTheme() {
    isDark = !isDark
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark)
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    }
  },
}

/** Call once in root layout to sync dark mode from DOM */
export function initDarkMode() {
  if (typeof document === 'undefined') return
  isDark = document.documentElement.classList.contains('dark')
  const obs = new MutationObserver(() => {
    isDark = document.documentElement.classList.contains('dark')
  })
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => obs.disconnect()
}
