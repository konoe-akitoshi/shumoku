import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerLegacyTopologyRoutes } from './legacy-topology.js'

const authService = vi.hoisted(() => ({
  isSetupComplete: vi.fn(() => true),
  validateSession: vi.fn(() => false),
}))

vi.mock('../services/auth.js', () => ({
  isSetupComplete: authService.isSetupComplete,
  SESSION_COOKIE: 'shumoku_session',
  validateSession: authService.validateSession,
}))

function createApp() {
  const app = new Hono()
  const getTopology = vi.fn(() => undefined)
  registerLegacyTopologyRoutes(app, { getTopology }, { thresholds: [] })
  return { app, getTopology }
}

describe('legacy topology route authentication', () => {
  afterEach(() => {
    authService.isSetupComplete.mockReturnValue(true)
    authService.validateSession.mockReturnValue(false)
  })

  it.each([
    '/api/topology/example',
    '/topology/example',
  ])('rejects an anonymous request to %s before topology lookup', async (pathname) => {
    const { app, getTopology } = createApp()

    expect((await app.request(pathname)).status).toBe(401)
    expect(getTopology).not.toHaveBeenCalled()
  })

  it('preserves session access to the legacy routes', async () => {
    authService.validateSession.mockReturnValue(true)
    const { app, getTopology } = createApp()

    const response = await app.request('/api/topology/example', {
      headers: { Cookie: 'shumoku_session=browser-session' },
    })

    expect(response.status).toBe(404)
    expect(getTopology).toHaveBeenCalledWith('example')
  })

  it('preserves access before initial password setup', async () => {
    authService.isSetupComplete.mockReturnValue(false)
    const { app, getTopology } = createApp()

    expect((await app.request('/api/topology/example')).status).toBe(404)
    expect(getTopology).toHaveBeenCalledWith('example')
  })
})
