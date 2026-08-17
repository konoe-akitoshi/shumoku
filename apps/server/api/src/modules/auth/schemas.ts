import { z } from '@hono/zod-openapi'

export const AuthStatusSchema = z
  .object({ setupComplete: z.boolean(), authenticated: z.boolean() })
  .openapi('AuthStatus')
export const PasswordSchema = z.object({ password: z.string().min(8) }).openapi('PasswordRequest')
export const ChangePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
  .openapi('ChangePasswordRequest')
export const AuthSuccessSchema = z.object({ success: z.literal(true) }).openapi('AuthSuccess')
