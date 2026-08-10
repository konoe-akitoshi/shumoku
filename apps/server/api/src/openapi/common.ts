import { OpenAPIHono, z } from '@hono/zod-openapi'

export function createOpenAPIApp(): OpenAPIHono {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'Invalid request' }, 400)
      return undefined
    },
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
