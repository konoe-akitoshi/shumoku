import { createRoute, type OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import {
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
  unauthorizedResponse,
} from '../../openapi/common.js'
import {
  AttachedTopologyListSchema,
  ConfigOptionsResultSchema,
  ConnectionInfoQuerySchema,
  ConnectionInfoResultSchema,
  ConnectionResultSchema,
  DataSourceCapabilityParamsSchema,
  DataSourceConfigOptionParamsSchema,
  DataSourceIdParamsSchema,
  DataSourceListSchema,
  DataSourcePluginListSchema,
} from './schemas.js'

const notFoundResponse = {
  description: 'The data source does not exist',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const pluginTypesRoute = createRoute({
  method: 'get',
  path: '/types',
  tags: ['Data Sources'],
  summary: 'List available data source plugin types',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Registered plugin types and their form schemas',
      content: { 'application/json': { schema: DataSourcePluginListSchema } },
    },
    401: unauthorizedResponse,
  },
})

const listByCapabilityRoute = createRoute({
  method: 'get',
  path: '/by-capability/{capability}',
  tags: ['Data Sources'],
  summary: 'List data sources by capability',
  security: protectedRouteSecurity,
  request: { params: DataSourceCapabilityParamsSchema },
  responses: {
    200: {
      description: 'Configured data sources supporting the capability',
      content: { 'application/json': { schema: DataSourceListSchema } },
    },
    400: {
      description: 'The capability is not supported',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    401: unauthorizedResponse,
  },
})

const configOptionsRoute = createRoute({
  method: 'get',
  path: '/{id}/config-options/{key}',
  tags: ['Data Sources'],
  summary: 'Get dynamic configuration options',
  security: protectedRouteSecurity,
  request: { params: DataSourceConfigOptionParamsSchema },
  responses: {
    200: {
      description: 'Available values for the requested plugin schema field',
      content: { 'application/json': { schema: ConfigOptionsResultSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

const connectionInfoRoute = createRoute({
  method: 'get',
  path: '/{id}/connection-info',
  tags: ['Data Sources'],
  summary: 'Get derived connection information',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema, query: ConnectionInfoQuerySchema },
  responses: {
    200: {
      description: 'Display-only connection information supplied by the plugin',
      content: { 'application/json': { schema: ConnectionInfoResultSchema } },
    },
    401: unauthorizedResponse,
  },
})

const attachedTopologiesRoute = createRoute({
  method: 'get',
  path: '/{id}/topologies',
  tags: ['Data Sources'],
  summary: 'List attached topologies',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema },
  responses: {
    200: {
      description: 'Topologies currently using the data source',
      content: { 'application/json': { schema: AttachedTopologyListSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

const testConnectionRoute = createRoute({
  method: 'post',
  path: '/{id}/test',
  tags: ['Data Sources'],
  summary: 'Test a data source connection',
  security: protectedRouteSecurity,
  request: { params: DataSourceIdParamsSchema },
  responses: {
    200: {
      description: 'Connection test result',
      content: { 'application/json': { schema: ConnectionResultSchema } },
    },
    401: unauthorizedResponse,
  },
})

export function createDataSourceOperationsApi(services: {
  dataSources: Pick<AppServices['dataSources'], 'operations'>
}): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.dataSources.operations

  app.openapi(pluginTypesRoute, (c) => c.json(service.listPluginTypes(), 200))
  app.openapi(listByCapabilityRoute, (c) =>
    c.json(service.listByCapability(c.req.valid('param').capability), 200),
  )
  app.openapi(configOptionsRoute, async (c) => {
    const { id, key } = c.req.valid('param')
    const options = await service.getConfigOptions(id, key)
    if (!options) return c.json({ error: 'Data source not found' }, 404)
    return c.json({ options }, 200)
  })
  app.openapi(connectionInfoRoute, (c) => {
    const { id } = c.req.valid('param')
    const serverOrigin = c.req.valid('query').origin ?? new URL(c.req.url).origin
    return c.json({ items: service.getConnectionInfo(id, serverOrigin) }, 200)
  })
  app.openapi(attachedTopologiesRoute, (c) => {
    const topologies = service.listAttachedTopologies(c.req.valid('param').id)
    if (!topologies) return c.json({ error: 'Data source not found' }, 404)
    return c.json(topologies, 200)
  })
  app.openapi(testConnectionRoute, async (c) =>
    c.json(await service.testConnection(c.req.valid('param').id), 200),
  )

  return app
}
