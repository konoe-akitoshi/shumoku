import { z } from '@hono/zod-openapi'

const MembershipCriterionSchema = z.object({
  attr: z.enum(['name', 'subnet', 'metadata']),
  value: z.string(),
  key: z.string().optional(),
})

const ScopeFilterSchema = z.object({
  include: z.array(MembershipCriterionSchema).optional(),
  exclude: z.array(MembershipCriterionSchema).optional(),
})

export const TopologySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    compositionMode: z.enum(['additive', 'enrichment']),
    scopeMode: z.enum(['auto', 'open', 'closed']),
    scopeSourceId: z.string().optional(),
    scope: ScopeFilterSchema,
    metricsSourceId: z.string().optional(),
    mappingJson: z.string().optional(),
    shareToken: z.string().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .openapi('Topology')

export const TopologyListSchema = z.array(TopologySchema).openapi('TopologyList')

export const TopologyIdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

export const CreateTopologySchema = z
  .object({
    name: z.string().min(1),
  })
  .openapi('CreateTopology')

export const UpdateTopologySchema = z
  .object({
    name: z.string().min(1).optional(),
  })
  .openapi('UpdateTopology')

export const DeleteTopologyResultSchema = z
  .object({ success: z.literal(true) })
  .openapi('DeleteTopologyResult')
