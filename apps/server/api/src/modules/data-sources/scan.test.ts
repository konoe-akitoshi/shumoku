import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { DataSourceScanService } from '../../app/services.js'
import { createDataSourceScanApi } from './scan.js'

function createService(): DataSourceScanService {
  return {
    scan: vi.fn(async () => ({
      ok: true,
      snapshot: {
        status: 'ok',
        capturedAt: 100,
        graph: { name: 'Scan', nodes: [], links: [] },
      },
    })),
  }
}

function createApp(service = createService()): OpenAPIHono {
  return new OpenAPIHono().route(
    '/datasources',
    createDataSourceScanApi({ dataSources: { scan: service } }),
  )
}

describe('OpenAPI data source scan route', () => {
  it('runs a validated scan', async () => {
    const service = createService()
    const response = await createApp(service).request('/datasources/source-1/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topologyId: 'topology-1', seeds: ['192.0.2.1'] }),
    })

    expect(response.status).toBe(200)
    expect(service.scan).toHaveBeenCalledWith('source-1', {
      topologyId: 'topology-1',
      seeds: ['192.0.2.1'],
    })
  })

  it('publishes the scan operation in OpenAPI', () => {
    const document = createApp().getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })
    expect(document.paths['/datasources/{id}/scan']?.post).toBeDefined()
  })
})
