import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { AuthApplicationService } from '../../app/services.js'
import { createAuthApi } from './routes.js'

function createService(overrides: Partial<AuthApplicationService> = {}): AuthApplicationService {
  return {
    isSetupComplete: vi.fn(() => true),
    validateSession: vi.fn(() => true),
    setPassword: vi.fn(async () => undefined),
    verifyPassword: vi.fn(async () => true),
    createSession: vi.fn(() => 'session-token'),
    deleteSession: vi.fn(),
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
  it('reports setup and session status', async () => {
    const response = await createApp().request('/auth/status', {
      headers: { Cookie: 'shumoku_session=session-token' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ setupComplete: true, authenticated: true })
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
