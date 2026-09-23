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

test('editor guides have a dedicated section and localized routes', () => {
  const model: RepositoryDocsModel = {
    ...repository,
    pages: [
      {
        id: 'editor-overview',
        owner: 'editor',
        route: 'overview',
        kind: 'overview',
        audience: 'user',
        publication: 'public',
        searchable: true,
        canonicalLocale: 'ja',
        title: { ja: 'Editor' },
        description: { ja: '操作ガイド' },
        sources: {
          ja: {
            locale: 'ja',
            file: 'apps/editor/docs/guide.md',
            manifest: 'apps/editor/docs.manifest.json',
            body: '# Editor',
          },
        },
      },
    ],
  }
  for (const lang of ['en', 'ja'] as const) {
    expect(
      docsSections(lang, `/${lang}/server/next`).find((section) => section.id === 'editor'),
    ).toMatchObject({ href: `/${lang}/editor` })
    expect(docsNavigation(`/${lang}/editor/scene`, lang, model)).toEqual([
      { label: 'Editor', href: `/${lang}/editor` },
    ])
  }
})
