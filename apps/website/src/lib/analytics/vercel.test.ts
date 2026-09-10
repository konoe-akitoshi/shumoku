import { beforeEach, expect, it, vi } from 'vitest'

const injectAnalytics = vi.hoisted(() => vi.fn())
vi.mock('@vercel/analytics/sveltekit', () => ({ injectAnalytics }))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

it('does not load until permitted and initializes only once', async () => {
  const client = await import('./vercel')
  client.setVercelAnalytics(false)
  expect(injectAnalytics).not.toHaveBeenCalled()
  client.setVercelAnalytics(true)
  client.setVercelAnalytics(true)
  expect(injectAnalytics).toHaveBeenCalledTimes(1)
  expect(injectAnalytics).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'production', debug: false }),
  )
})

it('redacts query/hash and blocks events after withdrawal', async () => {
  const client = await import('./vercel')
  const event = { type: 'pageview' as const, url: 'https://www.shumoku.dev/en?secret=value#input' }
  client.setVercelAnalytics(true)
  expect(client.filterVercelEvent(event)?.url).toBe('https://www.shumoku.dev/en')
  expect(event.url).toContain('secret')
  expect(client.filterVercelEvent({ type: 'event', url: event.url })).toBeNull()
  expect(client.filterVercelEvent({ type: 'pageview', url: 'invalid' })).toBeNull()
  client.setVercelAnalytics(false)
  expect(client.filterVercelEvent(event)).toBeNull()
})
