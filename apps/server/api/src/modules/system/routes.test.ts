import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { AppServices } from '../../app/services.js'
import { createHealthApi, createSystemApi } from './routes.js'

function createServices(): AppServices {
  return {
    system: {
      getBuildInfo: () => ({
        version: '0.1.0',
        channel: 'development',
        deployment: 'source',
      }),
      getSystemInfo: vi.fn(async () => ({
        build: {
          version: '0.1.0',
          channel: 'development',
          deployment: 'source',
        },
        update: { status: 'disabled', currentVersion: '0.1.0' },
      })),
    },
    admin: { getStatus: vi.fn() },
  }
}

describe('OpenAPI system routes', () => {
  it('keeps the health response contract', async () => {
    const services = createServices()
    const app = new OpenAPIHono().route('/health', createHealthApi(services))

    const response = await app.request('/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'ok',
      build: { version: '0.1.0', channel: 'development', deployment: 'source' },
    })
  })

  it('passes the validated refresh query to the service', async () => {
    const services = createServices()
    const app = new OpenAPIHono().route('/system', createSystemApi(services))

    expect((await app.request('/system?refresh=true')).status).toBe(200)
    expect(services.system.getSystemInfo).toHaveBeenCalledWith(true)
  })

  it('publishes health and system operations in OpenAPI 3.1', () => {
    const services = createServices()
    const app = new OpenAPIHono()
    app.route('/health', createHealthApi(services))
    app.route('/system', createSystemApi(services))

    const document = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })

    expect(document.paths['/health']?.get).toBeDefined()
    expect(document.paths['/system']?.get).toBeDefined()
  })
})
