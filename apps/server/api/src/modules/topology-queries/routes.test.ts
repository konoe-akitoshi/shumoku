import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { TopologyQueryApplicationService } from '../../app/services.js'
import { ErrorSchema } from '../../openapi/common.js'
import { createTopologyQueryApi } from './routes.js'

function createService(): TopologyQueryApplicationService {
  return {
    parsed: vi.fn(),
    graph: vi.fn(),
    serializedView: vi.fn(),
    render: vi.fn(),
    export: vi.fn(async (_id, options) => ({
      kind: 'ready' as const,
      value: {
        body: options.format === 'png' ? new Uint8Array([0x89, 0x50, 0x4e, 0x47]) : '<svg></svg>',
        contentType: options.format === 'png' ? ('image/png' as const) : ('image/svg+xml' as const),
        filename: options.sheet
          ? `Core Network-${options.sheet}.${options.format}`
          : 'Core Network.svg',
      },
    })),
    context: vi.fn(),
    getComposition: vi.fn(),
    updateComposition: vi.fn(),
  }
}

function createApp(service: TopologyQueryApplicationService): OpenAPIHono {
  return new OpenAPIHono().route(
    '/topologies',
    createTopologyQueryApi({ topologyQueries: service }),
  )
}

describe('topology export route', () => {
  it('preserves errorPhase and the legacy alias in a schema-valid export failure', async () => {
    const service = createService()
    service.export = vi.fn(async () => ({
      kind: 'error' as const,
      status: 422 as const,
      error: 'Unable to lay out topology',
      errorPhase: 'layout' as const,
    }))
    const response = await createApp(service).request('/topologies/topology-1/export?format=svg')
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.errorPhase).toBe('layout')
    const error = ErrorSchema.parse(body)
    expect(error.error).toBe('Unable to lay out topology')
    expect(error.message).toBe(error.error)
    expect(response.headers.get('X-Request-ID')).toBe(error.requestId)
  })

  it('downloads a selected SVG sheet with safe attachment headers', async () => {
    const service = createService()
    const response = await createApp(service).request(
      '/topologies/topology-1/export?format=svg&sheet=branch',
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('image/svg+xml')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Content-Disposition')).toContain(
      "filename*=UTF-8''Core%20Network-branch.svg",
    )
    expect(await response.text()).toBe('<svg></svg>')
    expect(service.export).toHaveBeenCalledWith('topology-1', {
      format: 'svg',
      sheet: 'branch',
    })
  })

  it('returns binary PNG data and validates the requested scale', async () => {
    const service = createService()
    const app = createApp(service)
    const response = await app.request('/topologies/topology-1/export?format=png&scale=2')

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('image/png')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    )
    expect(service.export).toHaveBeenCalledWith('topology-1', {
      format: 'png',
      scale: 2,
    })

    const invalid = await app.request('/topologies/topology-1/export?format=png&scale=10')
    expect(invalid.status).toBe(400)
    expect(service.export).toHaveBeenCalledTimes(1)
  })

  it('publishes protected SVG, PNG, and HTML response types in OpenAPI', () => {
    const document = createApp(createService()).getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })
    const operation = document.paths['/topologies/{id}/export']?.get

    expect(operation?.security).toEqual([{ sessionCookie: [] }, { bearerAuth: [] }])
    const content = operation?.responses?.['200']?.content
    expect(content).toHaveProperty('image/svg+xml')
    expect(content).toHaveProperty('image/png')
    expect(content).toHaveProperty('text/html')
  })
})
