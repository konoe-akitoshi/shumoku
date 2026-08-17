import { createRoute, type OpenAPIHono } from '@hono/zod-openapi'
import type { ZodType } from 'zod'
import type {
  AppServices,
  TopologyImmediateResult,
  TopologyReadResult,
} from '../../app/services.js'
import { createOpenAPIApp, ErrorSchema, protectedRouteSecurity } from '../../openapi/common.js'
import {
  DerivingSchema,
  ParsedTopologySchema,
  TopologyCompositionSchema,
  TopologyContextSchema,
  TopologyGraphSchema,
  TopologyIdParamsSchema,
  TopologyRenderSchema,
  TopologyViewSchema,
  UpdateTopologyCompositionSchema,
} from './schemas.js'

const errorResponse = {
  description: 'Topology operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const pendingResponse = {
  description: 'The initial topology derivation is still running',
  content: { 'application/json': { schema: DerivingSchema } },
} as const
const commonResponses = {
  202: pendingResponse,
  400: errorResponse,
  404: errorResponse,
  422: errorResponse,
  500: errorResponse,
} as const

function readRoute(path: string, summary: string, schema: ZodType) {
  return createRoute({
    method: 'get',
    path,
    tags: ['Topologies'],
    summary,
    security: protectedRouteSecurity,
    request: { params: TopologyIdParamsSchema },
    responses: {
      200: { description: summary, content: { 'application/json': { schema } } },
      202: commonResponses[202],
      400: commonResponses[400],
      404: commonResponses[404],
      422: commonResponses[422],
      500: commonResponses[500],
    },
  })
}

const parsedRoute = readRoute(
  '/{id}/parsed',
  'Get parsed topology and layout',
  ParsedTopologySchema,
)
const graphRoute = readRoute('/{id}/graph', 'Get the resolved topology graph', TopologyGraphSchema)
const viewRoute = readRoute('/{id}/view', 'Get graph and server-baked layout', TopologyViewSchema)
const renderRoute = readRoute(
  '/{id}/render',
  'Render a topology for embedding',
  TopologyRenderSchema,
)
const contextRoute = readRoute(
  '/{id}/context',
  'Get simplified topology context',
  TopologyContextSchema,
)
const compositionRoute = createRoute({
  method: 'get',
  path: '/{id}/composition',
  tags: ['Topologies'],
  summary: 'Get topology composition policy',
  security: protectedRouteSecurity,
  request: { params: TopologyIdParamsSchema },
  responses: {
    200: {
      description: 'Topology composition policy',
      content: { 'application/json': { schema: TopologyCompositionSchema } },
    },
    400: commonResponses[400],
    404: commonResponses[404],
  },
})
const updateCompositionRoute = createRoute({
  method: 'put',
  path: '/{id}/composition',
  tags: ['Topologies'],
  summary: 'Update topology composition policy',
  security: protectedRouteSecurity,
  request: {
    params: TopologyIdParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateTopologyCompositionSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated composition policy',
      content: { 'application/json': { schema: TopologyCompositionSchema } },
    },
    400: commonResponses[400],
    404: commonResponses[404],
    422: commonResponses[422],
    500: commonResponses[500],
  },
})

function respond<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: TopologyReadResult<T>,
) {
  if (result.kind === 'ready') return c.json(result.value, 200)
  if (result.kind === 'deriving') return c.json({ deriving: true as const }, 202)
  const body = result.errorPhase
    ? { error: result.error, errorPhase: result.errorPhase }
    : { error: result.error }
  return c.json(body, result.status)
}

function respondImmediate<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: TopologyImmediateResult<T>,
) {
  return result.kind === 'ready'
    ? c.json(result.value, 200)
    : c.json({ error: result.error }, result.status)
}

export function createTopologyQueryApi(
  services: Pick<AppServices, 'topologyQueries'>,
): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.topologyQueries
  app.openapi(parsedRoute, async (c) => respond(c, await service.parsed(c.req.valid('param').id)))
  app.openapi(graphRoute, async (c) => respond(c, await service.graph(c.req.valid('param').id)))
  app.openapi(viewRoute, async (c) => {
    const result = await service.serializedView(c.req.valid('param').id)
    if (result.kind === 'ready') return c.json(JSON.parse(result.value), 200)
    return respond(c, result)
  })
  app.openapi(renderRoute, async (c) => respond(c, await service.render(c.req.valid('param').id)))
  app.openapi(contextRoute, async (c) => respond(c, await service.context(c.req.valid('param').id)))
  app.openapi(compositionRoute, (c) =>
    respondImmediate(c, service.getComposition(c.req.valid('param').id)),
  )
  app.openapi(updateCompositionRoute, (c) =>
    respondImmediate(c, service.updateComposition(c.req.valid('param').id, c.req.valid('json'))),
  )
  return app
}
