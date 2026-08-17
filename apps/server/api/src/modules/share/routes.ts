import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AppServices, ShareApplicationService, ShareReadResult } from '../../app/services.js'
import { createOpenAPIApp, ErrorSchema } from '../../openapi/common.js'
import { publicMetrics } from './projections.js'
import {
  DashboardResourceParamsSchema,
  EventStreamSchema,
  PublicAlertQuerySchema,
  PublicAlertSchema,
  PublicDashboardSchema,
  PublicTopologyMetadataSchema,
  ShareTokenParamsSchema,
  TopologyContextSchema,
  TopologyGraphSchema,
  TopologyRenderSchema,
  TopologyViewSchema,
} from './schemas.js'

const MAX_SHARE_METRIC_STREAMS = 200
const errorResponse = {
  description: 'Shared resource unavailable',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const response = (description: string, schema: z.ZodType) => ({
  description,
  content: { 'application/json': { schema } },
})

const topologyRoute = createRoute({
  method: 'get',
  path: '/topologies/{token}',
  tags: ['Public Shares'],
  summary: 'Get shared topology context',
  request: { params: ShareTokenParamsSchema },
  responses: {
    200: response('Shared topology context', TopologyContextSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const topologyGraphRoute = createRoute({
  method: 'get',
  path: '/topologies/{token}/graph',
  tags: ['Public Shares'],
  summary: 'Get shared topology graph',
  request: { params: ShareTokenParamsSchema },
  responses: {
    200: response('Shared topology graph', TopologyGraphSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const topologyViewRoute = createRoute({
  method: 'get',
  path: '/topologies/{token}/view',
  tags: ['Public Shares'],
  summary: 'Get shared topology graph and layout',
  request: { params: ShareTokenParamsSchema },
  responses: {
    200: response('Shared topology view', TopologyViewSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const topologyRenderRoute = createRoute({
  method: 'get',
  path: '/topologies/{token}/render',
  tags: ['Public Shares'],
  summary: 'Render a shared topology',
  request: { params: ShareTokenParamsSchema },
  responses: {
    200: response('Shared topology render', TopologyRenderSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const topologyStreamRoute = createRoute({
  method: 'get',
  path: '/topologies/{token}/metrics/stream',
  tags: ['Public Shares'],
  summary: 'Stream shared topology metrics',
  request: { params: ShareTokenParamsSchema },
  responses: {
    200: {
      description: 'Metrics event stream',
      content: { 'text/event-stream': { schema: EventStreamSchema } },
    },
    404: errorResponse,
    503: errorResponse,
  },
})
const dashboardRoute = createRoute({
  method: 'get',
  path: '/dashboards/{token}',
  tags: ['Public Shares'],
  summary: 'Get a shared dashboard',
  request: { params: ShareTokenParamsSchema },
  responses: {
    200: response('Shared dashboard', PublicDashboardSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const dashboardTopologyRoute = createRoute({
  method: 'get',
  path: '/dashboards/{token}/topologies/{id}',
  tags: ['Public Shares'],
  summary: 'Get shared dashboard topology metadata',
  request: { params: DashboardResourceParamsSchema },
  responses: {
    200: response('Topology metadata', PublicTopologyMetadataSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const dashboardGraphRoute = createRoute({
  method: 'get',
  path: '/dashboards/{token}/topologies/{id}/graph',
  tags: ['Public Shares'],
  summary: 'Get a shared dashboard topology graph',
  request: { params: DashboardResourceParamsSchema },
  responses: {
    200: response('Topology graph', TopologyGraphSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const dashboardContextRoute = createRoute({
  method: 'get',
  path: '/dashboards/{token}/topologies/{id}/context',
  tags: ['Public Shares'],
  summary: 'Get shared dashboard topology context',
  request: { params: DashboardResourceParamsSchema },
  responses: {
    200: response('Topology context', TopologyContextSchema),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})
const dashboardStreamRoute = createRoute({
  method: 'get',
  path: '/dashboards/{token}/topologies/{id}/metrics/stream',
  tags: ['Public Shares'],
  summary: 'Stream shared dashboard topology metrics',
  request: { params: DashboardResourceParamsSchema },
  responses: {
    200: {
      description: 'Metrics event stream',
      content: { 'text/event-stream': { schema: EventStreamSchema } },
    },
    404: errorResponse,
    503: errorResponse,
  },
})
const dashboardAlertsRoute = createRoute({
  method: 'get',
  path: '/dashboards/{token}/datasources/{id}/alerts',
  tags: ['Public Shares'],
  summary: 'Get alerts for a shared dashboard widget',
  request: { params: DashboardResourceParamsSchema, query: PublicAlertQuerySchema },
  responses: {
    200: response('Projected alerts', z.array(PublicAlertSchema)),
    400: errorResponse,
    404: errorResponse,
    422: errorResponse,
    500: errorResponse,
  },
})

function respond<T>(c: Context, result: ShareReadResult<T>) {
  return result.ok ? c.json(result.value, 200) : c.json({ error: result.error }, result.status)
}

function streamTopologyMetrics(c: Context, service: ShareApplicationService, topologyId: string) {
  c.header('Cache-Control', 'no-store')
  return streamSSE(c, async (stream) => {
    let aborted = false
    let pending = service.latestMetrics(topologyId)
    const unsubscribe = service.subscribeMetrics(topologyId, (metrics) => {
      pending = metrics
    })
    stream.onAbort(() => {
      aborted = true
      unsubscribe()
    })
    let lastRevision = service.servedRevision(topologyId)
    let lastMappingVersion = service.mappingVersion(topologyId)
    await stream.writeSSE({ event: 'revision', data: String(lastRevision) })
    await stream.writeSSE({ event: 'mappingVersion', data: String(lastMappingVersion) })
    let idleTicks = 0
    while (!aborted) {
      const revision = service.servedRevision(topologyId)
      if (revision !== lastRevision) {
        lastRevision = revision
        await stream.writeSSE({ event: 'revision', data: String(revision) })
      }
      const mappingVersion = service.mappingVersion(topologyId)
      if (mappingVersion !== lastMappingVersion) {
        lastMappingVersion = mappingVersion
        await stream.writeSSE({ event: 'mappingVersion', data: String(mappingVersion) })
      }
      if (pending) {
        const next = pending
        pending = null
        idleTicks = 0
        await stream.writeSSE({ data: JSON.stringify(publicMetrics(next)) })
      } else if (++idleTicks >= 15) {
        idleTicks = 0
        await stream.writeSSE({ event: 'ping', data: '' })
      }
      await stream.sleep(1000)
    }
    unsubscribe()
  })
}

function streamResponse(c: Context, service: ShareApplicationService, topologyId: string | null) {
  if (!topologyId) return c.json({ error: 'Not found' }, 404)
  if (service.liveSubscriberCount() >= MAX_SHARE_METRIC_STREAMS)
    return c.json({ error: 'Too many concurrent streams' }, 503)
  return streamTopologyMetrics(c, service, topologyId)
}

export function createShareApi(services: Pick<AppServices, 'share'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.share
  app.openapi(topologyRoute, async (c) =>
    respond(c, await service.topology(c.req.valid('param').token, 'context')),
  )
  app.openapi(topologyGraphRoute, async (c) =>
    respond(c, await service.topology(c.req.valid('param').token, 'graph')),
  )
  app.openapi(topologyViewRoute, async (c) =>
    respond(c, await service.topology(c.req.valid('param').token, 'view')),
  )
  app.openapi(topologyRenderRoute, async (c) =>
    respond(c, await service.topology(c.req.valid('param').token, 'render')),
  )
  app.openapi(topologyStreamRoute, (c) =>
    streamResponse(c, service, service.topologyStreamId(c.req.valid('param').token)),
  )
  app.openapi(dashboardRoute, (c) => respond(c, service.dashboard(c.req.valid('param').token)))
  app.openapi(dashboardTopologyRoute, async (c) => {
    const { token, id } = c.req.valid('param')
    return respond(c, await service.dashboardTopology(token, id, 'metadata'))
  })
  app.openapi(dashboardGraphRoute, async (c) => {
    const { token, id } = c.req.valid('param')
    return respond(c, await service.dashboardTopology(token, id, 'graph'))
  })
  app.openapi(dashboardContextRoute, async (c) => {
    const { token, id } = c.req.valid('param')
    return respond(c, await service.dashboardTopology(token, id, 'context'))
  })
  app.openapi(dashboardStreamRoute, (c) => {
    const { token, id } = c.req.valid('param')
    return streamResponse(c, service, service.dashboardTopologyStreamId(token, id))
  })
  app.openapi(dashboardAlertsRoute, async (c) => {
    const { token, id } = c.req.valid('param')
    return respond(c, await service.dashboardAlerts(token, id, c.req.valid('query')))
  })
  return app
}
