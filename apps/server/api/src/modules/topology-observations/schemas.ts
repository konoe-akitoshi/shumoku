import { z } from '@hono/zod-openapi'

export const NetworkGraphSchema = z
  .looseObject({
    version: z.string().optional(),
    name: z.string().optional(),
    nodes: z.array(z.record(z.string(), z.unknown())),
    links: z.array(z.record(z.string(), z.unknown())),
    subgraphs: z.array(z.record(z.string(), z.unknown())).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('NetworkGraph')

/** What one source observed: the network as the YAML writes it, with its layers. */
export const SourceNetworkSchema = z
  .looseObject({
    network: z.looseObject({
      nodes: z.array(z.record(z.string(), z.unknown())),
      links: z.array(z.record(z.string(), z.unknown())),
    }),
    observation: z.record(z.string(), z.unknown()).optional(),
    design: z.record(z.string(), z.unknown()).optional(),
    drawing: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('SourceNetwork')

export const TopologyIdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

export const ObservationParamsSchema = TopologyIdParamsSchema.extend({
  obsId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'obsId', in: 'path' } }),
})

export const TopologySourceParamsSchema = z.object({
  topologyId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'topologyId', in: 'path' } }),
  sourceId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'sourceId', in: 'path' } }),
})

export const ObservationStatusSchema = z.enum(['ok', 'partial', 'failed', 'empty'])

export const ObservationSummarySchema = z.object({
  id: z.string(),
  topologyId: z.string(),
  sourceId: z.string(),
  capturedAt: z.number().int(),
  status: ObservationStatusSchema,
  statusMessage: z.string().optional(),
  nodeCount: z.number().int(),
  linkCount: z.number().int(),
  portCount: z.number().int(),
  createdAt: z.number().int(),
})

export const ObservationSchema = ObservationSummarySchema.extend({
  /** What the source sent, as sent. */
  source: z.unknown(),
  contributionChanged: z.boolean().optional(),
}).openapi('TopologyObservation')

export const ObservationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

export const RecordObservationSchema = z.object({
  source: SourceNetworkSchema,
  status: ObservationStatusSchema.default('ok'),
})

export const LatestSnapshotSchema = z
  .object({
    source: z.unknown(),
    capturedAt: z.number().int().nullable(),
    status: ObservationStatusSchema.optional(),
    observationId: z.string().optional(),
  })
  .openapi('LatestTopologySnapshot')

export const ResolvedTopologySchema = z
  .object({ graph: NetworkGraphSchema, snapshotCount: z.number().int() })
  .openapi('ResolvedTopology')

export const DisplaySettingsSchema = z
  .object({
    edgeStyle: z.enum(['polyline', 'orthogonal', 'splines', 'straight']),
    splineMode: z.enum(['sloppy', 'conservative', 'conservative_soft']),
    hideDisconnected: z.boolean(),
  })
  .openapi('TopologyDisplaySettings')

export const UpdateDisplaySettingsSchema = DisplaySettingsSchema.partial().openapi(
  'UpdateTopologyDisplaySettings',
)

export const OkResultSchema = z.object({ ok: z.literal(true) }).openapi('OkResult')
