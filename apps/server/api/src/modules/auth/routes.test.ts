import { OpenAPIHono } from '@hono/zod-openapi'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthApplicationService } from '../../app/services.js'
import { createAuthApi } from './routes.js'

function createService(overrides: Partial<AuthApplicationService> = {}): AuthApplicationService {
  return {
    isSetupComplete: vi.fn(() => true),
    getSessionPrincipal: vi.fn(() => ({
      subject: 'local-admin',
      role: 'admin' as const,
      authMethod: 'password' as const,
    })),
    setPassword: vi.fn(async () => undefined),
    setInitialPassword: vi.fn(async () => true),
    verifyPassword: vi.fn(async () => true),
    createSession: vi.fn(() => 'session-token'),
    deleteSession: vi.fn(),
    deleteAllSessions: vi.fn(),
    checkRateLimit: vi.fn(() => 0),
    recordFailedAttempt: vi.fn(),
    clearAttempts: vi.fn(),
    ...overrides,
  }
}

function createApp(service = createService()): OpenAPIHono {
  return new OpenAPIHono().route('/auth', createAuthApi({ auth: service }))
}

describe('OpenAPI authentication routes', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reports setup and session status', async () => {
    const response = await createApp().request('/auth/status', {
      headers: { Cookie: 'shumoku_session=session-token' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      setupComplete: true,
      authenticated: true,
      subject: 'local-admin',
      role: 'admin',
      authMethod: 'password',
      permissions: ['workspace:read', 'workspace:write', 'admin:manage'],
      publicDemo: false,
    })
  })

  it('creates a session for a valid login', async () => {
    const response = await createApp().request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('shumoku_session=session-token')
  })

  it('requires an explicit local-development opt-in for browser setup', async () => {
    const disabled = await createApp().request('/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'initial-password' }),
    })
    expect(disabled.status).toBe(403)

    vi.stubEnv('SHUMOKU_ALLOW_WEB_SETUP', 'true')
    const enabled = await createApp().request('/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'initial-password' }),
    })
    expect(enabled.status).toBe(200)
  })

  it('invalidates older sessions when the password changes', async () => {
    const service = createService()
    const response = await createApp(service).request('/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'shumoku_session=session-token',
      },
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
    })
    expect(response.status).toBe(200)
    expect(service.deleteAllSessions).toHaveBeenCalledOnce()
    expect(service.createSession).toHaveBeenCalledOnce()
  })

  it('rejects an invalid login and records the attempt', async () => {
    const service = createService({ verifyPassword: vi.fn(async () => false) })
    const response = await createApp(service).request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'incorrect-password' }),
    })
    expect(response.status).toBe(401)
    expect(service.recordFailedAttempt).toHaveBeenCalledOnce()
  })

  it('publishes all five operations', () => {
    const document = createApp().getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })
    expect(document.paths['/auth/status']?.get).toBeDefined()
    expect(document.paths['/auth/setup']?.post).toBeDefined()
    expect(document.paths['/auth/login']?.post).toBeDefined()
    expect(document.paths['/auth/change-password']?.post).toBeDefined()
    expect(document.paths['/auth/logout']?.post).toBeDefined()
  })
})
