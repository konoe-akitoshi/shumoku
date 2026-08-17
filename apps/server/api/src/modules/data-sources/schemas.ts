import { z } from '@hono/zod-openapi'
import type { PluginConfigProperty } from '@shumoku/core'

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

export const PluginConfigPropertySchema: z.ZodType<PluginConfigProperty> = z
  .lazy(() =>
    z.object({
      type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
      title: z.string().optional(),
      description: z.string().optional(),
      format: z.enum(['password', 'uri', 'email']).optional(),
      secret: z.boolean().optional(),
      placeholder: z.string().optional(),
      default: z.unknown().optional(),
      oneOf: z
        .array(z.object({ const: z.union([z.string(), z.number()]), title: z.string() }))
        .optional(),
      enum: z.array(z.union([z.string(), z.number()])).optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      step: z.number().optional(),
      items: z.object({ type: z.literal('string') }).optional(),
      optionsSource: z.string().optional(),
      freeSolo: z.boolean().optional(),
      scope: z.object({ kind: z.enum(['include', 'exclude']), key: z.string() }).optional(),
      properties: z.record(z.string(), PluginConfigPropertySchema).optional(),
      required: z.array(z.string()).optional(),
      visibleWhen: z
        .object({
          field: z.string(),
          equals: z.union([z.string(), z.number(), z.boolean()]),
        })
        .optional(),
      requiredWhen: z
        .object({
          field: z.string(),
          equals: z.union([z.string(), z.number(), z.boolean()]),
        })
        .optional(),
      warning: z.string().optional(),
      help: z.string().optional(),
      docUrl: z.string().optional(),
      serverSupplied: z.boolean().optional(),
    }),
  )
  .openapi('PluginConfigProperty')

export const PluginConfigSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), PluginConfigPropertySchema),
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

const IdentitySchema = z.object({
  mgmtIp: z.string().optional(),
  chassisId: z.string().optional(),
  sysName: z.string().optional(),
  ifIndex: z.number().int().optional(),
  ifName: z.string().optional(),
  mac: z.string().optional(),
  vendorIds: z.record(z.string(), z.string()).optional(),
})

export const HostSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    displayName: z.string().optional(),
    status: z.enum(['up', 'down', 'unknown']).optional(),
    ip: z.string().optional(),
    identity: IdentitySchema.optional(),
  })
  .openapi('Host')

export const HostListSchema = z.array(HostSchema).openapi('HostList')

export const HostParamsSchema = DataSourceIdParamsSchema.extend({
  hostId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'hostId', in: 'path' } }),
})

export const HostItemSchema = z
  .object({
    id: z.string(),
    hostId: z.string(),
    name: z.string(),
    key: z.string(),
    lastValue: z.string().optional(),
    unit: z.string().optional(),
    interfaceName: z.string().optional(),
    interfaceIdentity: IdentitySchema.optional(),
    direction: z.enum(['in', 'out']).optional(),
  })
  .openapi('HostItem')

export const HostItemListSchema = z.array(HostItemSchema).openapi('HostItemList')

export const InterfaceNeighborSchema = z
  .object({
    localInterface: z.string(),
    localInterfaceIdentity: IdentitySchema.optional(),
    remoteSysName: z.string().optional(),
    remoteChassisId: z.string().optional(),
    remotePortId: z.string().optional(),
  })
  .openapi('InterfaceNeighbor')

export const InterfaceNeighborListSchema = z
  .array(InterfaceNeighborSchema)
  .openapi('InterfaceNeighborList')

export const DiscoveredMetricSchema = z
  .object({
    name: z.string(),
    labels: z.record(z.string(), z.string()),
    value: z.union([z.number(), z.string(), z.boolean()]),
    help: z.string().optional(),
  })
  .openapi('DiscoveredMetric')

export const DiscoveredMetricListSchema = z
  .array(DiscoveredMetricSchema)
  .openapi('DiscoveredMetricList')

const FilterOptionSchema = z.object({ slug: z.string(), name: z.string() })

export const FilterOptionsSchema = z
  .object({
    sites: z.array(FilterOptionSchema),
    tags: z.array(FilterOptionSchema),
  })
  .openapi('FilterOptions')

export const AlertSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info', 'ok'])

export const AlertQuerySchema = z.object({
  timeRange: z.coerce.number().int().optional(),
  activeOnly: z.stringbool().optional(),
  minSeverity: AlertSeveritySchema.optional(),
})

export const AlertSchema = z
  .object({
    id: z.string(),
    severity: AlertSeveritySchema,
    title: z.string(),
    description: z.string().optional(),
    host: z.string().optional(),
    hostId: z.string().optional(),
    nodeId: z.string().optional(),
    startTime: z.number(),
    endTime: z.number().optional(),
    status: z.enum(['active', 'resolved']),
    source: z.string(),
    receivedAt: z.number().optional(),
    url: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
  })
  .openapi('Alert')

export const AlertListSchema = z.array(AlertSchema).openapi('AlertList')

export const NativeApiRequestSchema = z
  .object({
    method: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .openapi('NativeApiRequest')

export const NativeApiResultSchema = z.object({ result: z.unknown() }).openapi('NativeApiResult')

export const DataSourceScanRequestSchema = z
  .object({
    topologyId: z.string().min(1).optional(),
    seeds: z.array(z.string().min(1)).optional(),
  })
  .openapi('DataSourceScanRequest')

export const SnapshotSchema = z
  .object({
    status: z.enum(['ok', 'partial', 'failed', 'empty']),
    statusMessage: z.string().optional(),
    capturedAt: z.number(),
    graph: z.record(z.string(), z.unknown()).nullable(),
    warnings: z.array(z.string()).optional(),
  })
  .openapi('Snapshot')

export const TopologyObservationSchema = z
  .object({
    id: z.string(),
    topologyId: z.string(),
    sourceId: z.string(),
    capturedAt: z.number(),
    status: z.enum(['ok', 'partial', 'failed', 'empty']),
    statusMessage: z.string().optional(),
    graph: z.record(z.string(), z.unknown()).nullable(),
    nodeCount: z.number().int(),
    linkCount: z.number().int(),
    portCount: z.number().int(),
    createdAt: z.number(),
    contributionChanged: z.boolean().optional(),
  })
  .openapi('TopologyObservation')

export const DataSourceScanResultSchema = z
  .object({
    snapshot: SnapshotSchema,
    observation: TopologyObservationSchema.optional(),
  })
  .openapi('DataSourceScanResult')
