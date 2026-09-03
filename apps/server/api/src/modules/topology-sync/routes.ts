import { createRoute, type OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices, TopologySyncResult } from '../../app/services.js'
import { createOpenAPIApp, ErrorSchema, protectedRouteSecurity } from '../../openapi/common.js'
import {
  ShareTopologyResultSchema,
  StartedSyncJobResultSchema,
  SyncJobResultSchema,
  TopologyIdParamsSchema,
  UnshareTopologyResultSchema,
} from './schemas.js'

const errorResponse = {
  description: 'Topology operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const startResponses = {
  202: {
    description: 'Sync job started',
    content: { 'application/json': { schema: StartedSyncJobResultSchema } },
  },
  409: {
    description: 'A sync job is already running',
    content: { 'application/json': { schema: StartedSyncJobResultSchema } },
  },
  400: errorResponse,
  404: errorResponse,
  500: errorResponse,
} as const
const syncRoute = createRoute({
  method: 'post',
  path: '/{id}/sync-from-source',
  tags: ['Topology Sync'],
  summary: 'Synchronize all topology sources',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: startResponses,
})
const rebuildRoute = createRoute({
  method: 'post',
  path: '/{id}/rebuild',
  tags: ['Topology Sync'],
  summary: 'Clear pull-source observations and rebuild',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: startResponses,
})
const statusRoute = createRoute({
  method: 'get',
  path: '/{id}/sync-job',
  tags: ['Topology Sync'],
  summary: 'Get the current or last sync job',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Sync job state',
      content: { 'application/json': { schema: SyncJobResultSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    500: errorResponse,
  },
})
const cancelRoute = createRoute({
  method: 'post',
  path: '/{id}/sync-job/cancel',
  tags: ['Topology Sync'],
  summary: 'Cancel the current sync job',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Sync job state',
      content: { 'application/json': { schema: SyncJobResultSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    500: errorResponse,
  },
})
const shareRoute = createRoute({
  method: 'post',
  path: '/{id}/share',
  tags: ['Topology Sharing'],
  summary: 'Enable topology sharing',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Share token',
      content: { 'application/json': { schema: ShareTopologyResultSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    500: errorResponse,
  },
})
const unshareRoute = createRoute({
  method: 'delete',
  path: '/{id}/share',
  tags: ['Topology Sharing'],
  summary: 'Disable topology sharing',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Sharing disabled',
      content: { 'application/json': { schema: UnshareTopologyResultSchema } },
    },
    400: errorResponse,
    404: errorResponse,
    500: errorResponse,
  },
})

function respond200<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: TopologySyncResult<T>,
) {
  return result.ok ? c.json(result.value, 200) : c.json({ error: result.error }, result.status)
}
function respondStart<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: TopologySyncResult<T>,
) {
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return result.status === 409 ? c.json(result.value, 409) : c.json(result.value, 202)
}

export function createTopologySyncApi(services: Pick<AppServices, 'topologySync'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.topologySync
  app.openapi(syncRoute, async (c) =>
    respondStart(c, await service.start(c.req.valid('param').id, false)),
  )
  app.openapi(rebuildRoute, async (c) =>
    respondStart(c, await service.start(c.req.valid('param').id, true)),
  )
  app.openapi(statusRoute, (c) => respond200(c, service.getJob(c.req.valid('param').id)))
  app.openapi(cancelRoute, (c) => respond200(c, service.cancel(c.req.valid('param').id)))
  app.openapi(shareRoute, async (c) => respond200(c, await service.share(c.req.valid('param').id)))
  app.openapi(unshareRoute, (c) => respond200(c, service.unshare(c.req.valid('param').id)))
  return app
}
