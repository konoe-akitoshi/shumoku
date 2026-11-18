import { afterEach, describe, expect, it } from 'vitest'
import { linkedTheme, preferences } from './preferences.svelte'

describe('preferences', () => {
  afterEach(() => {
    preferences.linked = null
    preferences.theme = 'system'
    preferences.systemDark = false
  })

  it('takes a theme from a shared page link only', () => {
    expect(linkedTheme(new URL('http://h/share/topologies/t?theme=dark'))).toBe('dark')
    expect(linkedTheme(new URL('http://h/share/dashboards/t?theme=light'))).toBe('light')
    expect(linkedTheme(new URL('http://h/share/topologies/t?theme=blue'))).toBeNull()
    expect(linkedTheme(new URL('http://h/topologies/t?theme=dark'))).toBeNull()
  })

  it("draws the link's theme, else the viewer's choice, else the system's", () => {
    preferences.systemDark = true
    expect(preferences.resolvedTheme).toBe('dark')
    preferences.theme = 'light'
    expect(preferences.resolvedTheme).toBe('light')
    preferences.linked = 'dark'
    expect(preferences.resolvedTheme).toBe('dark')
  })

  it('toggling leaves the link and the system for an explicit choice', () => {
    preferences.linked = 'dark'
    preferences.toggleTheme()
    expect(preferences.linked).toBeNull()
    expect(preferences.theme).toBe('light')
    expect(preferences.resolvedTheme).toBe('light')
  })
})
