import { defineI18n } from 'fumadocs-core/i18n'

export const i18n = defineI18n({
  defaultLanguage: 'ja',
  languages: ['ja', 'en'],
  fallbackLanguage: 'ja',
  hideLocale: 'never',
})

export type Locale = (typeof i18n)['languages'][number]
