import { z } from '@hono/zod-openapi'
import { TopologyIdParamsSchema } from '../topologies/schemas.js'

export { TopologyIdParamsSchema }

export const SyncJobStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
  message: z.string().optional(),
  nodeCount: z.number().int().optional(),
  linkCount: z.number().int().optional(),
  stage: z.string().optional(),
})
export const SyncJobSchema = z
  .object({
    id: z.string(),
    topologyId: z.string(),
    state: z.enum(['running', 'done', 'failed', 'cancelled']),
    startedAt: z.number().int(),
    finishedAt: z.number().int().optional(),
    steps: z.array(SyncJobStepSchema),
    cancelRequested: z.boolean(),
  })
  .openapi('TopologySyncJob')
export const SyncJobResultSchema = z
  .object({ job: SyncJobSchema.nullable() })
  .openapi('TopologySyncJobResult')
export const StartedSyncJobResultSchema = z
  .object({ job: SyncJobSchema })
  .openapi('StartedTopologySyncJobResult')
export const ShareTopologyResultSchema = z
  .object({ shareToken: z.string() })
  .openapi('ShareTopologyResult')
export const UnshareTopologyResultSchema = z
  .object({ success: z.literal(true) })
  .openapi('UnshareTopologyResult')
