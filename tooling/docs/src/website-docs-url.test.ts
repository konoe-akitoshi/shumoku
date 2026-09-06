import { expect, test } from 'bun:test'
import { docsUrl } from '../../../apps/website/lib/docs-url'

test('homepage documentation links use the public origin and preserve language', () => {
  for (const locale of ['en', 'ja']) {
    expect(docsUrl(locale)).toBe(`https://docs.shumoku.dev/${locale}`)
    for (const section of ['library', 'cli', 'server']) {
      expect(docsUrl(locale, section)).toBe(`https://docs.shumoku.dev/${locale}/${section}`)
    }
  }
  expect(docsUrl('fr')).toBe('https://docs.shumoku.dev/en')
})
