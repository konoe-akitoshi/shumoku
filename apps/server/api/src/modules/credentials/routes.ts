/**
 * Credentials API — the server-wide secrets Shumoku reads devices with.
 *
 *   GET    /api/credentials          → access methods + every credential and the
 *                                      topologies that use it
 *   POST   /api/credentials          → create (or link an identical existing one)
 *   PATCH  /api/credentials/:id      → rename / change parameters / set the topologies
 *   DELETE /api/credentials/:id      → delete; its devices become un-assigned
 *   POST   /api/credentials/test     → probe a sample of one topology's devices
 *
 * Secrets are an administrator surface (`admin:manage`, see
 * `auth/access-policy.ts`). A secret field is write-only: responses report
 * which are set, never their values. A credential is only tried on the
 * topologies it is linked to.
 */

import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppServices, CredentialResult } from '../../app/services.js'
import {
  apiErrorPayload,
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'

const IdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

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
const UsageSchema = z.object({
  ok: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
})
const CredentialAdminSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    method: z.string(),
    params: z.record(z.string(), z.string()),
    secretsSet: z.array(z.string()),
    createdAt: z.number(),
    updatedAt: z.number(),
    secretChangedAt: z.number(),
    topologies: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        usage: UsageSchema,
        silent: z.number().int().nonnegative(),
      }),
    ),
  })
  .openapi('Credential')
const CredentialsSchema = z
  .object({
    methods: z.array(AccessMethodSchema),
    credentials: z.array(CredentialAdminSchema),
  })
  .openapi('Credentials')
const CreateCredentialSchema = z
  .object({
    name: z.string().optional(),
    method: z.string().min(1),
    params: z.record(z.string(), z.unknown()),
    topologyIds: z.array(z.string().min(1)),
  })
  .openapi('CreateCredential')
const CreateCredentialResultSchema = z
  .object({ linkedExisting: z.boolean(), credential: CredentialAdminSchema })
  .openapi('CreateCredentialResult')
const UpdateCredentialSchema = z
  .object({
    name: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    topologyIds: z.array(z.string().min(1)).optional(),
  })
  .openapi('UpdateCredential')
const UpdateCredentialResultSchema = z
  .object({
    credential: CredentialAdminSchema,
    effect: z.array(
      z.object({
        topologyId: z.string(),
        name: z.string(),
        devices: z.number().int().nonnegative(),
        retrySilent: z.number().int().nonnegative(),
      }),
    ),
  })
  .openapi('UpdateCredentialResult')
const DeleteCredentialResultSchema = z
  .object({
    unassigned: z.number().int().nonnegative(),
    topologies: z.number().int().nonnegative(),
  })
  .openapi('DeleteCredentialResult')
const TestCredentialSchema = z
  .object({
    topologyId: z.string().min(1),
    method: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
    credentialId: z.string().min(1).optional(),
    entityIds: z.array(z.string().min(1)).optional(),
  })
  .openapi('TestCredential')
const TestCredentialResultSchema = z
  .object({
    sent: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative(),
    silent: z.number().int().nonnegative(),
  })
  .openapi('TestCredentialResult')

const notFoundResponse = {
  description: 'Credential or topology not found',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const conflictResponse = {
  description: 'Conflict, e.g. a credential with this name already exists',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const internalErrorResponse = {
  description: 'Credential operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Credentials'],
  summary: 'List credentials and the topologies that use them',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Credentials',
      content: { 'application/json': { schema: CredentialsSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
    409: conflictResponse,
    500: internalErrorResponse,
  },
})
const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Credentials'],
  summary: 'Create a credential, or link an identical existing one to the topologies',
  security: protectedRouteSecurity,
  request: {
    body: { required: true, content: { 'application/json': { schema: CreateCredentialSchema } } },
  },
  responses: {
    200: {
      description: 'An identical credential existed; the topologies were linked to it',
      content: { 'application/json': { schema: CreateCredentialResultSchema } },
    },
    201: {
      description: 'Credential created',
      content: { 'application/json': { schema: CreateCredentialResultSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
    409: conflictResponse,
    500: internalErrorResponse,
  },
})
const testRoute = createRoute({
  method: 'post',
  path: '/test',
  tags: ['Credentials'],
  summary: "Probe a sample of a topology's devices with a credential; stores nothing",
  security: protectedRouteSecurity,
  request: {
    body: { required: true, content: { 'application/json': { schema: TestCredentialSchema } } },
  },
  responses: {
    200: {
      description: 'How many probes were sent and answered',
      content: { 'application/json': { schema: TestCredentialResultSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
    409: conflictResponse,
    500: internalErrorResponse,
  },
})
const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Credentials'],
  summary: 'Rename a credential, change its parameters, or set the topologies that use it',
  security: protectedRouteSecurity,
  request: {
    params: IdParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UpdateCredentialSchema } } },
  },
  responses: {
    200: {
      description: 'Credential updated, with what the change touches',
      content: { 'application/json': { schema: UpdateCredentialResultSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
    409: conflictResponse,
    500: internalErrorResponse,
  },
})
const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Credentials'],
  summary: 'Delete a credential; its devices become un-assigned',
  security: protectedRouteSecurity,
  request: { params: IdParamsSchema },
  responses: {
    200: {
      description: 'Credential deleted',
      content: { 'application/json': { schema: DeleteCredentialResultSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
    409: conflictResponse,
    500: internalErrorResponse,
  },
})

export function createCredentialsApi(services: Pick<AppServices, 'credentials'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.credentials

  type Ctx = Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0]

  function respond200<T>(c: Ctx, result: CredentialResult<T>) {
    if (!result.ok) return c.json(apiErrorPayload(c, result.error, result.status), result.status)
    return c.json(result.value, 200)
  }

  app.openapi(listRoute, (c) => respond200(c, service.list()))

  app.openapi(createRouteDef, (c) => {
    const result = service.create(c.req.valid('json'))
    if (!result.ok) return c.json(apiErrorPayload(c, result.error, result.status), result.status)
    // 201 for a new credential, 200 when an identical one was linked instead.
    return result.value.linkedExisting ? c.json(result.value, 200) : c.json(result.value, 201)
  })

  app.openapi(testRoute, async (c) => respond200(c, await service.test(c.req.valid('json'))))

  app.openapi(updateRoute, (c) =>
    respond200(c, service.update(c.req.param('id'), c.req.valid('json'))),
  )

  app.openapi(deleteRoute, (c) => respond200(c, service.delete(c.req.param('id'))))

  return app
}
