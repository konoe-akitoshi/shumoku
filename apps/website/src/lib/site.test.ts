import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { docsUrl, locales, siteNavigation, sitePages } from './site'

describe('site page registry', () => {
  it('keeps registered paths unique and backed by page routes', () => {
    expect(new Set(sitePages.map((entry) => entry.path)).size).toBe(sitePages.length)
    for (const entry of sitePages) {
      expect(
        existsSync(new URL(`../routes/[lang=lang]${entry.path}/+page.svelte`, import.meta.url)),
      ).toBe(true)
      expect(
        existsSync(new URL(`../routes/[lang=lang]${entry.path}/+page.ts`, import.meta.url)),
      ).toBe(true)
    }
  })

  it.each(locales)('uses localized labels and links for %s', (locale) => {
    const links = siteNavigation(locale)
    expect(links[0]?.href).toBe(docsUrl(locale))
    for (const entry of sitePages.filter(
      (entry) => entry.path && !('navigation' in entry && !entry.navigation),
    )) {
      expect(links).toContainEqual({
        href: `/${locale}${entry.path}`,
        label: entry.label[locale],
        path: entry.path,
      })
    }
  })

  it('keeps the Playground in workspace mode', () => {
    expect(
      sitePages.filter((entry) => entry.mode === 'workspace').map((entry) => entry.path),
    ).toEqual(['/playground'])
  })

  it.each(locales)('keeps the publishing destination discoverable in %s', (locale) => {
    expect(siteNavigation(locale).map((entry) => entry.path)).toEqual([
      null,
      '/playground',
      '/blog',
      '/community',
      '/support',
    ])
  })
})
