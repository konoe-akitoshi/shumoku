import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppServices, TopologySourceMutationResult } from '../../app/services.js'
import {
  apiErrorPayload,
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'
import {
  AddedTopologySourceSchema,
  AddTopologySourceSchema,
  ClearTopologySourceResultSchema,
  ManualEditConflictSchema,
  ManualEditResultSchema,
  ManualEditSchema,
  ProbeTopologySourceResultSchema,
  ProbeTopologySourceSchema,
  ReplaceTopologySourcesSchema,
  SourceAttachmentParamsSchema,
  SyncTopologySourceResultSchema,
  TopologyDataSourceSchema,
  TopologySourceParamsSchema,
  TopologySourceSuccessSchema,
  TopologySourcesParamsSchema,
  UpdateTopologySourceSchema,
} from './schemas.js'

const notFoundResponse = {
  description: 'Resource not found',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const conflictResponse = {
  description: 'Source already attached',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const internalErrorResponse = {
  description: 'Operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const errors = {
  400: badRequestResponse,
  404: notFoundResponse,
  409: conflictResponse,
  500: internalErrorResponse,
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/{topologyId}/sources',
  tags: ['Topology Sources'],
  summary: 'List attached topology data sources',
  security: protectedRouteSecurity,
  request: { params: TopologySourcesParamsSchema },
  responses: {
    200: {
      description: 'Attached sources',
      content: { 'application/json': { schema: z.array(TopologyDataSourceSchema) } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const addRoute = createRoute({
  method: 'post',
  path: '/{topologyId}/sources',
  tags: ['Topology Sources'],
  summary: 'Attach a data source to a topology',
  security: protectedRouteSecurity,
  request: {
    params: TopologySourcesParamsSchema,
    body: { required: true, content: { 'application/json': { schema: AddTopologySourceSchema } } },
  },
  responses: {
    201: {
      description: 'Attached source',
      content: { 'application/json': { schema: AddedTopologySourceSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const replaceRoute = createRoute({
  method: 'put',
  path: '/{topologyId}/sources',
  tags: ['Topology Sources'],
  summary: 'Replace all attached sources',
  security: protectedRouteSecurity,
  request: {
    params: TopologySourcesParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: ReplaceTopologySourcesSchema } },
    },
  },
  responses: {
    200: {
      description: 'Attached sources',
      content: { 'application/json': { schema: z.array(TopologyDataSourceSchema) } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const updateRoute = createRoute({
  method: 'put',
  path: '/{topologyId}/sources/{sourceId}',
  tags: ['Topology Sources'],
  summary: 'Update a topology source attachment',
  security: protectedRouteSecurity,
  request: {
    params: SourceAttachmentParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateTopologySourceSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated source',
      content: { 'application/json': { schema: TopologyDataSourceSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const removeRoute = createRoute({
  method: 'delete',
  path: '/{topologyId}/sources/{sourceId}',
  tags: ['Topology Sources'],
  summary: 'Detach a topology source',
  security: protectedRouteSecurity,
  request: { params: SourceAttachmentParamsSchema },
  responses: {
    200: {
      description: 'Source detached',
      content: { 'application/json': { schema: TopologySourceSuccessSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const clearRoute = createRoute({
  method: 'post',
  path: '/{topologyId}/sources/{sourceId}/clear',
  tags: ['Topology Sources'],
  summary: 'Clear a source contribution without detaching it',
  security: protectedRouteSecurity,
  request: { params: TopologySourceParamsSchema },
  responses: {
    200: {
      description: 'Contribution cleared',
      content: { 'application/json': { schema: ClearTopologySourceResultSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const probeRoute = createRoute({
  method: 'post',
  path: '/{topologyId}/sources/{sourceId}/probe',
  tags: ['Topology Sources'],
  summary: 'Deep-read selected source targets',
  security: protectedRouteSecurity,
  request: {
    params: TopologySourceParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: ProbeTopologySourceSchema } },
    },
  },
  responses: {
    200: {
      description: 'Probe observation',
      content: { 'application/json': { schema: ProbeTopologySourceResultSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const syncRoute = createRoute({
  method: 'post',
  path: '/{topologyId}/sources/{sourceId}/sync',
  tags: ['Topology Sources'],
  summary: 'Synchronize one attached topology source',
  security: protectedRouteSecurity,
  request: { params: TopologySourceParamsSchema },
  responses: {
    200: {
      description: 'Source snapshot and observation',
      content: { 'application/json': { schema: SyncTopologySourceResultSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})

const editRoute = createRoute({
  method: 'patch',
  path: '/{topologyId}/sources/{sourceId}/edits',
  tags: ['Topology Sources'],
  summary: 'Write a rename or a hide of one node into a Manual source',
  description:
    'Writes a hand edit as a node of the Manual source named by sourceId ' +
    '({ id, label } to rename, { id, absent: true } to hide), so it shows in that source YAML. ' +
    'The source must be a Manual source attached to the topology with the topology purpose, ' +
    'and must be the top priority among those sources (409 with reason not-top-priority ' +
    'otherwise, and the outranking source in top). The server never finds or creates a ' +
    'Manual source. nodeId is the resolved node id the GUI shows. label: null removes the ' +
    'rename and absent: false removes the hide; a node left with nothing to say is removed ' +
    'from the YAML.',
  security: protectedRouteSecurity,
  request: {
    params: TopologySourceParamsSchema,
    body: { required: true, content: { 'application/json': { schema: ManualEditSchema } } },
  },
  responses: {
    200: {
      description: 'The node as the Manual source now holds it',
      content: { 'application/json': { schema: ManualEditResultSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: {
      description: 'The Manual source is not the top priority (reason not-top-priority)',
      content: { 'application/json': { schema: ManualEditConflictSchema } },
    },
    500: errors[500],
  },
})

function respond200<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: TopologySourceMutationResult<T>,
) {
  if (!result.ok) return c.json(apiErrorPayload(c, result.error, result.status), result.status)
  return c.json(result.value, 200)
}

function respond201<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: TopologySourceMutationResult<T>,
) {
  if (!result.ok) return c.json(apiErrorPayload(c, result.error, result.status), result.status)
  return c.json(result.value, 201)
}

export function createTopologySourceApi(
  services: Pick<AppServices, 'topologySources'>,
): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.topologySources
  app.openapi(listRoute, (c) => respond200(c, service.list(c.req.valid('param').topologyId)))
  app.openapi(addRoute, async (c) =>
    respond201(c, await service.add(c.req.valid('param').topologyId, c.req.valid('json'))),
  )
  app.openapi(replaceRoute, async (c) =>
    respond200(
      c,
      await service.replace(c.req.valid('param').topologyId, c.req.valid('json').sources),
    ),
  )
  app.openapi(updateRoute, (c) => {
    const { topologyId, sourceId } = c.req.valid('param')
    return respond200(c, service.update(topologyId, sourceId, c.req.valid('json')))
  })
  app.openapi(removeRoute, (c) => {
    const { topologyId, sourceId } = c.req.valid('param')
    return respond200(c, service.remove(topologyId, sourceId))
  })
  app.openapi(clearRoute, (c) => {
    const { topologyId, sourceId } = c.req.valid('param')
    return respond200(c, service.clear(topologyId, sourceId))
  })
  app.openapi(editRoute, async (c) => {
    const { topologyId, sourceId } = c.req.valid('param')
    const result = await service.editNode(topologyId, sourceId, c.req.valid('json'))
    if (result.ok) return c.json(result.value, 200)
    if (result.status === 409) {
      return c.json(
        {
          ...apiErrorPayload(c, result.error, 409),
          reason: result.extra?.reason ?? ('claim-conflict' as const),
          ...(result.extra?.top !== undefined && { top: result.extra.top }),
        },
        409,
      )
    }
    return c.json(apiErrorPayload(c, result.error, result.status), result.status)
  })
  app.openapi(probeRoute, async (c) => {
    const { topologyId } = c.req.valid('param')
    return respond200(c, await service.probe(topologyId, c.req.valid('json').seeds))
  })
  app.openapi(syncRoute, async (c) => {
    const { topologyId, sourceId } = c.req.valid('param')
    return respond200(c, await service.sync(topologyId, sourceId))
  })
  return app
}
