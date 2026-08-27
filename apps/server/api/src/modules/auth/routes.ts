import { createRoute, type OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { SESSION_COOKIE } from '../../app/auth-session.js'
import type { AppServices } from '../../app/services.js'
import { ANONYMOUS_PRINCIPAL, hasPermission, permissionsForRole } from '../../auth/principal.js'
import { isWebSetupEnabled } from '../../auth-config.js'
import { badRequestResponse, createOpenAPIApp, ErrorSchema } from '../../openapi/common.js'
import {
  AuthStatusSchema,
  AuthSuccessSchema,
  ChangePasswordSchema,
  PasswordSchema,
} from './schemas.js'

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60
const successResponse = {
  description: 'Operation completed',
  content: { 'application/json': { schema: AuthSuccessSchema } },
} as const

const statusRoute = createRoute({
  method: 'get',
  path: '/status',
  tags: ['Authentication'],
  summary: 'Get authentication status',
  responses: {
    200: {
      description: 'Authentication state',
      content: { 'application/json': { schema: AuthStatusSchema } },
    },
  },
})
const setupRoute = createRoute({
  method: 'post',
  path: '/setup',
  tags: ['Authentication'],
  summary: 'Configure the initial administrator password',
  request: {
    body: { required: true, content: { 'application/json': { schema: PasswordSchema } } },
  },
  responses: {
    200: successResponse,
    400: badRequestResponse,
    403: {
      description: 'Browser-driven setup is disabled',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Authentication'],
  summary: 'Create an administrator session',
  request: {
    body: { required: true, content: { 'application/json': { schema: PasswordSchema } } },
  },
  responses: {
    200: successResponse,
    400: badRequestResponse,
    401: {
      description: 'The password is invalid',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    429: {
      description: 'Too many login attempts',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})
const changePasswordRoute = createRoute({
  method: 'post',
  path: '/change-password',
  tags: ['Authentication'],
  summary: 'Change the administrator password',
  security: [{ sessionCookie: [] }],
  request: {
    body: { required: true, content: { 'application/json': { schema: ChangePasswordSchema } } },
  },
  responses: {
    200: successResponse,
    400: badRequestResponse,
    401: {
      description: 'Authentication or current password is invalid',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})
const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Authentication'],
  summary: 'End the current administrator session',
  responses: { 200: successResponse },
})

function clientIp(c: Context): string {
  if (process.env['SHUMOKU_TRUST_PROXY'] !== 'true') return 'global'
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? '0.0.0.0'
  )
}

function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env['SHUMOKU_SECURE_COOKIES'] === 'true' || c.req.url.startsWith('https'),
  })
}

export function createAuthApi(services: Pick<AppServices, 'auth'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.auth

  app.openapi(statusRoute, (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    const setupComplete = service.isSetupComplete()
    const sessionPrincipal = token === undefined ? null : service.getSessionPrincipal(token)
    const principal = sessionPrincipal ?? ANONYMOUS_PRINCIPAL
    return c.json(
      {
        setupComplete,
        authenticated: sessionPrincipal !== null,
        subject: principal.subject,
        role: principal.role,
        authMethod: principal.authMethod,
        permissions: [...permissionsForRole(principal.role)],
        publicDemo: false,
      },
      200,
    )
  })
  app.openapi(setupRoute, async (c) => {
    if (!isWebSetupEnabled()) {
      return c.json(
        { error: 'Browser-driven setup is disabled; configure an administrator Secret' },
        403,
      )
    }
    if (!(await service.setInitialPassword(c.req.valid('json').password))) {
      return c.json({ error: 'Setup already completed' }, 400)
    }
    setSessionCookie(c, service.createSession())
    return c.json({ success: true as const }, 200)
  })
  app.openapi(loginRoute, async (c) => {
    if (!service.isSetupComplete()) return c.json({ error: 'Setup not completed' }, 400)
    const id = clientIp(c)
    const lockoutSeconds = service.checkRateLimit(id)
    if (lockoutSeconds > 0) {
      return c.json({ error: `Too many attempts. Try again in ${lockoutSeconds} seconds.` }, 429)
    }
    if (!(await service.verifyPassword(c.req.valid('json').password))) {
      service.recordFailedAttempt(id)
      return c.json({ error: 'Invalid password' }, 401)
    }
    service.clearAttempts(id)
    setSessionCookie(c, service.createSession())
    return c.json({ success: true as const }, 200)
  })
  app.openapi(changePasswordRoute, async (c) => {
    if (!service.isSetupComplete()) return c.json({ error: 'Setup not completed' }, 400)
    const token = getCookie(c, SESSION_COOKIE)
    const principal = token ? service.getSessionPrincipal(token) : null
    if (!principal || !hasPermission(principal, 'admin:manage')) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    const body = c.req.valid('json')
    if (!(await service.verifyPassword(body.currentPassword))) {
      return c.json({ error: 'Current password is incorrect' }, 401)
    }
    await service.setPassword(body.newPassword)
    service.deleteAllSessions()
    setSessionCookie(c, service.createSession())
    return c.json({ success: true as const }, 200)
  })
  app.openapi(logoutRoute, (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) service.deleteSession(token)
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ success: true as const }, 200)
  })
  return app
}
