import { createRoute, type OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import {
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
  unauthorizedResponse,
} from '../../openapi/common.js'
import {
  DataSourceIdParamsSchema,
  DataSourceScanRequestSchema,
  DataSourceScanResultSchema,
} from './schemas.js'

const scanRoute = createRoute({
  method: 'post',
  path: '/{id}/scan',
  tags: ['Data Sources'],
  summary: 'Run an ad-hoc topology scan',
  security: protectedRouteSecurity,
  request: {
    params: DataSourceIdParamsSchema,
    body: {
      required: false,
      content: { 'application/json': { schema: DataSourceScanRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Scan snapshot and optional persisted observation',
      content: { 'application/json': { schema: DataSourceScanResultSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: {
      description: 'The data source does not exist',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    500: {
      description: 'The scan failed',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

export function createDataSourceScanApi(services: {
  dataSources: Pick<AppServices['dataSources'], 'scan'>
}): OpenAPIHono {
  const app = createOpenAPIApp()

  app.openapi(scanRoute, async (c) => {
    try {
      const result = await services.dataSources.scan.scan(
        c.req.valid('param').id,
        c.req.valid('json') ?? {},
      )
      if (!result.ok) return c.json({ error: result.error }, result.status)
      return c.json(
        result.observation
          ? { snapshot: result.snapshot, observation: result.observation }
          : { snapshot: result.snapshot },
        200,
      )
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500)
    }
  })

  return app
}
