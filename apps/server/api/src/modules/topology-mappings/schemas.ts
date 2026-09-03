import { z } from '@hono/zod-openapi'
import { TopologySchema } from '../topologies/schemas.js'

export const MappingTopologyParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})
export const MappingEntityParamsSchema = MappingTopologyParamsSchema.extend({
  entityId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'entityId', in: 'path' } }),
})
export const NodeMappingParamsSchema = MappingTopologyParamsSchema.extend({
  nodeId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'nodeId', in: 'path' } }),
})
export const LinkMappingParamsSchema = MappingTopologyParamsSchema.extend({
  linkId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'linkId', in: 'path' } }),
})
export const MappingSourceQuerySchema = z.object({ sourceId: z.string().min(1).optional() })

const NodeMetricMappingSchema = z.object({
  hostId: z.string().optional(),
  hostName: z.string().optional(),
})
const LinkMetricMappingSchema = z.object({
  monitoredNodeId: z.string().optional(),
  interface: z.string().optional(),
  bandwidth: z.number().nonnegative().optional(),
})
export const MetricsMappingSchema = z
  .object({
    nodes: z.record(z.string(), NodeMetricMappingSchema),
    links: z.record(z.string(), LinkMetricMappingSchema),
  })
  .openapi('MetricsMapping')

export const SourceMetricsMappingSchema = z.object({
  sourceId: z.string(),
  sourceName: z.string(),
  priority: z.number().int(),
  mapping: MetricsMappingSchema,
})
export const MappingOrphanSchema = z.object({
  entityId: z.string(),
  kind: z.string(),
  sourceId: z.string(),
  payload: z.unknown(),
})
export const ReassignMappingOrphanSchema = z.object({ toEntityId: z.string().min(1) })
export const MappingSuccessSchema = z.object({ success: z.literal(true) }).openapi('MappingSuccess')
export const ReplaceMetricsMappingSchema = z.object({
  mapping: MetricsMappingSchema,
  sourceId: z.string().min(1).optional(),
})
export const UpdatedMetricsMappingSchema = TopologySchema.extend({
  skipped: z.object({ nodes: z.number().int(), links: z.number().int() }),
})
export const PatchNodeMappingSchema = NodeMetricMappingSchema.extend({
  sourceId: z.string().optional(),
})
export const PatchNodeMappingResultSchema = z.object({
  success: z.literal(true),
  topology: TopologySchema,
  nodeMapping: NodeMetricMappingSchema.nullable(),
})
export const PatchLinkMappingSchema = LinkMetricMappingSchema.extend({
  sourceId: z.string().optional(),
})
export const PatchLinkMappingResultSchema = z.object({
  success: z.literal(true),
  topology: TopologySchema,
  linkMapping: LinkMetricMappingSchema.nullable(),
})
export const DeletedMappingsSchema = z.object({ deleted: z.number().int() })
export const AutoMapLinksSchema = z.object({
  overwrite: z.boolean().optional(),
  sourceId: z.string().optional(),
})
export const AutoMapLinksResultSchema = z.object({
  matched: z.number().int(),
  total: z.number().int(),
  skipped: z.number().int(),
})
