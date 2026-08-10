import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import { protectedRouteSecurity, unauthorizedResponse } from '../../openapi/common.js'
import { AdminStatusSchema } from './schemas.js'

const statusRoute = createRoute({
  method: 'get',
  path: '/status',
  tags: ['Admin'],
  summary: 'Inspect server runtime status',
  description: 'Returns redacted operational state for diagnostics and automation.',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Current runtime status',
      content: { 'application/json': { schema: AdminStatusSchema } },
    },
    401: unauthorizedResponse,
  },
})

export function createAdminApi(services: AppServices): OpenAPIHono {
  const app = new OpenAPIHono()
  app.openapi(statusRoute, (c) => c.json(services.admin.getStatus(), 200))
  return app
}
