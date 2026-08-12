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
  CreateDataSourceSchema,
  DataSourceIdParamsSchema,
  DataSourceListSchema,
  DataSourceSchema,
  DeleteDataSourceResultSchema,
  UpdateDataSourceSchema,
} from './schemas.js'

const notFoundResponse = {
  description: 'The data source does not exist',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Data Sources'],
  summary: 'List data sources',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Configured data sources ordered by creation time',
      content: { 'application/json': { schema: DataSourceListSchema } },
    },
    401: unauthorizedResponse,
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Data Sources'],
  summary: 'Get a data source',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema },
  responses: {
    200: {
      description: 'Configured data source',
      content: { 'application/json': { schema: DataSourceSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

const createDataSourceRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Data Sources'],
  summary: 'Create a data source',
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateDataSourceSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created data source',
      content: { 'application/json': { schema: DataSourceSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
})

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Data Sources'],
  summary: 'Update a data source',
  security: protectedRouteSecurity,
  request: {
    params: DataSourceIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateDataSourceSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated data source',
      content: { 'application/json': { schema: DataSourceSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Data Sources'],
  summary: 'Delete a data source',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema },
  responses: {
    200: {
      description: 'Data source deleted',
      content: { 'application/json': { schema: DeleteDataSourceResultSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

export function createDataSourceCrudApi(services: Pick<AppServices, 'dataSources'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.dataSources

  app.openapi(listRoute, (c) => c.json(service.list(), 200))

  app.openapi(getRoute, (c) => {
    const dataSource = service.get(c.req.valid('param').id)
    if (!dataSource) return c.json({ error: 'Data source not found' }, 404)
    return c.json(dataSource, 200)
  })

  app.openapi(createDataSourceRoute, async (c) => {
    try {
      return c.json(await service.create(c.req.valid('json')), 201)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: message }, 400)
    }
  })

  app.openapi(updateRoute, async (c) => {
    try {
      const dataSource = await service.update(c.req.valid('param').id, c.req.valid('json'))
      if (!dataSource) return c.json({ error: 'Data source not found' }, 404)
      return c.json(dataSource, 200)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: message }, 400)
    }
  })

  app.openapi(deleteRoute, (c) => {
    if (!service.delete(c.req.valid('param').id)) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    return c.json({ success: true as const }, 200)
  })

  return app
}
