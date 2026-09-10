import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { TopologyObservationApplicationService } from '../../app/services.js'
import { ErrorSchema } from '../../openapi/common.js'
import { createTopologyObservationApi } from './routes.js'

function service(): TopologyObservationApplicationService {
  return {
    list: vi.fn(() => []),
    get: vi.fn(() => null),
    latest: vi.fn(() => null),
    record: vi.fn(async () => ({
      id: 'observation-1',
      topologyId: 'topology-1',
      sourceId: 'source-1',
      capturedAt: 1,
      createdAt: 1,
      status: 'ok' as const,
      graph: null,
      nodeCount: 0,
      linkCount: 0,
      portCount: 0,
    })),
    resolved: vi.fn(async () => null),
    getDisplaySettings: vi.fn(() => ({
      edgeStyle: 'orthogonal' as const,
      splineMode: 'sloppy' as const,
      hideDisconnected: false,
    })),
    updateDisplaySettings: vi.fn(async () => ({ ok: true as const })),
  }
}

function app(observations: TopologyObservationApplicationService) {
  return new OpenAPIHono().route('/topologies', createTopologyObservationApi({ observations }))
}

const path = '/topologies/topology-1/sources/source-1/observation'

describe('observation wire compatibility', () => {
  it('preserves optional versions, opaque records, and upstream-specific fields', async () => {
    const observations = service()
    const graph = {
      nodes: [{ upstreamDevice: 'device-1', custom: { enabled: true } }],
      links: [{ upstreamLink: 'link-1' }],
      customGraphField: ['keep', 'me'],
    }
    const response = await app(observations).request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph }),
    })
    expect(response.status).toBe(201)
    expect(observations.record).toHaveBeenCalledWith('topology-1', 'source-1', graph, 'ok')
  })

  it('still rejects malformed graph collections before recording', async () => {
    const observations = service()
    const response = await app(observations).request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: { nodes: 'invalid', links: [] } }),
    })
    expect(response.status).toBe(400)
    expect(observations.record).not.toHaveBeenCalled()
    const error = ErrorSchema.parse(await response.json())
    expect(error.error).toBe(error.message)
    expect(response.headers.get('X-Request-ID')).toBe(error.requestId)
  })

  it('returns schema-valid not-found errors with the legacy alias and matching request ID', async () => {
    const response = await app(service()).request('/topologies/topology-1/observations/missing')
    expect(response.status).toBe(404)
    const error = ErrorSchema.parse(await response.json())
    expect(error).toMatchObject({ code: 'NOT_FOUND', message: 'not found', error: 'not found' })
    expect(response.headers.get('X-Request-ID')).toBe(error.requestId)
  })
})
