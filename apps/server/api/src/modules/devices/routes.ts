/**
 * Devices API — how Shumoku reaches each device to read it directly.
 *
 *   GET    /api/topologies/:id/devices
 *     → the access methods, the credentials THIS topology links, and every
 *       device with its credential and last read outcome.
 *   PATCH  /api/topologies/:id/devices
 *     body: { entityIds, credentialId?: string | null, enabled?: boolean }
 *     Bulk: assign a linked credential (null un-assigns) and/or enable/disable.
 *   POST   /api/topologies/:id/devices/read
 *     body: { entityIds?: string[], dryRun?: boolean }
 *
 * Credentials themselves (create / edit / delete / test, and which topologies
 * use them) are an administrator surface: see `/api/credentials`. Secrets are
 * never returned here either — only which are set.
 */

import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppServices, DeviceResult } from '../../app/services.js'
import {
  apiErrorPayload,
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'

const TopologyParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

const ReadStatusSchema = z.enum(['ok', 'partial', 'failed'])
const DeviceStateSchema = z.enum([
  'lost',
  'partial',
  'unconfirmed',
  'pending',
  'ok',
  'silent',
  'no-address',
  'disabled',
])
const AccessFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  secret: z.boolean(),
  required: z.boolean(),
  placeholder: z.string().optional(),
})
const AccessMethodSchema = z.object({
  id: z.string(),
  label: z.string(),
  fields: z.array(AccessFieldSchema),
})
const CredentialUsageSchema = z.object({
  ok: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
})
const CredentialViewSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    method: z.string(),
    params: z.record(z.string(), z.string()),
    secretsSet: z.array(z.string()),
    usage: CredentialUsageSchema,
    lastOkAt: z.number().optional(),
  })
  .openapi('TopologyCredential')
const DeviceSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    mgmtIp: z.string().optional(),
    sysName: z.string().optional(),
    chassisId: z.string().optional(),
    vendor: z.string().optional(),
    model: z.string().optional(),
    credentialId: z.string().optional(),
    enabled: z.boolean(),
    state: DeviceStateSchema,
    lastReadAt: z.number().optional(),
    lastStatus: ReadStatusSchema.optional(),
    lastError: z.string().optional(),
    triedAt: z.number().optional(),
    assignedBy: z.literal('probe').optional(),
  })
  .openapi('Device')
const DevicesSchema = z
  .object({
    methods: z.array(AccessMethodSchema),
    credentials: z.array(CredentialViewSchema),
    devices: z.array(DeviceSchema),
  })
  .openapi('Devices')
const AssignDevicesSchema = z
  .object({
    entityIds: z.array(z.string().min(1)).min(1),
    credentialId: z.string().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .openapi('AssignDevices')
const AssignDevicesResultSchema = z.object({
  updated: z.number().int().nonnegative(),
  skipped: z.array(z.string()),
})
const ReadDevicesSchema = z
  .object({
    entityIds: z.array(z.string().min(1)).optional(),
    /** Send nothing; only return the plan. */
    dryRun: z.boolean().optional(),
  })
  .openapi('ReadDevices')
const ReadPlanSchema = z.object({
  toTry: z.number().int().nonnegative(),
  credentials: z.number().int().nonnegative(),
  retryLost: z.number().int().nonnegative(),
  requests: z.number().int().nonnegative(),
  toRead: z.number().int().nonnegative(),
})
const TrialSummarySchema = z.object({
  tried: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  silent: z.number().int().nonnegative(),
})
const ReadDevicesResultSchema = z
  .object({
    plan: ReadPlanSchema,
    trial: TrialSummarySchema,
    observation: z.any().nullable(),
    outcomes: z.array(
      z.object({
        entityId: z.string(),
        status: ReadStatusSchema,
        error: z.string().optional(),
      }),
    ),
  })
  .openapi('ReadDevicesResult')
const notFoundResponse = {
  description: 'Topology or credential not found',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const conflictResponse = {
  description: 'Conflict',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const internalErrorResponse = {
  description: 'Device operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const errors = {
  400: badRequestResponse,
  404: notFoundResponse,
  409: conflictResponse,
  500: internalErrorResponse,
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/{id}/devices',
  tags: ['Devices'],
  summary:
    'List devices with their credential and last read outcome, and the credentials the topology uses',
  security: protectedRouteSecurity,
  request: { params: TopologyParamsSchema },
  responses: {
    200: { description: 'Devices', content: { 'application/json': { schema: DevicesSchema } } },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const assignRoute = createRoute({
  method: 'patch',
  path: '/{id}/devices',
  tags: ['Devices'],
  summary: 'Assign a credential to, or enable/disable, many devices',
  security: protectedRouteSecurity,
  request: {
    params: TopologyParamsSchema,
    body: { required: true, content: { 'application/json': { schema: AssignDevicesSchema } } },
  },
  responses: {
    200: {
      description: 'Devices updated',
      content: { 'application/json': { schema: AssignDevicesResultSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
const readRoute = createRoute({
  method: 'post',
  path: '/{id}/devices/read',
  tags: ['Devices'],
  summary:
    'Read devices now; devices without a credential are tried with each credential the topology uses first',
  security: protectedRouteSecurity,
  request: {
    params: TopologyParamsSchema,
    body: { required: false, content: { 'application/json': { schema: ReadDevicesSchema } } },
  },
  responses: {
    200: {
      description: 'Read outcome per device',
      content: { 'application/json': { schema: ReadDevicesResultSchema } },
    },
    400: errors[400],
    404: errors[404],
    409: errors[409],
    500: errors[500],
  },
})
export function createDevicesApi(services: Pick<AppServices, 'devices'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.devices

  type Ctx = Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0]

  function respond200<T>(c: Ctx, result: DeviceResult<T>) {
    if (!result.ok) return c.json(apiErrorPayload(c, result.error, result.status), result.status)
    return c.json(result.value, 200)
  }

  app.openapi(listRoute, async (c) => respond200(c, await service.list(c.req.param('id'))))

  app.openapi(assignRoute, (c) => {
    const body = c.req.valid('json')
    return respond200(
      c,
      service.assign(c.req.param('id'), body.entityIds, {
        ...(body.credentialId !== undefined ? { credentialId: body.credentialId } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      }),
    )
  })

  app.openapi(readRoute, async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = ReadDevicesSchema.safeParse(body)
    if (!parsed.success) return c.json(apiErrorPayload(c, 'Invalid body', 400), 400)
    return respond200(
      c,
      await service.read(c.req.param('id'), parsed.data.entityIds ?? null, {
        dryRun: parsed.data.dryRun === true,
      }),
    )
  })

  return app
}
