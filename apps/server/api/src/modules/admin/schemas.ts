import { z } from '@hono/zod-openapi'

const PollSchedulerStatusSchema = z.object({
  running: z.boolean(),
  activePolls: z.number().int().nonnegative(),
  queuedPolls: z.number().int().nonnegative(),
  topologyCount: z.number().int().nonnegative(),
  watchedTopologies: z.number().int().nonnegative(),
  inFlightTopologies: z.number().int().nonnegative(),
  fastIntervalMs: z.number().int().positive(),
  slowIntervalMs: z.number().int().positive(),
  concurrencyLimit: z.number().int().positive(),
})

const DiscoverySchedulerStatusSchema = z.object({
  running: z.boolean(),
  tickInFlight: z.boolean(),
  tickIntervalMs: z.number().int().positive(),
  minimumSyncIntervalMs: z.number().int().positive(),
})

export const AdminStatusSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    timestamp: z.number().int(),
    uptimeSeconds: z.number().nonnegative(),
    database: z.object({ ready: z.boolean() }),
    topologies: z.object({
      database: z.number().int().nonnegative(),
      legacyFile: z.number().int().nonnegative(),
    }),
    plugins: z.object({ registered: z.number().int().nonnegative() }),
    realtime: z.object({
      webSocketClients: z.number().int().nonnegative(),
      sseSubscribers: z.number().int().nonnegative(),
    }),
    schedulers: z.object({
      metrics: PollSchedulerStatusSchema,
      discovery: DiscoverySchedulerStatusSchema,
    }),
  })
  .openapi('AdminStatus')
