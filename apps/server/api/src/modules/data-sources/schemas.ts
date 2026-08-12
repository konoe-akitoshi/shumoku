import { z } from '@hono/zod-openapi'

export const DataSourceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    configJson: z.string(),
    status: z.enum(['connected', 'disconnected', 'unknown']),
    statusMessage: z.string().optional(),
    lastCheckedAt: z.number().int().optional(),
    failCount: z.number().int(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .openapi('DataSource')

export const DataSourceListSchema = z.array(DataSourceSchema).openapi('DataSourceList')

export const DataSourceIdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

export const CreateDataSourceSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    configJson: z.string().min(1),
  })
  .openapi('CreateDataSource')

export const UpdateDataSourceSchema = CreateDataSourceSchema.partial().openapi('UpdateDataSource')

export const DeleteDataSourceResultSchema = z
  .object({ success: z.literal(true) })
  .openapi('DeleteDataSourceResult')

export const DataSourceCapabilityParamsSchema = z.object({
  capability: z
    .enum(['topology', 'metrics', 'alerts'])
    .openapi({ param: { name: 'capability', in: 'path' } }),
})

const PluginConfigSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), z.unknown()),
})

export const DataSourcePluginSchema = z
  .object({
    type: z.string(),
    displayName: z.string(),
    capabilities: z.array(z.string()).readonly(),
    configSchema: PluginConfigSchema.optional(),
    optionsSchema: PluginConfigSchema.optional(),
  })
  .openapi('DataSourcePlugin')

export const DataSourcePluginListSchema = z
  .array(DataSourcePluginSchema)
  .openapi('DataSourcePluginList')

export const ConfigOptionSchema = z.object({ value: z.string(), label: z.string() })

export const ConfigOptionsResultSchema = z
  .object({ options: z.array(ConfigOptionSchema) })
  .openapi('ConfigOptionsResult')

export const DataSourceConfigOptionParamsSchema = DataSourceIdParamsSchema.extend({
  key: z
    .string()
    .min(1)
    .openapi({ param: { name: 'key', in: 'path' } }),
})

export const ConnectionInfoQuerySchema = z.object({ origin: z.string().optional() })

export const ConnectionInfoResultSchema = z
  .object({
    items: z.array(
      z.object({ label: z.string(), value: z.string(), copyable: z.boolean().optional() }),
    ),
  })
  .openapi('ConnectionInfoResult')

export const AttachedTopologySchema = z.object({ topologyId: z.string(), name: z.string() })

export const AttachedTopologyListSchema = z
  .array(AttachedTopologySchema)
  .openapi('AttachedTopologyList')

export const ConnectionResultSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    version: z.string().optional(),
    warnings: z.array(z.string()).optional(),
  })
  .openapi('ConnectionResult')
