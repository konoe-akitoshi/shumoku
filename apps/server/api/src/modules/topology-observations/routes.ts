import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import {
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'
import {
  DisplaySettingsSchema,
  LatestSnapshotSchema,
  ObservationListQuerySchema,
  ObservationParamsSchema,
  ObservationSchema,
  OkResultSchema,
  RecordObservationSchema,
  ResolvedTopologySchema,
  TopologyIdParamsSchema,
  TopologySourceParamsSchema,
  UpdateDisplaySettingsSchema,
} from './schemas.js'

const internalErrorResponse = {
  description: 'Operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const notFoundResponse = {
  description: 'Resource not found',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/{id}/observations',
  tags: ['Topology Observations'],
  summary: 'List recent topology observations',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema, query: ObservationListQuerySchema },
  responses: {
    200: {
      description: 'Observation summaries',
      content: {
        'application/json': {
          schema: z.array(ObservationSchema.omit({ graph: true, contributionChanged: true })),
        },
      },
    },
  },
})
const getRoute = createRoute({
  method: 'get',
  path: '/{id}/observations/{obsId}',
  tags: ['Topology Observations'],
  summary: 'Get a topology observation',
  security: protectedRouteSecurity,
  request: { params: ObservationParamsSchema },
  responses: {
    200: {
      description: 'Observation',
      content: { 'application/json': { schema: ObservationSchema } },
    },
    404: notFoundResponse,
  },
})
const latestRoute = createRoute({
  method: 'get',
  path: '/{topologyId}/sources/{sourceId}/latest-snapshot',
  tags: ['Topology Observations'],
  summary: 'Get the latest snapshot from a topology source',
  security: protectedRouteSecurity,
  request: { params: TopologySourceParamsSchema },
  responses: {
    200: {
      description: 'Latest snapshot',
      content: { 'application/json': { schema: LatestSnapshotSchema } },
    },
  },
})
const recordRoute = createRoute({
  method: 'post',
  path: '/{topologyId}/sources/{sourceId}/observation',
  tags: ['Topology Observations'],
  summary: 'Record a pushed topology observation',
  security: protectedRouteSecurity,
  request: {
    params: TopologySourceParamsSchema,
    body: { required: true, content: { 'application/json': { schema: RecordObservationSchema } } },
  },
  responses: {
    201: {
      description: 'Recorded observation',
      content: { 'application/json': { schema: z.object({ observation: ObservationSchema }) } },
    },
    400: badRequestResponse,
    500: internalErrorResponse,
  },
})
const resolvedRoute = createRoute({
  method: 'get',
  path: '/{id}/resolved',
  tags: ['Topologies'],
  summary: 'Get the resolved topology graph',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Resolved graph',
      content: { 'application/json': { schema: ResolvedTopologySchema } },
    },
    404: notFoundResponse,
    500: internalErrorResponse,
  },
})
const getDisplayRoute = createRoute({
  method: 'get',
  path: '/{id}/display-settings',
  tags: ['Topologies'],
  summary: 'Get topology display settings',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Display settings',
      content: { 'application/json': { schema: DisplaySettingsSchema } },
    },
  },
})
const updateDisplayRoute = createRoute({
  method: 'put',
  path: '/{id}/display-settings',
  tags: ['Topologies'],
  summary: 'Update topology display settings',
  security: protectedRouteSecurity,
  request: {
    params: TopologyIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateDisplaySettingsSchema } },
    },
  },
  responses: {
    200: {
      description: 'Settings updated',
      content: { 'application/json': { schema: OkResultSchema } },
    },
    400: badRequestResponse,
    500: internalErrorResponse,
  },
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createTopologyObservationApi(
  services: Pick<AppServices, 'observations'>,
): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.observations
  app.openapi(listRoute, (c) =>
    c.json(service.list(c.req.valid('param').id, c.req.valid('query').limit), 200),
  )
  app.openapi(getRoute, (c) => {
    const observation = service.get(c.req.valid('param').obsId)
    return observation ? c.json(observation, 200) : c.json({ error: 'not found' }, 404)
  })
  app.openapi(latestRoute, (c) => {
    const { topologyId, sourceId } = c.req.valid('param')
    const latest = service.latest(topologyId, sourceId)
    return c.json(
      latest
        ? {
            graph: latest.graph,
            capturedAt: latest.capturedAt,
            status: latest.status,
            observationId: latest.id,
          }
        : { graph: null, capturedAt: null },
      200,
    )
  })
  app.openapi(recordRoute, async (c) => {
    try {
      const { topologyId, sourceId } = c.req.valid('param')
      const { graph, status } = c.req.valid('json')
      return c.json({ observation: await service.record(topologyId, sourceId, graph, status) }, 201)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(resolvedRoute, async (c) => {
    try {
      const result = await service.resolved(c.req.valid('param').id)
      return result ? c.json(result, 200) : c.json({ error: 'not found' }, 404)
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  app.openapi(getDisplayRoute, (c) =>
    c.json(service.getDisplaySettings(c.req.valid('param').id), 200),
  )
  app.openapi(updateDisplayRoute, async (c) => {
    try {
      return c.json(
        await service.updateDisplaySettings(c.req.valid('param').id, c.req.valid('json')),
        200,
      )
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 500)
    }
  })
  return app
}
