import { z } from '@hono/zod-openapi'

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
