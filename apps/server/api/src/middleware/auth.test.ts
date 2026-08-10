import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authMiddleware, getDevApiToken, validateDevApiAuthConfiguration } from './auth.js'

const TOKEN = 'a'.repeat(64)

const authService = vi.hoisted(() => ({
  isSetupComplete: vi.fn(() => true),
  validateSession: vi.fn(() => false),
}))

vi.mock('../services/auth.js', () => ({
  isSetupComplete: authService.isSetupComplete,
  SESSION_COOKIE: 'shumoku_session',
  validateSession: authService.validateSession,
}))

describe('development API bearer authentication', () => {
  afterEach(() => {
    delete process.env['SHUMOKU_DEV_API_TOKEN']
    delete process.env['HOST']
    delete process.env['NODE_ENV']
    authService.isSetupComplete.mockReturnValue(true)
    authService.validateSession.mockReturnValue(false)
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
    authService.validateSession.mockReturnValue(true)

    const app = new Hono()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    const response = await app.request('/protected', {
      headers: { Cookie: 'shumoku_session=browser-session' },
    })
    expect(response.status).toBe(200)
    expect(authService.validateSession).toHaveBeenCalledWith('browser-session')
  })

  it('preserves access before initial password setup', async () => {
    authService.isSetupComplete.mockReturnValue(false)

    const app = new Hono()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => c.json({ ok: true }))

    expect((await app.request('/protected')).status).toBe(200)
  })
})
