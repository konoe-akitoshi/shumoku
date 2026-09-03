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
  AlertListSchema,
  AlertQuerySchema,
  DataSourceIdParamsSchema,
  DiscoveredMetricListSchema,
  FilterOptionsSchema,
  HostItemListSchema,
  HostListSchema,
  HostParamsSchema,
  InterfaceNeighborListSchema,
  NativeApiRequestSchema,
  NativeApiResultSchema,
} from './schemas.js'

const internalErrorResponse = {
  description: 'The upstream data source request failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const hostsRoute = createRoute({
  method: 'get',
  path: '/{id}/hosts',
  tags: ['Data Sources'],
  summary: 'List hosts from a data source',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema },
  responses: {
    200: {
      description: 'Hosts exposed by the plugin',
      content: { 'application/json': { schema: HostListSchema } },
    },
    401: unauthorizedResponse,
    500: internalErrorResponse,
  },
})

const hostItemsRoute = createRoute({
  method: 'get',
  path: '/{id}/hosts/{hostId}/items',
  tags: ['Data Sources'],
  summary: 'List metric items for a host',
  security: protectedRouteSecurity,
  request: { params: HostParamsSchema },
  responses: {
    200: {
      description: 'Host metric items',
      content: { 'application/json': { schema: HostItemListSchema } },
    },
    401: unauthorizedResponse,
    500: internalErrorResponse,
  },
})

const neighborsRoute = createRoute({
  method: 'get',
  path: '/{id}/hosts/{hostId}/neighbors',
  tags: ['Data Sources'],
  summary: 'List interface neighbors for a host',
  security: protectedRouteSecurity,
  request: { params: HostParamsSchema },
  responses: {
    200: {
      description: 'LLDP or CDP interface neighbors',
      content: { 'application/json': { schema: InterfaceNeighborListSchema } },
    },
    401: unauthorizedResponse,
    500: internalErrorResponse,
  },
})

const metricsRoute = createRoute({
  method: 'get',
  path: '/{id}/hosts/{hostId}/metrics',
  tags: ['Data Sources'],
  summary: 'Discover metrics for a host',
  security: protectedRouteSecurity,
  request: { params: HostParamsSchema },
  responses: {
    200: {
      description: 'Metrics currently exposed for the host',
      content: { 'application/json': { schema: DiscoveredMetricListSchema } },
    },
    401: unauthorizedResponse,
    500: internalErrorResponse,
  },
})

const filterOptionsRoute = createRoute({
  method: 'get',
  path: '/{id}/filter-options',
  tags: ['Data Sources'],
  summary: 'Get legacy topology filter options',
  description:
    'Compatibility endpoint for NetBox site and tag selectors. Prefer config-options for new plugins.',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema },
  responses: {
    200: {
      description: 'Available sites and tags',
      content: { 'application/json': { schema: FilterOptionsSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    500: internalErrorResponse,
  },
})

const alertsRoute = createRoute({
  method: 'get',
  path: '/{id}/alerts',
  tags: ['Data Sources'],
  summary: 'Get alerts from a data source',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema, query: AlertQuerySchema },
  responses: {
    200: {
      description: 'Alerts returned by the plugin',
      content: { 'application/json': { schema: AlertListSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    500: internalErrorResponse,
  },
})

const nativeRoute = createRoute({
  method: 'post',
  path: '/{id}/_native',
  tags: ['Development'],
  summary: 'Call a plugin native API method',
  description: 'Development-only escape hatch for loopback API automation.',
  security: protectedRouteSecurity,
  request: {
    params: DataSourceIdParamsSchema,
    body: { required: true, content: { 'application/json': { schema: NativeApiRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Raw upstream result',
      content: { 'application/json': { schema: NativeApiResultSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    404: {
      description: 'Unavailable outside development or data source not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    500: internalErrorResponse,
  },
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createDataSourceRuntimeApi(services: {
  dataSources: Pick<AppServices['dataSources'], 'operations'>
}): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.dataSources.operations

  app.openapi(hostsRoute, async (c) => {
    try {
      return c.json(await service.getHosts(c.req.valid('param').id), 200)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(hostItemsRoute, async (c) => {
    try {
      const { id, hostId } = c.req.valid('param')
      return c.json(await service.getHostItems(id, hostId), 200)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(neighborsRoute, async (c) => {
    try {
      const { id, hostId } = c.req.valid('param')
      return c.json(await service.getInterfaceNeighbors(id, hostId), 200)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(metricsRoute, async (c) => {
    try {
      const { id, hostId } = c.req.valid('param')
      return c.json(await service.discoverMetrics(id, hostId), 200)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(filterOptionsRoute, async (c) => {
    try {
      const options = await service.getFilterOptions(c.req.valid('param').id)
      if (!options) {
        return c.json({ error: 'Filter options not supported for this data source type' }, 400)
      }
      return c.json(options, 200)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(alertsRoute, async (c) => {
    try {
      const alerts = await service.getAlerts(c.req.valid('param').id, c.req.valid('query'))
      if (!alerts) return c.json({ error: 'Data source does not support alerts' }, 400)
      return c.json(alerts, 200)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(nativeRoute, async (c) => {
    if (process.env['NODE_ENV'] !== 'development') {
      return c.json({ error: 'Not found' }, 404)
    }
    try {
      const { method, params } = c.req.valid('json')
      const result = await service.callNative(c.req.valid('param').id, method, params)
      if (!result.ok) return c.json({ error: result.error }, result.status)
      return c.json({ result: result.result }, 200)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })

  return app
}
