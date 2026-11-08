import { z } from '@hono/zod-openapi'
import { ErrorSchema } from '../../openapi/common.js'
import { DataSourceSchema } from '../data-sources/schemas.js'
import { ObservationSchema, TopologySourceParamsSchema } from '../topology-observations/schemas.js'

export { TopologySourceParamsSchema }

export const TopologySourcesParamsSchema = z.object({
  topologyId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'topologyId', in: 'path' } }),
})

export const TopologyDataSourceSchema = z
  .object({
    id: z.string(),
    topologyId: z.string(),
    dataSourceId: z.string(),
    purpose: z.enum(['topology', 'metrics']),
    syncMode: z.enum(['manual', 'on_view', 'webhook']),
    webhookSecret: z.string().optional(),
    lastSyncedAt: z.number().int().optional(),
    priority: z.number().int(),
    optionsJson: z.string().optional(),
    nodeContribution: z.enum(['scoop', 'anchor']),
    linkContribution: z.enum(['add', 'update']),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    dataSource: DataSourceSchema.optional(),
  })
  .openapi('TopologyDataSource')

const ExistingSourceInputSchema = z.object({
  dataSourceId: z.string().min(1),
  purpose: z.enum(['topology', 'metrics']),
  syncMode: z.enum(['manual', 'on_view', 'webhook']).optional(),
  priority: z.number().int().optional(),
  optionsJson: z.string().optional(),
  nodeContribution: z.enum(['scoop', 'anchor']).optional(),
  linkContribution: z.enum(['add', 'update']).optional(),
})

export const AddTopologySourceSchema = z
  .union([
    ExistingSourceInputSchema,
    z.object({
      type: z.literal('manual'),
      purpose: z.enum(['topology', 'metrics']).default('topology'),
    }),
  ])
  .openapi('AddTopologySource')

export const AddedTopologySourceSchema = z.union([
  TopologyDataSourceSchema,
  z.object({ dataSourceId: z.string() }),
])

export const UpdateTopologySourceSchema = ExistingSourceInputSchema.omit({
  dataSourceId: true,
  purpose: true,
})
  .partial()
  .openapi('UpdateTopologySource')

export const ReplaceTopologySourcesSchema = z.object({
  sources: z.array(ExistingSourceInputSchema),
})

export const SourceAttachmentParamsSchema = TopologySourcesParamsSchema.extend({
  sourceId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'sourceId', in: 'path' } }),
})

export const ProbeTopologySourceSchema = z.object({
  seeds: z.array(z.string().min(1)).min(1),
})

export const TopologySourceSuccessSchema = z
  .object({ success: z.literal(true) })
  .openapi('TopologySourceSuccess')

export const ClearTopologySourceResultSchema = TopologySourceSuccessSchema.extend({
  deleted: z.number().int(),
})

export const ProbeTopologySourceResultSchema = z.object({ observation: ObservationSchema })

export const SyncTopologySourceResultSchema = z
  .object({
    observation: ObservationSchema,
    snapshot: z.object({
      status: z.enum(['ok', 'partial', 'failed', 'empty']),
      statusMessage: z.string().optional(),
      capturedAt: z.number().int(),
      warnings: z.array(z.string()).optional(),
      source: z.unknown(),
    }),
  })
  .openapi('SyncTopologySourceResult')

export const ManualEditSchema = z
  .object({
    nodeId: z.string().min(1).openapi({ description: 'The resolved node id the GUI shows' }),
    label: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .openapi({ description: 'A string renames the node; null removes the rename' }),
    absent: z
      .boolean()
      .optional()
      .openapi({ description: 'true hides the node; false removes the hide' }),
  })
  .refine((input) => input.label !== undefined || input.absent !== undefined, {
    message: 'label or absent is required',
  })
  .openapi('ManualEdit')

export const ManualEditResultSchema = z
  .object({
    sourceId: z.string(),
    nodeId: z.string(),
    yamlId: z.string().nullable().openapi({
      description: "The node's id in the Manual source's YAML; null when none remains",
    }),
    label: z.string().nullable(),
    absent: z.boolean(),
  })
  .openapi('ManualEditResult')

export const ManualEditConflictSchema = ErrorSchema.extend({
  reason: z.enum(['not-top-priority', 'claim-conflict']),
  top: z.string().optional().openapi({ description: 'The source that outranks the Manual source' }),
}).openapi('ManualEditConflict')
