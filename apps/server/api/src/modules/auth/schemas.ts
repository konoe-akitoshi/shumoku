import { z } from '@hono/zod-openapi'
import { AUTH_METHODS, AUTH_PERMISSIONS, AUTH_ROLES } from '../../auth/principal.js'

export const AuthStatusSchema = z
  .object({
    setupComplete: z.boolean(),
    authenticated: z.boolean(),
    subject: z.string(),
    role: z.enum(AUTH_ROLES),
    authMethod: z.enum(AUTH_METHODS),
    permissions: z.array(z.enum(AUTH_PERMISSIONS)),
    publicDemo: z.boolean().openapi({
      deprecated: true,
      description:
        'Compatibility field. Always false; public demos are isolated deployments, not an authentication mode.',
    }),
  })
  .openapi('AuthStatus')
export const PasswordSchema = z.object({ password: z.string().min(8) }).openapi('PasswordRequest')
export const ChangePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
  .openapi('ChangePasswordRequest')
export const AuthSuccessSchema = z.object({ success: z.literal(true) }).openapi('AuthSuccess')
