import { describe, expect, it } from 'vitest'
import { onRequest } from '../../functions/index'
import { languagePreferenceCookie, languageRedirect, preferredLanguage } from './index'

describe('entry language negotiation', () => {
  it.each([
    ['ja-JP,ja;q=0.9,en;q=0.8', 'ja'],
    ['en-US,en;q=0.9,ja;q=0.5', 'en'],
    ['fr-FR,ja;q=0.9,en;q=0.8', 'ja'],
    ['en;q=0.2,ja;q=0.9', 'ja'],
    ['ja;q=0,en;q=0.8', 'en'],
    ['en;q=0,*;q=0.8', 'ja'],
    ['ja;q=oops,en', 'en'],
    ['fr', 'en'],
    ['', 'en'],
  ])('%s → %s', (header, expected) => expect(preferredLanguage(header, null)).toBe(expected))
  it('gives the explicit preference priority and ignores invalid cookies', () => {
    expect(preferredLanguage('ja', 'other=x; shumoku_language=en')).toBe('en')
    expect(preferredLanguage('ja', 'shumoku_language=fr')).toBe('ja')
  })
  it('shares production preference without setting a domain on preview or localhost', () => {
    expect(languagePreferenceCookie('ja', new URL('https://docs.shumoku.dev'))).toContain(
      '; Secure; Domain=shumoku.dev',
    )
    expect(languagePreferenceCookie('en', new URL('https://preview.vercel.app'))).not.toContain(
      'Domain=',
    )
    expect(languagePreferenceCookie('en', new URL('http://localhost:4340'))).not.toContain('Secure')
  })
  it('does not cache a personalized redirect or set an inferred preference', () => {
    const response = languageRedirect(
      new Request('https://www.shumoku.dev/?source=example', {
        headers: { 'accept-language': 'ja' },
      }),
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/ja?source=example')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Accept-Language, Cookie')
    expect(response.headers.has('set-cookie')).toBe(false)
  })
  it('uses the same response on Cloudflare', () => {
    const response = onRequest({
      request: new Request('https://docs.shumoku.dev/', { headers: { 'accept-language': 'ja' } }),
    })
    expect(response.headers.get('location')).toBe('/ja')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
