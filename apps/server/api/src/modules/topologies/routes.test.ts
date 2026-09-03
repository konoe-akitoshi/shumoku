import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { TopologyCrudService } from '../../app/services.js'
import type { Topology } from '../../types.js'
import { createTopologyCrudApi } from './routes.js'

function topology(overrides: Partial<Topology> = {}): Topology {
  return {
    id: 'topology-1',
    name: 'Core Network',
    compositionMode: 'additive',
    scopeMode: 'auto',
    scope: { include: [], exclude: [] },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function createService(): TopologyCrudService {
  const items = new Map<string, Topology>([['topology-1', topology()]])
  return {
    list: vi.fn(() => [...items.values()]),
    get: vi.fn((id) => items.get(id) ?? null),
    create: vi.fn(async (input) => {
      const created = topology({ id: 'topology-2', name: input.name })
      items.set(created.id, created)
      return created
    }),
    update: vi.fn(async (id, input) => {
      const current = items.get(id)
      if (!current) return null
      const updated = topology({ ...current, ...input, updatedAt: 2 })
      items.set(id, updated)
      return updated
    }),
    delete: vi.fn((id) => items.delete(id)),
  }
}

function createApp(service: TopologyCrudService): OpenAPIHono {
  return new OpenAPIHono().route('/topologies', createTopologyCrudApi({ topologies: service }))
}

describe('OpenAPI topology CRUD routes', () => {
  it('preserves list, get, create, update, and delete behavior', async () => {
    const app = createApp(createService())

    expect((await app.request('/topologies')).status).toBe(200)
    expect((await app.request('/topologies/topology-1')).status).toBe(200)

    const createResponse = await app.request('/topologies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Branch Network' }),
    })
    expect(createResponse.status).toBe(201)
    expect(await createResponse.json()).toMatchObject({
      id: 'topology-2',
      name: 'Branch Network',
    })

    const updateResponse = await app.request('/topologies/topology-2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Branch' }),
    })
    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toMatchObject({ name: 'Updated Branch' })

    expect((await app.request('/topologies/topology-2', { method: 'DELETE' })).status).toBe(200)
    expect((await app.request('/topologies/topology-2')).status).toBe(404)
  })

  it('rejects an invalid create request before calling the service', async () => {
    const service = createService()
    const response = await createApp(service).request('/topologies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid request',
      error: 'Invalid request',
      requestId: expect.any(String),
    })
    expect(service.create).not.toHaveBeenCalled()
  })

  it('publishes all CRUD operations with protected security', () => {
    const app = createApp(createService())
    const document = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })

    expect(document.paths['/topologies']?.get?.security).toEqual([
      { sessionCookie: [] },
      { bearerAuth: [] },
    ])
    expect(document.paths['/topologies']?.post).toBeDefined()
    expect(document.paths['/topologies/{id}']?.get).toBeDefined()
    expect(document.paths['/topologies/{id}']?.put).toBeDefined()
    expect(document.paths['/topologies/{id}']?.delete).toBeDefined()
  })
})
