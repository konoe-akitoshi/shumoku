/**
 * Theme Setting Store
 * Synced with shumoku-settings in localStorage (shared with +layout.svelte)
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

function createThemeSettingStore() {
  const { subscribe, set } = writable<string>(loadTheme())

  return {
    subscribe,
    set(value: string) {
      set(value)
      if (browser) {
        try {
          const stored = localStorage.getItem(SETTINGS_KEY)
          const settings = stored ? JSON.parse(stored) : {}
          settings.theme = value
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
        } catch {}
      }
    },
  }
}

export const themeSetting = createThemeSettingStore()
