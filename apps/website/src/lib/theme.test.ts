import { describe, expect, it } from 'vitest'
import { isDarkTheme, preferenceAfterToggle } from './theme'

describe('theme preference', () => {
  it('follows the OS without an explicit override', () => {
    expect(isDarkTheme(null, true)).toBe(true)
    expect(isDarkTheme(null, false)).toBe(false)
  })

  it('lets an explicit override win over the OS', () => {
    expect(isDarkTheme('light', true)).toBe(false)
    expect(isDarkTheme('dark', false)).toBe(true)
  })

  it('stores only choices that differ from the OS', () => {
    expect(preferenceAfterToggle(false, true)).toBeNull()
    expect(preferenceAfterToggle(true, true)).toBe('light')
    expect(preferenceAfterToggle(false, false)).toBe('dark')
    expect(preferenceAfterToggle(true, false)).toBeNull()
  })
})
