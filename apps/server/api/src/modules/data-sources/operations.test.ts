import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { DataSourceOperationsService } from '../../app/services.js'
import { createDataSourceOperationsApi } from './operations.js'

function createService(): DataSourceOperationsService {
  return {
    listByCapability: vi.fn(() => []),
    listPluginTypes: vi.fn(() => [
      {
        type: 'example',
        displayName: 'Example',
        capabilities: ['topology'],
        configSchema: { type: 'object', properties: {} },
      },
    ]),
    getConfigOptions: vi.fn(async (id) =>
      id === 'missing' ? null : [{ value: 'site-a', label: 'Site A' }],
    ),
    getConnectionInfo: vi.fn(() => [
      { label: 'Webhook URL', value: 'https://example.test/hook', copyable: true },
    ]),
    listAttachedTopologies: vi.fn((id) =>
      id === 'missing' ? null : [{ topologyId: 'topology-1', name: 'Campus' }],
    ),
    testConnection: vi.fn(async () => ({ success: true, message: 'Connected' })),
    getHosts: vi.fn(async () => []),
    getHostItems: vi.fn(async () => []),
    getInterfaceNeighbors: vi.fn(async () => []),
    discoverMetrics: vi.fn(async () => []),
    getFilterOptions: vi.fn(async () => null),
    getAlerts: vi.fn(async () => null),
    callNative: vi.fn(async () => ({ ok: false, status: 404, error: 'Not available' })),
  }
}

function createApp(service: DataSourceOperationsService): OpenAPIHono {
  return new OpenAPIHono().route(
    '/datasources',
    createDataSourceOperationsApi({ dataSources: { operations: service } }),
  )
}

describe('OpenAPI data source operation routes', () => {
  it('serves plugin metadata and management operations', async () => {
    const app = createApp(createService())

    expect(await (await app.request('/datasources/types')).json()).toMatchObject([
      { type: 'example', displayName: 'Example' },
    ])
    expect((await app.request('/datasources/by-capability/topology')).status).toBe(200)
    expect(await (await app.request('/datasources/source-1/config-options/sites')).json()).toEqual({
      options: [{ value: 'site-a', label: 'Site A' }],
    })
    expect((await app.request('/datasources/source-1/connection-info')).status).toBe(200)
    expect(await (await app.request('/datasources/source-1/topologies')).json()).toEqual([
      { topologyId: 'topology-1', name: 'Campus' },
    ])
    expect((await app.request('/datasources/source-1/test', { method: 'POST' })).status).toBe(200)
  })

  it('validates capabilities and preserves not-found responses', async () => {
    const app = createApp(createService())

    expect((await app.request('/datasources/by-capability/unknown')).status).toBe(400)
    expect((await app.request('/datasources/missing/config-options/sites')).status).toBe(404)
    expect((await app.request('/datasources/missing/topologies')).status).toBe(404)
  })

  it('publishes every operation with protected security', () => {
    const document = createApp(createService()).getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })

    expect(document.paths['/datasources/types']?.get?.security).toEqual([
      { sessionCookie: [] },
      { bearerAuth: [] },
    ])
    expect(document.paths['/datasources/by-capability/{capability}']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/config-options/{key}']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/connection-info']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/topologies']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/test']?.post).toBeDefined()
  })
})
