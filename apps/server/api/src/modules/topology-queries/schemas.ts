import { z } from '@hono/zod-openapi'
import { NetworkGraphSchema, TopologyIdParamsSchema } from '../topology-observations/schemas.js'

export { TopologyIdParamsSchema }

const JsonObjectSchema = z.record(z.string(), z.unknown())
const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

export const DerivingSchema = z.object({ deriving: z.literal(true) }).openapi('TopologyDeriving')

export const TopologyExportQuerySchema = z.object({
  format: z.enum(['svg', 'png', 'html']),
  scale: z.coerce.number().min(0.25).max(4).optional(),
})

const ProvenanceSchema = z.object({
  source: z.string(),
  state: z.enum(['confirmed', 'intrinsic-only', 'discovered-only', 'conflicting']).optional(),
  observedAt: z.number().optional(),
})
/**
 * What the Server knows of each served element beyond the drawn graph, keyed by the ids the graph
 * is served with. The graph itself carries no identity, provenance or attachments.
 */
export const ResolvedRecordSchema = z
  .object({
    nodes: z.record(
      z.string(),
      z.object({
        attributes: z.object({
          address: z.string().optional(),
          addresses: z.array(z.string()).optional(),
          chassisId: z.string().optional(),
          sysName: z.string().optional(),
          mac: z.string().optional(),
        }),
        provenance: ProvenanceSchema.optional(),
        vendorIds: z.record(z.string(), z.string()).optional(),
        metadata: JsonObjectSchema.optional(),
      }),
    ),
    links: z.record(z.string(), z.object({ provenance: ProvenanceSchema.optional() })),
  })
  .openapi('ResolvedRecord')

export const ParsedTopologySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    graph: NetworkGraphSchema,
    record: ResolvedRecordSchema,
    layout: z.object({
      nodes: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
      bounds: BoundsSchema,
    }),
    metrics: JsonObjectSchema,
    metricsSourceId: z.string().optional(),
    mapping: JsonObjectSchema.optional(),
    stale: z.boolean(),
  })
  .openapi('ParsedTopology')

export const TopologyGraphSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    graph: NetworkGraphSchema,
    record: ResolvedRecordSchema,
    stale: z.boolean(),
  })
  .openapi('TopologyGraph')

export const TopologyViewSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    graph: NetworkGraphSchema,
    /** Absent on the shared view, which serves no record. */
    record: ResolvedRecordSchema.optional(),
    scene: JsonObjectSchema.optional(),
    stale: z.boolean(),
  })
  .openapi('TopologyView')

const ViewBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})
export const TopologyRenderSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    svg: z.string(),
    css: z.string(),
    viewBox: ViewBoxSchema,
    nodeCount: z.number().int(),
    edgeCount: z.number().int(),
  })
  .openapi('TopologyRender')

/** The keys a hosts source can be matched on, as the host contract spells them. */
const IdentitySchema = z.looseObject({
  mgmtIp: z.string().optional(),
  chassisId: z.string().optional(),
  sysName: z.string().optional(),
  mac: z.string().optional(),
  vendorIds: z.record(z.string(), z.string()).optional(),
})
const PortInfoSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  interfaceName: z.string().optional(),
  aliases: z.array(z.string()).optional(),
})
export const TopologyContextSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    nodes: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.string(),
        identity: IdentitySchema.optional(),
      }),
    ),
    edges: z.array(
      z.object({
        id: z.string(),
        from: z.object({
          nodeId: z.string(),
          port: z.string().optional(),
          portInfo: PortInfoSchema.optional(),
        }),
        to: z.object({
          nodeId: z.string(),
          port: z.string().optional(),
          portInfo: PortInfoSchema.optional(),
        }),
        standard: z.string().optional(),
      }),
    ),
    subgraphs: z.array(JsonObjectSchema).optional(),
    metrics: JsonObjectSchema,
    metricsSourceId: z.string().optional(),
    mapping: JsonObjectSchema.optional(),
  })
  .openapi('TopologyContext')

const MembershipCriterionSchema = z.object({
  attr: z.enum(['name', 'subnet', 'metadata']),
  value: z.string(),
  key: z.string().optional(),
})
const ScopeFilterSchema = z.object({
  include: z.array(MembershipCriterionSchema).optional(),
  exclude: z.array(MembershipCriterionSchema).optional(),
})
export const TopologyCompositionSchema = z
  .object({
    scopeMode: z.enum(['auto', 'open', 'closed']),
    scopeSourceId: z.string().optional(),
    scope: ScopeFilterSchema,
    compositionMode: z.enum(['additive', 'enrichment']),
  })
  .openapi('TopologyComposition')
export const UpdateTopologyCompositionSchema = z.object({
  scopeMode: z.enum(['auto', 'open', 'closed']).optional(),
  scopeSourceId: z.string().nullable().optional(),
  scope: ScopeFilterSchema.optional(),
  compositionMode: z.enum(['additive', 'enrichment']).optional(),
})
