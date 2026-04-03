/**
 * Display Settings Store
 * Controls what visualizations to show on the topology diagram
 *
 * This is separate from connection status (metricsConnected), which is read-only.
 * Display settings control what the user wants to see, connection status shows
 * whether real-time data is available.
 */

import { derived, writable } from 'svelte/store'
import { browser } from '$app/environment'

const STORAGE_KEY = 'shumoku-display-settings'

export interface DisplaySettings {
  // Whether to connect to WebSocket for real-time updates
  liveUpdates: boolean
  // Individual display toggles (only apply when connected and receiving data)
  showTrafficFlow: boolean // Show animated link utilization colors
  showNodeStatus: boolean // Show node up/down status indicators
}

const defaultSettings: DisplaySettings = {
  liveUpdates: true,
  showTrafficFlow: true,
  showNodeStatus: true,
}

function loadSettings(): DisplaySettings {
  if (!browser) return defaultSettings
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.error('[DisplaySettings] Failed to load settings:', e)
  }
  return defaultSettings
}

function saveSettings(settings: DisplaySettings): void {
  if (!browser) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('[DisplaySettings] Failed to save settings:', e)
  }
}

function createDisplaySettingsStore() {
  const { subscribe, set, update } = writable<DisplaySettings>(loadSettings())

  return {
    subscribe,

    setLiveUpdates(enabled: boolean) {
      update((s) => {
        const newSettings = { ...s, liveUpdates: enabled }
        saveSettings(newSettings)
        return newSettings
      })
    },

    setShowTrafficFlow(enabled: boolean) {
      update((s) => {
        const newSettings = { ...s, showTrafficFlow: enabled }
        saveSettings(newSettings)
        return newSettings
      })
    },

    setShowNodeStatus(enabled: boolean) {
      update((s) => {
        const newSettings = { ...s, showNodeStatus: enabled }
        saveSettings(newSettings)
        return newSettings
      })
    },

    reset() {
      set(defaultSettings)
      saveSettings(defaultSettings)
    },
  }
}

export const displaySettings = createDisplaySettingsStore()

// Derived stores for individual settings
export const liveUpdatesEnabled = derived(displaySettings, ($s) => $s.liveUpdates)
export const showTrafficFlow = derived(displaySettings, ($s) => $s.showTrafficFlow)
export const showNodeStatus = derived(displaySettings, ($s) => $s.showNodeStatus)
