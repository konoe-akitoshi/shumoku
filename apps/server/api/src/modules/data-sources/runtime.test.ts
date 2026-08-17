import { OpenAPIHono } from '@hono/zod-openapi'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DataSourceOperationsService } from '../../app/services.js'
import { createDataSourceRuntimeApi } from './runtime.js'

const originalNodeEnv = process.env['NODE_ENV']

function createService(): DataSourceOperationsService {
  return {
    listByCapability: vi.fn(() => []),
    listPluginTypes: vi.fn(() => []),
    getConfigOptions: vi.fn(async () => []),
    getConnectionInfo: vi.fn(() => []),
    listAttachedTopologies: vi.fn(() => []),
    testConnection: vi.fn(async () => ({ success: true, message: 'Connected' })),
    getHosts: vi.fn(async () => [{ id: 'host-1', name: 'Router' }]),
    getHostItems: vi.fn(async () => [
      { id: 'item-1', hostId: 'host-1', name: 'Traffic', key: 'if.in' },
    ]),
    getInterfaceNeighbors: vi.fn(async () => [{ localInterface: 'eth0', remoteSysName: 'Switch' }]),
    discoverMetrics: vi.fn(async () => [
      { name: 'ifInOctets', labels: { interface: 'eth0' }, value: 42 },
    ]),
    getFilterOptions: vi.fn(async () => ({
      sites: [{ slug: 'tokyo', name: 'Tokyo' }],
      tags: [],
    })),
    getAlerts: vi.fn(async () => [
      {
        id: 'alert-1',
        severity: 'high',
        title: 'Link down',
        startTime: 1,
        status: 'active',
        source: 'example',
      },
    ]),
    callNative: vi.fn(async () => ({ ok: true, result: { value: 42 } })),
  }
}

function createApp(service = createService()): OpenAPIHono {
  return new OpenAPIHono().route(
    '/datasources',
    createDataSourceRuntimeApi({ dataSources: { operations: service } }),
  )
}

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
  else process.env['NODE_ENV'] = originalNodeEnv
})

describe('OpenAPI data source runtime routes', () => {
  it('serves hosts, discovery data, filters, and alerts', async () => {
    const app = createApp()

    expect((await app.request('/datasources/source-1/hosts')).status).toBe(200)
    expect((await app.request('/datasources/source-1/hosts/host-1/items')).status).toBe(200)
    expect((await app.request('/datasources/source-1/hosts/host-1/neighbors')).status).toBe(200)
    expect((await app.request('/datasources/source-1/hosts/host-1/metrics')).status).toBe(200)
    expect((await app.request('/datasources/source-1/filter-options')).status).toBe(200)
    expect(
      (
        await app.request(
          '/datasources/source-1/alerts?activeOnly=true&minSeverity=high&timeRange=300',
        )
      ).status,
    ).toBe(200)
  })

  it('validates alert filters before calling the service', async () => {
    const service = createService()
    const response = await createApp(service).request(
      '/datasources/source-1/alerts?minSeverity=disaster',
    )

    expect(response.status).toBe(400)
    expect(service.getAlerts).not.toHaveBeenCalled()
  })

  it('keeps the native passthrough development-only', async () => {
    const service = createService()
    const app = createApp(service)
    const request = () =>
      app.request('/datasources/source-1/_native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'host.get', params: {} }),
      })

    process.env['NODE_ENV'] = 'production'
    expect((await request()).status).toBe(404)
    expect(service.callNative).not.toHaveBeenCalled()

    process.env['NODE_ENV'] = 'development'
    expect((await request()).status).toBe(200)
    expect(service.callNative).toHaveBeenCalledWith('source-1', 'host.get', {})
  })

  it('publishes every runtime operation in OpenAPI', () => {
    const document = createApp().getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })

    expect(document.paths['/datasources/{id}/hosts']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/hosts/{hostId}/items']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/hosts/{hostId}/neighbors']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/hosts/{hostId}/metrics']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/filter-options']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/alerts']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/_native']?.post).toBeDefined()
  })
})
