import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardApplicationService } from '../../app/services.js'
import type { Dashboard } from '../../types.js'
import { createDashboardApi } from './routes.js'

function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    id: 'dashboard-1',
    name: 'Operations',
    layoutJson: '{}',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function createService(): DashboardApplicationService {
  const items = new Map([['dashboard-1', dashboard()]])
  return {
    list: vi.fn(() => [...items.values()]),
    get: vi.fn((id) => items.get(id) ?? null),
    create: vi.fn(async (input) => dashboard({ id: 'dashboard-2', ...input })),
    update: vi.fn((id, input) => {
      const current = items.get(id)
      return current ? dashboard({ ...current, ...input }) : null
    }),
    delete: vi.fn((id) => items.delete(id)),
    share: vi.fn(async (id) => (items.has(id) ? 'share-token' : null)),
    unshare: vi.fn((id) => items.has(id)),
  }
}

function createApp(service = createService()): OpenAPIHono {
  return new OpenAPIHono().route('/dashboards', createDashboardApi({ dashboards: service }))
}

describe('OpenAPI dashboard routes', () => {
  it('supports CRUD and sharing', async () => {
    const app = createApp()
    expect((await app.request('/dashboards')).status).toBe(200)
    expect((await app.request('/dashboards/dashboard-1')).status).toBe(200)
    expect(
      (
        await app.request('/dashboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New dashboard' }),
        })
      ).status,
    ).toBe(201)
    expect((await app.request('/dashboards/dashboard-1/share', { method: 'POST' })).status).toBe(
      200,
    )
    expect((await app.request('/dashboards/dashboard-1/share', { method: 'DELETE' })).status).toBe(
      200,
    )
    expect((await app.request('/dashboards/dashboard-1', { method: 'DELETE' })).status).toBe(200)
  })

  it('publishes all seven operations', () => {
    const document = createApp().getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })
    expect(document.paths['/dashboards']?.get).toBeDefined()
    expect(document.paths['/dashboards']?.post).toBeDefined()
    expect(document.paths['/dashboards/{id}']?.get).toBeDefined()
    expect(document.paths['/dashboards/{id}']?.put).toBeDefined()
    expect(document.paths['/dashboards/{id}']?.delete).toBeDefined()
    expect(document.paths['/dashboards/{id}/share']?.post).toBeDefined()
    expect(document.paths['/dashboards/{id}/share']?.delete).toBeDefined()
  })
})
