import { describe, expect, it, vi } from 'vitest'
import { analyticsPolicy, fetchPolicy, isWebsiteHost, shouldMeasure } from './policy'

describe('analytics policy', () => {
  it('enables opt-out only for Japan in production', () => {
    expect(analyticsPolicy('JP', true)).toEqual({ enabled: true, requiresConsent: false })
    for (const country of ['DE', 'US', 'jp', '', null]) {
      expect(analyticsPolicy(country, true)).toEqual({ enabled: true, requiresConsent: true })
    }
    expect(analyticsPolicy('JP', false).enabled).toBe(false)
  })
  it('always respects a saved rejection, including in Japan', () => {
    expect(shouldMeasure(analyticsPolicy('JP', true), false)).toBe(false)
    expect(shouldMeasure(analyticsPolicy('JP', true), undefined)).toBe(true)
    expect(shouldMeasure(analyticsPolicy('DE', true), undefined)).toBe(false)
    expect(shouldMeasure(analyticsPolicy('DE', true), true)).toBe(true)
    expect(shouldMeasure(analyticsPolicy('JP', false), true)).toBe(false)
  })
  it('does not activate on local, preview, docs or editor hosts', () => {
    for (const url of [
      'http://127.0.0.1:4340/ja',
      'https://preview.vercel.app',
      'https://docs.shumoku.dev',
      'https://editor.shumoku.dev',
      'https://www.shumoku.dev.evil.test',
      'http://www.shumoku.dev',
    ]) {
      expect(isWebsiteHost(new URL(url), true)).toBe(false)
    }
    expect(isWebsiteHost(new URL('https://www.shumoku.dev'), false)).toBe(false)
    expect(isWebsiteHost(new URL('https://www.shumoku.dev'), true)).toBe(true)
  })
  it('fails closed on network errors and malformed policy responses', async () => {
    const fallback = { enabled: false, requiresConsent: true }
    const fetcher = vi.fn<typeof fetch>()
    fetcher.mockRejectedValueOnce(new Error('timeout'))
    expect(await fetchPolicy(fetcher)).toEqual(fallback)
    fetcher.mockResolvedValueOnce(Response.json({ enabled: true }))
    expect(await fetchPolicy(fetcher)).toEqual(fallback)
    fetcher.mockResolvedValueOnce(new Response('', { status: 500 }))
    expect(await fetchPolicy(fetcher)).toEqual(fallback)
    fetcher.mockResolvedValueOnce(Response.json({ enabled: true, requiresConsent: false }))
    expect(await fetchPolicy(fetcher)).toEqual({ enabled: true, requiresConsent: false })
    expect(fetcher).toHaveBeenCalledWith(
      '/api/analytics-policy',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    )
  })
})
