import { OpenAPIHono, z } from '@hono/zod-openapi'
import type { Context } from 'hono'

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503

const ERROR_CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_CONTENT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
}

function errorCode(status: number): string {
  return ERROR_CODE_BY_STATUS[status] ?? 'HTTP_ERROR'
}

function errorBody(message: string, status: number, requestId: string) {
  return {
    code: errorCode(status),
    message,
    requestId,
    error: message,
  }
}

export function apiErrorPayload(c: Context, message: string, status: ErrorStatus) {
  const requestId = crypto.randomUUID()
  c.header('X-Request-ID', requestId)
  return errorBody(message, status, requestId)
}

export function apiError(c: Context, message: string, status: ErrorStatus) {
  return c.json(apiErrorPayload(c, message, status), status)
}

export function createOpenAPIApp(): OpenAPIHono {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) return apiError(c, 'Invalid request', 400)
      return undefined
    },
  })
  app.use('*', async (c, next) => {
    await next()
    if (c.res.status < 400 || !c.res.headers.get('Content-Type')?.includes('application/json')) {
      return
    }
    const body: unknown = await c.res
      .clone()
      .json()
      .catch(() => null)
    if (
      !body ||
      typeof body !== 'object' ||
      !('error' in body) ||
      typeof body.error !== 'string' ||
      'code' in body
    ) {
      return
    }

    const requestId = crypto.randomUUID()
    const headers = new Headers(c.res.headers)
    headers.delete('Content-Length')
    headers.set('X-Request-ID', requestId)
    c.res = new Response(
      JSON.stringify({ ...body, ...errorBody(body.error, c.res.status, requestId) }),
      { status: c.res.status, statusText: c.res.statusText, headers },
    )
  })
  return app
}

export function registerSecuritySchemes(app: OpenAPIHono): void {
  app.openAPIRegistry.registerComponent('securitySchemes', 'sessionCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'shumoku_session',
    description: 'Browser administrator session',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: '256-bit development token',
    description: 'Loopback-only development automation credential',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'webhookHeader', {
    type: 'apiKey',
    in: 'header',
    name: 'X-Webhook-Secret',
    description: 'Webhook-specific shared secret',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'webhookQuery', {
    type: 'apiKey',
    in: 'query',
    name: 'secret',
    description: 'Webhook-specific shared secret for clients that cannot set headers',
  })
}

export const ErrorSchema = z
  .object({
    code: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .openapi({ example: 'NOT_FOUND' }),
    message: z.string().openapi({ example: 'Topology not found' }),
    requestId: z.string().uuid(),
    error: z.string().openapi({
      deprecated: true,
      description: 'Deprecated alias of message, retained for compatibility',
    }),
  })
  .openapi('Error')

export const protectedRouteSecurity: Array<Record<string, string[]>> = [
  { sessionCookie: [] },
  { bearerAuth: [] },
]

export const unauthorizedResponse = {
  description: 'Authentication is required',
  content: {
    'application/json': {
      schema: ErrorSchema,
    },
  },
} as const

export const badRequestResponse = {
  description: 'The request did not match the API contract',
  content: {
    'application/json': {
      schema: ErrorSchema,
    },
  },
} as const
