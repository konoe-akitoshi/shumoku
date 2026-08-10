import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it } from 'vitest'
import type { AppServices } from '../../app/services.js'
import { createAdminApi } from './routes.js'
import { AdminStatusSchema } from './schemas.js'

const status = {
  status: 'ok' as const,
  timestamp: 123,
  uptimeSeconds: 4.5,
  database: { ready: true },
  topologies: { database: 2, legacyFile: 1 },
  plugins: { registered: 7 },
  realtime: { webSocketClients: 1, sseSubscribers: 2 },
  schedulers: {
    metrics: {
      running: true,
      activePolls: 1,
      queuedPolls: 0,
      topologyCount: 3,
      watchedTopologies: 1,
      inFlightTopologies: 1,
      fastIntervalMs: 5000,
      slowIntervalMs: 60_000,
      concurrencyLimit: 3,
    },
    discovery: {
      running: true,
      tickInFlight: false,
      tickIntervalMs: 60_000,
      minimumSyncIntervalMs: 300_000,
    },
  },
}

function createServices(): AppServices {
  return {
    system: {
      getBuildInfo: () => ({
        version: 'test',
        channel: 'development',
        deployment: 'source',
      }),
      getSystemInfo: async () => ({
        build: { version: 'test', channel: 'development', deployment: 'source' },
        update: { status: 'disabled', currentVersion: 'test' },
      }),
    },
    admin: { getStatus: () => status },
  }
}

describe('OpenAPI admin routes', () => {
  it('returns a schema-valid redacted runtime snapshot', async () => {
    const app = new OpenAPIHono().route('/admin', createAdminApi(createServices()))

    const response = await app.request('/admin/status')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(AdminStatusSchema.safeParse(body).success).toBe(true)
    expect(body).toEqual(status)
  })

  it('publishes the status operation and security alternatives', () => {
    const app = new OpenAPIHono().route('/admin', createAdminApi(createServices()))
    const document = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })
    const operation = document.paths['/admin/status']?.get

    expect(operation?.security).toEqual([{ sessionCookie: [] }, { bearerAuth: [] }])
  })
})
