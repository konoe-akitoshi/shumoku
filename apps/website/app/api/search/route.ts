import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

export const { GET } = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  // Japanese is not supported, using English for both
  localeMap: {
    en: { language: 'english' },
    ja: { language: 'english' },
  },
})
