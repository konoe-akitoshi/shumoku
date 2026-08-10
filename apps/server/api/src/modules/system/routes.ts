import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import {
  badRequestResponse,
  protectedRouteSecurity,
  unauthorizedResponse,
} from '../../openapi/common.js'
import { HealthSchema, SystemInfoSchema, SystemQuerySchema } from './schemas.js'

const healthRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'Check server liveness',
  responses: {
    200: {
      description: 'The server process is running',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
})

const systemRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'Get build and update information',
  security: protectedRouteSecurity,
  request: { query: SystemQuerySchema },
  responses: {
    200: {
      description: 'Build and release information',
      content: { 'application/json': { schema: SystemInfoSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
})

export function createHealthApi(services: AppServices): OpenAPIHono {
  const app = new OpenAPIHono()
  app.openapi(healthRoute, (c) =>
    c.json(
      {
        status: 'ok' as const,
        timestamp: Date.now(),
        build: services.system.getBuildInfo(),
      },
      200,
    ),
  )
  return app
}

export function createSystemApi(services: AppServices): OpenAPIHono {
  const app = new OpenAPIHono()
  app.openapi(systemRoute, async (c) => {
    const { refresh } = c.req.valid('query')
    return c.json(await services.system.getSystemInfo(refresh === 'true'), 200)
  })
  return app
}
