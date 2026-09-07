import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const append = vi.fn()
const reload = vi.fn()
let target: { dataLayer?: unknown[]; 'ga-disable-G-SHX2VE8F8F'?: boolean }

beforeEach(() => {
  vi.resetModules()
  append.mockReset()
  reload.mockReset()
  target = {}
  vi.stubGlobal('window', Object.assign(target, { location: { reload } }))
  vi.stubGlobal('document', { cookie: '', createElement: () => ({}), head: { append } })
})
afterEach(() => vi.unstubAllGlobals())

describe('Google tag lifecycle', () => {
  it('does not create a tag or queue when disabled', async () => {
    const { setGoogleAnalytics } = await import('./google')
    setGoogleAnalytics(false)
    expect(append).not.toHaveBeenCalled()
    expect(target.dataLayer).toBeUndefined()
    expect(reload).not.toHaveBeenCalled()
  })
  it('initializes once without a second manual page-view stream', async () => {
    const { setGoogleAnalytics } = await import('./google')
    setGoogleAnalytics(true)
    setGoogleAnalytics(true)
    const commands = target.dataLayer?.map((item) => Array.from(item as IArguments))
    expect(commands?.map((item) => item[0])).toEqual(['consent', 'js', 'config'])
    expect(commands?.[0]?.[2]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    expect(commands?.[2]?.[2]).toMatchObject({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: 'none',
    })
    expect(append).toHaveBeenCalledTimes(1)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        async: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=G-SHX2VE8F8F',
      }),
    )
  })
  it('disables tracking and reloads on withdrawal without sending a denied ping', async () => {
    const { setGoogleAnalytics } = await import('./google')
    setGoogleAnalytics(true)
    setGoogleAnalytics(false)
    expect(target['ga-disable-G-SHX2VE8F8F']).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
    expect(target.dataLayer).toHaveLength(3)
  })
})
