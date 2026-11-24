/**
 * API tokens API — Bearer credentials for automation (Terraform, CI, scripts).
 *
 *   GET    /api/admin/api-tokens       → every token (never its secret)
 *   POST   /api/admin/api-tokens       → issue a token; the secret is in this response only
 *   DELETE /api/admin/api-tokens/:id   → revoke
 *
 * Under `/api/admin`, so every operation needs `admin:manage` (see `auth/access-policy.ts`).
 */

import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import { ASSIGNABLE_ROLES } from '../../auth/principal.js'
import {
  apiErrorPayload,
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
  unauthorizedResponse,
} from '../../openapi/common.js'

const IdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

const ApiTokenSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    prefix: z.string().openapi({ description: 'First characters of the secret, for recognition' }),
    role: z.enum(ASSIGNABLE_ROLES),
    createdAt: z.number(),
    expiresAt: z.number().nullable(),
    lastUsedAt: z.number().nullable(),
  })
  .openapi('ApiToken')

const ApiTokensSchema = z.object({ tokens: z.array(ApiTokenSchema) }).openapi('ApiTokens')

const CreateApiTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    role: z.enum(ASSIGNABLE_ROLES),
    expiresAt: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .openapi({ description: 'Expiry as epoch milliseconds; omitted or null never expires' }),
  })
  .openapi('CreateApiToken')

const CreateApiTokenResultSchema = z
  .object({
    token: z.string().openapi({ description: 'The secret. Shown only in this response.' }),
    apiToken: ApiTokenSchema,
  })
  .openapi('CreateApiTokenResult')

const notFoundResponse = {
  description: 'API token not found',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['API tokens'],
  summary: 'List API tokens',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'API tokens, newest first',
      content: { 'application/json': { schema: ApiTokensSchema } },
    },
    401: unauthorizedResponse,
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['API tokens'],
  summary: 'Issue an API token; its secret is returned once',
  security: protectedRouteSecurity,
  request: {
    body: { required: true, content: { 'application/json': { schema: CreateApiTokenSchema } } },
  },
  responses: {
    201: {
      description: 'API token issued',
      content: { 'application/json': { schema: CreateApiTokenResultSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['API tokens'],
  summary: 'Revoke an API token',
  security: protectedRouteSecurity,
  request: { params: IdParamsSchema },
  responses: {
    200: {
      description: 'API token revoked',
      content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

export function createApiTokensApi(services: Pick<AppServices, 'apiTokens'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.apiTokens

  app.openapi(listRoute, (c) => c.json({ tokens: service.list() }, 200))

  app.openapi(createRouteDef, (c) => {
    const input = c.req.valid('json')
    if (input.expiresAt != null && input.expiresAt <= Date.now()) {
      return c.json(apiErrorPayload(c, 'expiresAt must be in the future', 400), 400)
    }
    return c.json(service.create(input), 201)
  })

  app.openapi(deleteRoute, (c) => {
    if (!service.revoke(c.req.valid('param').id)) {
      return c.json(apiErrorPayload(c, 'API token not found', 404), 404)
    }
    return c.json({ success: true as const }, 200)
  })

  return app
}
