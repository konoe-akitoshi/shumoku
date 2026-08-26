import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRequestPrincipal } from '../auth/request-principal.js'
import { authMiddleware, getDevApiToken, validateDevApiAuthConfiguration } from './auth.js'

const TOKEN = 'a'.repeat(64)

const authService = vi.hoisted(() => ({
  isSetupComplete: vi.fn(() => true),
  getSessionPrincipal: vi.fn((): import('../auth/principal.js').AuthPrincipal | null => null),
}))

vi.mock('../services/auth.js', () => ({
  isSetupComplete: authService.isSetupComplete,
  getSessionPrincipal: authService.getSessionPrincipal,
  SESSION_COOKIE: 'shumoku_session',
}))

describe('development API bearer authentication', () => {
  afterEach(() => {
    delete process.env['SHUMOKU_DEV_API_TOKEN']
    delete process.env['HOST']
    delete process.env['NODE_ENV']
    delete process.env['PUBLIC_DEMO']
    authService.isSetupComplete.mockReturnValue(true)
    authService.getSessionPrincipal.mockReturnValue(null)
  })

  it('is disabled outside development even when a token is present', () => {
    expect(
      getDevApiToken({
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        SHUMOKU_DEV_API_TOKEN: TOKEN,
      }),
    ).toBeNull()
  })

  it('accepts a 256-bit hexadecimal token on loopback', () => {
    expect(
      getDevApiToken({
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        SHUMOKU_DEV_API_TOKEN: TOKEN,
      }),
    ).toBe(TOKEN)
  })

  it('rejects malformed credentials', () => {
    expect(() =>
      validateDevApiAuthConfiguration({
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        SHUMOKU_DEV_API_TOKEN: 'too-short',
      }),
    ).toThrow('64-character hexadecimal token')
  })

  it('rejects plaintext bearer authentication on non-loopback hosts', () => {
    expect(() =>
      validateDevApiAuthConfiguration({
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        SHUMOKU_DEV_API_TOKEN: TOKEN,
      }),
    ).toThrow('requires HOST=127.0.0.1 or HOST=::1')
  })

  it('authenticates the real management middleware with Hono bearer semantics', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['HOST'] = '127.0.0.1'
    process.env['SHUMOKU_DEV_API_TOKEN'] = TOKEN

    const app = new Hono()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    const accepted = await app.request('/protected', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(accepted.status).toBe(200)

    const rejected = await app.request('/protected', {
      headers: { Authorization: `Bearer ${'b'.repeat(64)}` },
    })
    expect(rejected.status).toBe(401)
    expect(rejected.headers.get('www-authenticate')).toContain('Bearer')
  })

  it('does not accept the development token in production', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['HOST'] = '0.0.0.0'
    process.env['SHUMOKU_DEV_API_TOKEN'] = TOKEN

    const app = new Hono()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    const response = await app.request('/protected', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(response.status).toBe(401)
  })

  it('preserves the existing authenticated session-cookie flow', async () => {
    authService.getSessionPrincipal.mockReturnValue({
      subject: 'local-admin',
      role: 'admin',
      authMethod: 'password',
    })

    const app = new Hono()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    const response = await app.request('/protected', {
      headers: { Cookie: 'shumoku_session=browser-session' },
    })
    expect(response.status).toBe(200)
    expect(authService.getSessionPrincipal).toHaveBeenCalledWith('browser-session')
  })

  it('propagates a normal-user principal and enforces admin permissions', async () => {
    authService.getSessionPrincipal.mockReturnValue({
      subject: 'user-1',
      role: 'user',
      authMethod: 'password',
    })

    const app = new Hono()
    app.use('/api/*', authMiddleware)
    app.post('/api/topologies', (c) => c.json(getRequestPrincipal(c.req.raw)))
    app.get('/api/settings', (c) => c.json({ sensitive: true }))

    const workspaceResponse = await app.request('/api/topologies', {
      method: 'POST',
      headers: { Cookie: 'shumoku_session=user-session' },
    })
    expect(workspaceResponse.status).toBe(200)
    expect(await workspaceResponse.json()).toMatchObject({ subject: 'user-1', role: 'user' })

    const adminResponse = await app.request('/api/settings', {
      headers: { Cookie: 'shumoku_session=user-session' },
    })
    expect(adminResponse.status).toBe(403)
  })

  it('fails closed before initial password setup', async () => {
    authService.isSetupComplete.mockReturnValue(false)

    const app = new Hono()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    expect((await app.request('/protected')).status).toBe(503)
  })

  it('allows and projects explicit public-demo reads', async () => {
    process.env['PUBLIC_DEMO'] = 'true'
    const app = new Hono()
    app.use('/api/*', authMiddleware)
    app.get('/api/datasources', (c) =>
      c.json([{ id: 'source-1', configJson: '{"password":"secret"}', statusMessage: 'internal' }]),
    )

    const response = await app.request('/api/datasources')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ id: 'source-1', configJson: '{}' }])
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('denies public-demo mutations and sensitive read surfaces', async () => {
    process.env['PUBLIC_DEMO'] = 'true'
    const app = new Hono()
    app.use('/api/*', authMiddleware)
    app.post('/api/topologies', (c) => c.json({ ok: true }))
    app.get('/api/settings', (c) => c.json({ auth_password_hash: 'secret' }))

    expect((await app.request('/api/topologies', { method: 'POST' })).status).toBe(403)
    expect((await app.request('/api/settings')).status).toBe(403)
  })
})
