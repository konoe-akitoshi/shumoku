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
  CreateTopologySchema,
  DeleteTopologyResultSchema,
  TopologyIdParamsSchema,
  TopologyListSchema,
  TopologySchema,
  UpdateTopologySchema,
} from './schemas.js'

const notFoundResponse = {
  description: 'The topology does not exist',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Topologies'],
  summary: 'List topologies',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Topology shells ordered by name',
      content: { 'application/json': { schema: TopologyListSchema } },
    },
    401: unauthorizedResponse,
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Topologies'],
  summary: 'Get a topology',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Topology shell',
      content: { 'application/json': { schema: TopologySchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

const createTopologyRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Topologies'],
  summary: 'Create a topology',
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateTopologySchema } },
    },
  },
  responses: {
    201: {
      description: 'Created topology shell',
      content: { 'application/json': { schema: TopologySchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
})

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Topologies'],
  summary: 'Update a topology',
  security: protectedRouteSecurity,
  request: {
    params: TopologyIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateTopologySchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated topology shell',
      content: { 'application/json': { schema: TopologySchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Topologies'],
  summary: 'Delete a topology',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Topology deleted',
      content: { 'application/json': { schema: DeleteTopologyResultSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

export function createTopologyCrudApi(services: Pick<AppServices, 'topologies'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.topologies

  app.openapi(listRoute, (c) => c.json(service.list(), 200))

  app.openapi(getRoute, (c) => {
    const topology = service.get(c.req.valid('param').id)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)
    return c.json(topology, 200)
  })

  app.openapi(createTopologyRoute, async (c) => {
    try {
      return c.json(await service.create(c.req.valid('json')), 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  app.openapi(updateRoute, async (c) => {
    try {
      const topology = await service.update(c.req.valid('param').id, c.req.valid('json'))
      if (!topology) return c.json({ error: 'Topology not found' }, 404)
      return c.json(topology, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  app.openapi(deleteRoute, (c) => {
    if (!service.delete(c.req.valid('param').id)) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json({ success: true as const }, 200)
  })

  return app
}
