import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { DataSourceCrudService } from '../../app/services.js'
import type { DataSource } from '../../types.js'
import { createDataSourceCrudApi } from './routes.js'

function dataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'source-1',
    name: 'Network Source',
    type: 'example',
    configJson: '{}',
    status: 'unknown',
    failCount: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function createService(): DataSourceCrudService {
  const items = new Map<string, DataSource>([['source-1', dataSource()]])
  return {
    list: vi.fn(() => [...items.values()]),
    get: vi.fn((id) => items.get(id) ?? null),
    create: vi.fn(async (input) => {
      const created = dataSource({ id: 'source-2', ...input })
      items.set(created.id, created)
      return created
    }),
    update: vi.fn(async (id, input) => {
      const current = items.get(id)
      if (!current) return null
      const updated = dataSource({ ...current, ...input, updatedAt: 2 })
      items.set(id, updated)
      return updated
    }),
    delete: vi.fn((id) => items.delete(id)),
  }
}

function createApp(service: DataSourceCrudService): OpenAPIHono {
  return new OpenAPIHono().route('/datasources', createDataSourceCrudApi({ dataSources: service }))
}

describe('OpenAPI data source CRUD routes', () => {
  it('preserves list, get, create, update, and delete behavior', async () => {
    const app = createApp(createService())

    expect((await app.request('/datasources')).status).toBe(200)
    expect((await app.request('/datasources/source-1')).status).toBe(200)

    const createResponse = await app.request('/datasources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Branch Source', type: 'example', configJson: '{}' }),
    })
    expect(createResponse.status).toBe(201)
    expect(await createResponse.json()).toMatchObject({
      id: 'source-2',
      name: 'Branch Source',
    })

    const updateResponse = await app.request('/datasources/source-2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Branch' }),
    })
    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toMatchObject({ name: 'Updated Branch' })

    expect((await app.request('/datasources/source-2', { method: 'DELETE' })).status).toBe(200)
    expect((await app.request('/datasources/source-2')).status).toBe(404)
  })

  it('rejects an invalid create request before calling the service', async () => {
    const service = createService()
    const response = await createApp(service).request('/datasources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', type: 'example', configJson: '{}' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid request' })
    expect(service.create).not.toHaveBeenCalled()
  })

  it('publishes all CRUD operations with protected security', () => {
    const app = createApp(createService())
    const document = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })

    expect(document.paths['/datasources']?.get?.security).toEqual([
      { sessionCookie: [] },
      { bearerAuth: [] },
    ])
    expect(document.paths['/datasources']?.post).toBeDefined()
    expect(document.paths['/datasources/{id}']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}']?.put).toBeDefined()
    expect(document.paths['/datasources/{id}']?.delete).toBeDefined()
  })
})
