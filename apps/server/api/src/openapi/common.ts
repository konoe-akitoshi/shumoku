import { OpenAPIHono, z } from '@hono/zod-openapi'

export function createOpenAPIApp(): OpenAPIHono {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'Invalid request' }, 400)
      return undefined
    },
  })
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
}

export const ErrorSchema = z
  .object({
    error: z.string(),
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
