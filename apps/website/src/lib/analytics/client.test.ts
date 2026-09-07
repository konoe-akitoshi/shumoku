import type { CookieConsentConfig } from 'vanilla-cookieconsent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  validConsent: vi.fn(),
  acceptedCategory: vi.fn(),
  setLanguage: vi.fn(),
  showPreferences: vi.fn(),
  setGoogleAnalytics: vi.fn(),
}))
vi.mock('vanilla-cookieconsent', () => mocks)
vi.mock('./google', () => ({ setGoogleAnalytics: mocks.setGoogleAnalytics }))
vi.mock('./vercel', () => ({ setVercelAnalytics: vi.fn() }))
const fetcher = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('PROD', true)
  vi.stubGlobal('window', { location: { href: 'https://www.shumoku.dev/ja' } })
  vi.stubGlobal('document', { documentElement: { lang: 'ja' } })
  vi.stubGlobal('fetch', fetcher)
  fetcher.mockResolvedValue(Response.json({ enabled: true, requiresConsent: false }))
  mocks.validConsent.mockReturnValue(false)
  mocks.acceptedCategory.mockReturnValue(false)
  mocks.run.mockResolvedValue(undefined)
  mocks.setLanguage.mockResolvedValue(true)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('consent integration', () => {
  it('initializes once in Japan, without displaying or blocking the page', async () => {
    const client = await import('./client')
    await Promise.all([client.initializeAnalytics(), client.initializeAnalytics()])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(mocks.run).toHaveBeenCalledTimes(1)
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({
        autoShow: false,
        mode: 'opt-out',
        disablePageInteraction: false,
      }),
    )
    expect(mocks.setGoogleAnalytics).toHaveBeenLastCalledWith(true)
  })
  it('respects a saved rejection in Japan', async () => {
    mocks.validConsent.mockReturnValue(true)
    const client = await import('./client')
    await client.initializeAnalytics()
    expect(mocks.setGoogleAnalytics).toHaveBeenLastCalledWith(false)
  })
  it('waits for consent outside Japan and handles rejection afterwards', async () => {
    fetcher.mockResolvedValue(Response.json({ enabled: true, requiresConsent: true }))
    const client = await import('./client')
    await client.initializeAnalytics()
    expect(mocks.setGoogleAnalytics).toHaveBeenLastCalledWith(false)
    const config = mocks.run.mock.calls[0]?.[0] as CookieConsentConfig
    expect(config.autoShow).toBe(true)
    expect(config.mode).toBe('opt-in')
    mocks.validConsent.mockReturnValue(true)
    mocks.acceptedCategory.mockReturnValue(true)
    // The callback reads the library's saved state rather than defaulting by country.
    const callback = config.onConsent as () => void
    callback()
    expect(mocks.setGoogleAnalytics).toHaveBeenLastCalledWith(true)
    mocks.acceptedCategory.mockReturnValue(false)
    const changed = config.onChange as () => void
    changed()
    expect(mocks.setGoogleAnalytics).toHaveBeenLastCalledWith(false)
  })
  it('opens preferences locally without requesting policy or sending analytics', async () => {
    vi.stubGlobal('window', { location: { href: 'http://127.0.0.1:4340/ja' } })
    const client = await import('./client')
    await client.openAnalyticsPreferences()
    expect(fetcher).not.toHaveBeenCalled()
    expect(mocks.setGoogleAnalytics).toHaveBeenLastCalledWith(false)
    expect(mocks.showPreferences).toHaveBeenCalledOnce()
    expect(mocks.setLanguage).toHaveBeenCalledWith('ja')
  })
})
