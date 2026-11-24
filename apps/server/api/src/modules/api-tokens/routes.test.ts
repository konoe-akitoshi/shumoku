import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { ApiTokenApplicationService } from '../../app/services.js'
import { createApiTokensApi } from './routes.js'

const view = {
  id: 't1',
  name: 'terraform',
  prefix: 'shmk_abcd',
  role: 'admin' as const,
  createdAt: 1,
  expiresAt: null,
  lastUsedAt: null,
}

function createService(): ApiTokenApplicationService {
  return {
    list: vi.fn(() => [view]),
    create: vi.fn(() => ({ token: 'shmk_secret', apiToken: view })),
    revoke: vi.fn((id: string) => id === 't1'),
  }
}

function createApp(service = createService()) {
  return new OpenAPIHono().route('/admin/api-tokens', createApiTokensApi({ apiTokens: service }))
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

describe('OpenAPI API token routes', () => {
  it('lists tokens without their secret', async () => {
    const response = await createApp().request('/admin/api-tokens')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ tokens: [view] })
  })

  it('issues a token and returns its secret once', async () => {
    const service = createService()
    const response = await createApp(service).request(
      '/admin/api-tokens',
      json({ name: ' terraform ', role: 'admin' }),
    )
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ token: 'shmk_secret', apiToken: view })
    expect(service.create).toHaveBeenCalledWith({ name: 'terraform', role: 'admin' })
  })

  it('rejects bad input: empty name, unknown role, past expiry', async () => {
    const app = createApp()
    expect((await app.request('/admin/api-tokens', json({ name: '', role: 'admin' }))).status).toBe(
      400,
    )
    expect(
      (await app.request('/admin/api-tokens', json({ name: 'x', role: 'anonymous' }))).status,
    ).toBe(400)
    expect(
      (await app.request('/admin/api-tokens', json({ name: 'x', role: 'user', expiresAt: 1 })))
        .status,
    ).toBe(400)
  })

  it('revokes, and 404s an unknown id', async () => {
    const app = createApp()
    expect((await app.request('/admin/api-tokens/t1', { method: 'DELETE' })).status).toBe(200)
    expect((await app.request('/admin/api-tokens/nope', { method: 'DELETE' })).status).toBe(404)
  })
})
