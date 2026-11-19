/**
 * What one viewer chose for how the app looks and behaves in their browser: the theme, the
 * sidebar, which live layers a topology shows, and what a plain wheel does on a diagram. One place reads and writes them, and every
 * tab of the app (a shared page included) follows a change made in any other tab at once.
 *
 * A shared page may also be given a theme by its link (`?theme=light|dark`, for embedding): that
 * wins over the viewer's choice while the page is open, and is not kept. `static/theme-init.js`
 * applies the same rules before the first paint, so the page does not flash the other theme.
 */

import type { WheelChoice } from '@shumoku/renderer'
import { browser } from '$app/environment'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

/** The key `static/theme-init.js` reads too. */
export const PREFERENCES_KEY = 'shumoku-preferences'

interface Stored {
  theme: ThemeChoice
  sidebarCollapsed: boolean
  liveUpdates: boolean
  showTrafficFlow: boolean
  showNodeStatus: boolean
  /** What a plain wheel does on a diagram: scroll it (`pan`) or zoom it. */
  wheelBehavior: WheelChoice
}

const DEFAULTS: Stored = {
  theme: 'system',
  sidebarCollapsed: false,
  liveUpdates: true,
  showTrafficFlow: true,
  showNodeStatus: true,
  wheelBehavior: 'pan',
}

function isWheelChoice(value: unknown): value is WheelChoice {
  return value === 'zoom' || value === 'pan'
}

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** What is stored, each field checked; anything unreadable is the default. */
function read(text: string | null): Stored {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    // unreadable: the defaults stand
  }
  const flag = (key: keyof Stored) =>
    typeof parsed[key] === 'boolean' ? (parsed[key] as boolean) : (DEFAULTS[key] as boolean)
  return {
    theme: isThemeChoice(parsed['theme']) ? parsed['theme'] : DEFAULTS.theme,
    sidebarCollapsed: flag('sidebarCollapsed'),
    liveUpdates: flag('liveUpdates'),
    showTrafficFlow: flag('showTrafficFlow'),
    showNodeStatus: flag('showNodeStatus'),
    wheelBehavior: isWheelChoice(parsed['wheelBehavior'])
      ? parsed['wheelBehavior']
      : DEFAULTS.wheelBehavior,
  }
}

/** The theme a shared page's link names, if it names one. */
export function linkedTheme(url: URL): Theme | null {
  if (!url.pathname.startsWith('/share/')) return null
  const theme = url.searchParams.get('theme')
  return theme === 'light' || theme === 'dark' ? theme : null
}

class Preferences {
  theme = $state<ThemeChoice>(DEFAULTS.theme)
  sidebarCollapsed = $state(DEFAULTS.sidebarCollapsed)
  liveUpdates = $state(DEFAULTS.liveUpdates)
  showTrafficFlow = $state(DEFAULTS.showTrafficFlow)
  showNodeStatus = $state(DEFAULTS.showNodeStatus)
  wheelBehavior = $state<WheelChoice>(DEFAULTS.wheelBehavior)

  /** The theme a shared page's link gives, over the viewer's choice. */
  linked = $state<Theme | null>(null)
  /** Whether the system asks for dark, for the `system` choice. */
  systemDark = $state(false)

  /** The theme drawn: the link's, else the viewer's choice, else the system's. */
  readonly resolvedTheme: Theme = $derived(
    this.linked ?? (this.theme === 'system' ? (this.systemDark ? 'dark' : 'light') : this.theme),
  )

  /** Switch what is shown between light and dark, as the viewer's own choice (over a link). */
  toggleTheme(): void {
    const next = this.resolvedTheme === 'light' ? 'dark' : 'light'
    this.linked = null
    this.theme = next
  }

  load(stored: Stored): void {
    this.theme = stored.theme
    this.sidebarCollapsed = stored.sidebarCollapsed
    this.liveUpdates = stored.liveUpdates
    this.showTrafficFlow = stored.showTrafficFlow
    this.showNodeStatus = stored.showNodeStatus
    this.wheelBehavior = stored.wheelBehavior
  }

  stored(): Stored {
    return {
      theme: this.theme,
      sidebarCollapsed: this.sidebarCollapsed,
      liveUpdates: this.liveUpdates,
      showTrafficFlow: this.showTrafficFlow,
      showNodeStatus: this.showNodeStatus,
      wheelBehavior: this.wheelBehavior,
    }
  }
}

export const preferences = new Preferences()

if (browser) {
  preferences.load(read(localStorage.getItem(PREFERENCES_KEY)))
  preferences.linked = linkedTheme(new URL(window.location.href))
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  preferences.systemDark = system.matches
  system.addEventListener('change', (event) => {
    preferences.systemDark = event.matches
  })
  // Another tab changed them: follow it. (A tab is not told of its own writes.)
  window.addEventListener('storage', (event) => {
    if (event.key === PREFERENCES_KEY) preferences.load(read(event.newValue))
  })
  $effect.root(() => {
    $effect(() => {
      const text = JSON.stringify(preferences.stored())
      try {
        if (localStorage.getItem(PREFERENCES_KEY) !== text)
          localStorage.setItem(PREFERENCES_KEY, text)
      } catch {
        // storage refused (private mode): the choice lasts while the page is open
      }
    })
    $effect(() => {
      document.documentElement.classList.toggle('dark', preferences.resolvedTheme === 'dark')
    })
  })
}
