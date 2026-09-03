import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { SettingsApplicationService } from '../../app/services.js'
import { createSettingsApi } from './routes.js'

function createService(): SettingsApplicationService {
  const values = new Map([['theme', 'dark']])
  return {
    list: vi.fn(() => Object.fromEntries(values)),
    get: vi.fn((key) => values.get(key) ?? null),
    setMany: vi.fn((settings) => {
      for (const [key, value] of Object.entries(settings)) values.set(key, value)
    }),
    set: vi.fn((key, value) => values.set(key, value)),
    delete: vi.fn((key) => values.delete(key)),
  }
}

function createApp(service = createService()): OpenAPIHono {
  return new OpenAPIHono().route('/settings', createSettingsApi({ settings: service }))
}

describe('OpenAPI settings routes', () => {
  it('supports list, get, set, bulk set, and delete', async () => {
    const app = createApp()
    expect((await app.request('/settings')).status).toBe(200)
    expect((await app.request('/settings/theme')).status).toBe(200)
    expect(
      (
        await app.request('/settings/theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: 'light' }),
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await app.request('/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: 'ja' }),
        })
      ).status,
    ).toBe(200)
    expect((await app.request('/settings/theme', { method: 'DELETE' })).status).toBe(200)
  })

  it('publishes all five operations', () => {
    const document = createApp().getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })
    expect(document.paths['/settings']?.get).toBeDefined()
    expect(document.paths['/settings']?.put).toBeDefined()
    expect(document.paths['/settings/{key}']?.get).toBeDefined()
    expect(document.paths['/settings/{key}']?.put).toBeDefined()
    expect(document.paths['/settings/{key}']?.delete).toBeDefined()
  })
})
