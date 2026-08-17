import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppServices, TopologyMappingResult } from '../../app/services.js'
import { createOpenAPIApp, ErrorSchema, protectedRouteSecurity } from '../../openapi/common.js'
import {
  AutoMapLinksResultSchema,
  AutoMapLinksSchema,
  DeletedMappingsSchema,
  LinkMappingParamsSchema,
  MappingEntityParamsSchema,
  MappingOrphanSchema,
  MappingSourceQuerySchema,
  MappingSuccessSchema,
  MappingTopologyParamsSchema,
  MetricsMappingSchema,
  NodeMappingParamsSchema,
  PatchLinkMappingResultSchema,
  PatchLinkMappingSchema,
  PatchNodeMappingResultSchema,
  PatchNodeMappingSchema,
  ReassignMappingOrphanSchema,
  ReplaceMetricsMappingSchema,
  SourceMetricsMappingSchema,
  UpdatedMetricsMappingSchema,
} from './schemas.js'

const errorResponse = {
  description: 'Mapping operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const errors = {
  400: errorResponse,
  404: errorResponse,
  409: errorResponse,
  422: errorResponse,
  500: errorResponse,
} as const
const success = (description: string, schema: z.ZodType) => ({
  description,
  content: { 'application/json': { schema } },
})
const common = {
  400: errors[400],
  404: errors[404],
  409: errors[409],
  422: errors[422],
  500: errors[500],
}

const getRoute = createRoute({
  method: 'get',
  path: '/{id}/mapping',
  tags: ['Topology Mappings'],
  summary: 'Get a topology metrics mapping',
  security: protectedRouteSecurity,
  request: { params: MappingTopologyParamsSchema, query: MappingSourceQuerySchema },
  responses: { 200: success('Metrics mapping', MetricsMappingSchema), ...common },
})
const sourcesRoute = createRoute({
  method: 'get',
  path: '/{id}/mapping/sources',
  tags: ['Topology Mappings'],
  summary: 'List source-qualified metrics mappings',
  security: protectedRouteSecurity,
  request: { params: MappingTopologyParamsSchema },
  responses: { 200: success('Source mappings', z.array(SourceMetricsMappingSchema)), ...common },
})
const orphansRoute = createRoute({
  method: 'get',
  path: '/{id}/mapping/orphans',
  tags: ['Topology Mappings'],
  summary: 'List orphaned metrics mappings',
  security: protectedRouteSecurity,
  request: { params: MappingTopologyParamsSchema },
  responses: {
    200: success('Mapping orphans', z.object({ orphans: z.array(MappingOrphanSchema) })),
    ...common,
  },
})
const reassignRoute = createRoute({
  method: 'post',
  path: '/{id}/mapping/orphans/{entityId}/reassign',
  tags: ['Topology Mappings'],
  summary: 'Reassign an orphaned mapping',
  security: protectedRouteSecurity,
  request: {
    params: MappingEntityParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: ReassignMappingOrphanSchema } },
    },
  },
  responses: { 200: success('Mapping reassigned', MappingSuccessSchema), ...common },
})
const discardRoute = createRoute({
  method: 'delete',
  path: '/{id}/mapping/orphans/{entityId}',
  tags: ['Topology Mappings'],
  summary: 'Discard an orphaned mapping',
  security: protectedRouteSecurity,
  request: { params: MappingEntityParamsSchema },
  responses: { 200: success('Mapping discarded', MappingSuccessSchema), ...common },
})
const resetRoute = createRoute({
  method: 'post',
  path: '/{id}/registry/reset',
  tags: ['Topology Mappings'],
  summary: 'Reset the topology entity registry and mappings',
  security: protectedRouteSecurity,
  request: { params: MappingTopologyParamsSchema },
  responses: { 200: success('Registry reset', MappingSuccessSchema), ...common },
})
const replaceRoute = createRoute({
  method: 'put',
  path: '/{id}/mapping',
  tags: ['Topology Mappings'],
  summary: 'Replace a topology metrics mapping',
  security: protectedRouteSecurity,
  request: {
    params: MappingTopologyParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: ReplaceMetricsMappingSchema } },
    },
  },
  responses: { 200: success('Updated mapping', UpdatedMetricsMappingSchema), ...common },
})
const patchNodeRoute = createRoute({
  method: 'patch',
  path: '/{id}/mapping/nodes/{nodeId}',
  tags: ['Topology Mappings'],
  summary: 'Replace one node mapping',
  security: protectedRouteSecurity,
  request: {
    params: NodeMappingParamsSchema,
    body: { required: true, content: { 'application/json': { schema: PatchNodeMappingSchema } } },
  },
  responses: { 200: success('Updated node mapping', PatchNodeMappingResultSchema), ...common },
})
const patchLinkRoute = createRoute({
  method: 'patch',
  path: '/{id}/mapping/links/{linkId}',
  tags: ['Topology Mappings'],
  summary: 'Replace one link mapping',
  security: protectedRouteSecurity,
  request: {
    params: LinkMappingParamsSchema,
    body: { required: true, content: { 'application/json': { schema: PatchLinkMappingSchema } } },
  },
  responses: { 200: success('Updated link mapping', PatchLinkMappingResultSchema), ...common },
})
const clearNodesRoute = createRoute({
  method: 'delete',
  path: '/{id}/mapping/nodes',
  tags: ['Topology Mappings'],
  summary: 'Delete node mappings',
  security: protectedRouteSecurity,
  request: { params: MappingTopologyParamsSchema, query: MappingSourceQuerySchema },
  responses: { 200: success('Deleted mapping count', DeletedMappingsSchema), ...common },
})
const clearLinksRoute = createRoute({
  method: 'delete',
  path: '/{id}/mapping/links',
  tags: ['Topology Mappings'],
  summary: 'Delete link mappings',
  security: protectedRouteSecurity,
  request: { params: MappingTopologyParamsSchema, query: MappingSourceQuerySchema },
  responses: { 200: success('Deleted mapping count', DeletedMappingsSchema), ...common },
})
const autoMapRoute = createRoute({
  method: 'post',
  path: '/{id}/mapping/auto-map-links',
  tags: ['Topology Mappings'],
  summary: 'Automatically map topology links',
  security: protectedRouteSecurity,
  request: {
    params: MappingTopologyParamsSchema,
    body: { required: false, content: { 'application/json': { schema: AutoMapLinksSchema } } },
  },
  responses: { 200: success('Auto-map result', AutoMapLinksResultSchema), ...common },
})

