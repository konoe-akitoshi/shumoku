export const websiteOrigin = 'https://www.shumoku.dev'
export const docsOrigin = 'https://docs.shumoku.dev'
export const editorOrigin = 'https://editor.shumoku.dev'
export const locales = ['en', 'ja'] as const
export type Locale = (typeof locales)[number]
export const docsUrl = (locale: string, section = '') =>
  `${docsOrigin}/${locale === 'ja' ? 'ja' : 'en'}${section ? `/${section}` : ''}`
