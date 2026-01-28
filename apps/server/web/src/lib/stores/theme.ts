/**
 * Theme Setting Store
 * Single source of truth for theme. Syncs to localStorage and DOM.
 */

import { writable } from 'svelte/store'
import { browser } from '$app/environment'

const SETTINGS_KEY = 'shumoku-settings'

function loadTheme(): string {
  if (!browser) return 'light'
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      return JSON.parse(stored).theme || 'light'
    }
  } catch {}
  return 'light'
}

function applyTheme(value: string) {
  if (!browser) return
  if (value === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function createThemeSettingStore() {
  const { subscribe, set: _set } = writable<string>(loadTheme())

  // Apply initial theme on creation
  if (browser) applyTheme(loadTheme())

  return {
    subscribe,
    set(value: string) {
      _set(value)
      applyTheme(value)
      if (browser) {
        try {
          const stored = localStorage.getItem(SETTINGS_KEY)
          const settings = stored ? JSON.parse(stored) : {}
          settings.theme = value
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
        } catch {}
      }
    },
    toggle() {
      const current = loadTheme()
      this.set(current === 'light' ? 'dark' : 'light')
    },
  }
}

export const themeSetting = createThemeSettingStore()
