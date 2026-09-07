export const websiteOrigin = 'https://www.shumoku.dev'
export const docsOrigin = 'https://docs.shumoku.dev'
export const editorOrigin = 'https://editor.shumoku.dev'
export const locales = ['en', 'ja'] as const
export type Locale = (typeof locales)[number]
export const docsUrl = (locale: string, section = '') =>
  `${docsOrigin}/${locale === 'ja' ? 'ja' : 'en'}${section ? `/${section}` : ''}`

/** Shared by navigation and sitemap; route files own their content. */
export const sitePages = [
  { path: '', label: { en: 'Home', ja: 'ホーム' }, mode: 'content' },
  { path: '/playground', label: { en: 'Playground', ja: 'Playground' }, mode: 'workspace' },
  { path: '/about', label: { en: 'About', ja: 'Shumokuについて' }, mode: 'content' },
  { path: '/support', label: { en: 'Support', ja: 'サポート' }, mode: 'content' },
] as const

export function siteNavigation(locale: Locale) {
  return [
    { href: docsUrl(locale), label: 'Docs', path: null },
    ...sitePages
      .filter((entry) => entry.path)
      .map((entry) => ({
        href: `/${locale}${entry.path}`,
        label: entry.label[locale],
        path: entry.path,
      })),
  ]
}