function respond<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: TopologyMappingResult<T>,
) {
  return result.ok ? c.json(result.value, 200) : c.json({ error: result.error }, result.status)
}

export function createTopologyMappingApi(
  services: Pick<AppServices, 'topologyMappings'>,
): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.topologyMappings
  app.openapi(getRoute, async (c) =>
    respond(c, await service.get(c.req.valid('param').id, c.req.valid('query').sourceId)),
  )
  app.openapi(sourcesRoute, async (c) =>
    respond(c, await service.listSources(c.req.valid('param').id)),
  )
  app.openapi(orphansRoute, async (c) =>
    respond(c, await service.listOrphans(c.req.valid('param').id)),
  )
  app.openapi(reassignRoute, async (c) => {
    const { id, entityId } = c.req.valid('param')
    return respond(c, await service.reassignOrphan(id, entityId, c.req.valid('json').toEntityId))
  })
  app.openapi(discardRoute, (c) => {
    const { id, entityId } = c.req.valid('param')
    return respond(c, service.discardOrphan(id, entityId))
  })
  app.openapi(resetRoute, (c) => respond(c, service.resetRegistry(c.req.valid('param').id)))
  app.openapi(replaceRoute, async (c) => {
    const { mapping, sourceId } = c.req.valid('json')
    return respond(c, await service.replace(c.req.valid('param').id, mapping, sourceId))
  })
  app.openapi(patchNodeRoute, async (c) => {
    const { id, nodeId } = c.req.valid('param')
    return respond(c, await service.patchNode(id, nodeId, c.req.valid('json')))
  })
  app.openapi(patchLinkRoute, async (c) => {
    const { id, linkId } = c.req.valid('param')
    return respond(c, await service.patchLink(id, linkId, c.req.valid('json')))
  })
  app.openapi(clearNodesRoute, (c) =>
    respond(c, service.clear(c.req.valid('param').id, 'node', c.req.valid('query').sourceId)),
  )
  app.openapi(clearLinksRoute, (c) =>
    respond(c, service.clear(c.req.valid('param').id, 'link', c.req.valid('query').sourceId)),
  )
  app.openapi(autoMapRoute, async (c) =>
    respond(c, await service.autoMapLinks(c.req.valid('param').id, c.req.valid('json') ?? {})),
  )
  return app
}
