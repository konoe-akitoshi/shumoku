import { expect, test } from 'bun:test'
import type { RepositoryDocsModel, ServerDocsArtifact } from './model/docs-model'
import { docsNavigation, docsSections } from './model/navigation'

const repository: RepositoryDocsModel = { schemaVersion: 2, sourceCommit: 'test', pages: [] }

test('intro and product pages are standalone entries, not artificial groups', () => {
  for (const lang of ['en', 'ja'] as const) {
    expect(docsSections(lang, `/${lang}/server/next`)[0]?.label).toBe(
      lang === 'ja' ? 'はじめに' : 'Start here',
    )
    const intro = docsNavigation(`/${lang}/overview`, lang, repository)
    expect(intro[0]).toEqual({
      label: lang === 'ja' ? 'Docsホーム' : 'Docs home',
      href: `/${lang}`,
    })
    expect(intro[1]).toEqual({
      label: lang === 'ja' ? 'クイックスタート' : 'Quick start',
      href: `/${lang}/getting-started`,
    })
    for (const section of ['library', 'cli']) {
      const items = docsNavigation(`/${lang}/${section}`, lang, repository)
      expect(items[0]).toHaveProperty('href', `/${lang}/${section}`)
      expect(items[0]).not.toHaveProperty('links')
    }
  }
})

test('released mixed navigation preserves standalone links and historical groups', () => {
  const navigation = [
    { label: 'Overview', href: '/en/server/1.0.0' },
    { label: 'Historical guides', links: [{ label: 'Setup', href: '/en/server/1.0.0/setup' }] },
  ]
  const artifact = { navigation: { en: navigation, ja: navigation } } as ServerDocsArtifact
  expect(docsNavigation('/en/server/1.0.0', 'en', repository, artifact)).toEqual(navigation)
})
