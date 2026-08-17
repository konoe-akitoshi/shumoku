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
  CreateDashboardSchema,
  DashboardIdParamsSchema,
  DashboardListSchema,
  DashboardSchema,
  DashboardShareResultSchema,
  SuccessSchema,
  UpdateDashboardSchema,
} from './schemas.js'

const notFoundResponse = {
  description: 'The dashboard does not exist',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const common = { tags: ['Dashboards'], security: protectedRouteSecurity }

const listRoute = createRoute({
  ...common,
  method: 'get',
  path: '/',
  summary: 'List dashboards',
  responses: {
    200: {
      description: 'Configured dashboards',
      content: { 'application/json': { schema: DashboardListSchema } },
    },
    401: unauthorizedResponse,
  },
})
const getRoute = createRoute({
  ...common,
  method: 'get',
  path: '/{id}',
  summary: 'Get a dashboard',
  request: { params: DashboardIdParamsSchema },
  responses: {
    200: { description: 'Dashboard', content: { 'application/json': { schema: DashboardSchema } } },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})
const createDashboardRoute = createRoute({
  ...common,
  method: 'post',
  path: '/',
  summary: 'Create a dashboard',
  request: {
    body: { required: true, content: { 'application/json': { schema: CreateDashboardSchema } } },
  },
  responses: {
    201: {
      description: 'Created dashboard',
      content: { 'application/json': { schema: DashboardSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
})
const updateRoute = createRoute({
  ...common,
  method: 'put',
  path: '/{id}',
  summary: 'Update a dashboard',
  request: {
    params: DashboardIdParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UpdateDashboardSchema } } },
  },
  responses: {
    200: {
      description: 'Updated dashboard',
      content: { 'application/json': { schema: DashboardSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})
const shareRoute = createRoute({
  ...common,
  method: 'post',
  path: '/{id}/share',
  summary: 'Enable dashboard sharing',
  request: { params: DashboardIdParamsSchema },
  responses: {
    200: {
      description: 'Generated share token',
      content: { 'application/json': { schema: DashboardShareResultSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})
const unshareRoute = createRoute({
  ...common,
  method: 'delete',
  path: '/{id}/share',
  summary: 'Disable dashboard sharing',
  request: { params: DashboardIdParamsSchema },
  responses: {
    200: {
      description: 'Sharing disabled',
      content: { 'application/json': { schema: SuccessSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})
const deleteRoute = createRoute({
  ...common,
  method: 'delete',
  path: '/{id}',
  summary: 'Delete a dashboard',
  request: { params: DashboardIdParamsSchema },
  responses: {
    200: {
      description: 'Dashboard deleted',
      content: { 'application/json': { schema: SuccessSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

export function createDashboardApi(services: Pick<AppServices, 'dashboards'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.dashboards

  app.openapi(listRoute, (c) => c.json(service.list(), 200))
  app.openapi(getRoute, (c) => {
    const dashboard = service.get(c.req.valid('param').id)
    return dashboard ? c.json(dashboard, 200) : c.json({ error: 'Dashboard not found' }, 404)
  })
  app.openapi(createDashboardRoute, async (c) => {
    try {
      return c.json(await service.create(c.req.valid('json')), 201)
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400)
    }
  })
  app.openapi(updateRoute, (c) => {
    try {
      const dashboard = service.update(c.req.valid('param').id, c.req.valid('json'))
      return dashboard ? c.json(dashboard, 200) : c.json({ error: 'Dashboard not found' }, 404)
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400)
    }
  })
  app.openapi(shareRoute, async (c) => {
    const shareToken = await service.share(c.req.valid('param').id)
    return shareToken ? c.json({ shareToken }, 200) : c.json({ error: 'Dashboard not found' }, 404)
  })
  app.openapi(unshareRoute, (c) =>
    service.unshare(c.req.valid('param').id)
      ? c.json({ success: true as const }, 200)
      : c.json({ error: 'Dashboard not found' }, 404),
  )
  app.openapi(deleteRoute, (c) =>
    service.delete(c.req.valid('param').id)
      ? c.json({ success: true as const }, 200)
      : c.json({ error: 'Dashboard not found' }, 404),
  )
  return app
}
