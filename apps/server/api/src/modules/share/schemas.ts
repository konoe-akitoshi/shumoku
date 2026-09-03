import { z } from '@hono/zod-openapi'
import { AlertSeveritySchema } from '../data-sources/schemas.js'
import {
  TopologyContextSchema,
  TopologyGraphSchema,
  TopologyRenderSchema,
  TopologyViewSchema,
} from '../topology-queries/schemas.js'

export { TopologyContextSchema, TopologyGraphSchema, TopologyRenderSchema, TopologyViewSchema }
export const ShareTokenParamsSchema = z.object({
  token: z
    .string()
    .min(1)
    .openapi({ param: { name: 'token', in: 'path' } }),
})
export const DashboardResourceParamsSchema = ShareTokenParamsSchema.extend({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})
export const PublicDashboardSchema = z
  .object({ id: z.string(), name: z.string(), layoutJson: z.string() })
  .openapi('PublicDashboard')
export const PublicTopologyMetadataSchema = z
  .object({ id: z.string(), name: z.string(), mappingJson: z.string().optional() })
  .openapi('PublicTopologyMetadata')
export const PublicAlertSchema = z
  .object({
    id: z.string(),
    severity: AlertSeveritySchema,
    status: z.enum(['active', 'resolved']),
    title: z.string(),
    host: z.string().optional(),
    nodeId: z.string().optional(),
    startTime: z.number(),
    endTime: z.number().optional(),
  })
  .openapi('PublicAlert')
export const PublicAlertQuerySchema = z.object({
  timeRange: z.coerce.number().int().optional(),
  activeOnly: z.stringbool().optional(),
  minSeverity: AlertSeveritySchema.optional(),
})
export const EventStreamSchema = z
  .string()
  .openapi({ type: 'string', description: 'Server-sent event stream' })
