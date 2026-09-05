/**
 * Authentication Middleware
 * Protects management endpoints and keeps anonymous access token-scoped.
 *
 * Note: Auth routes (/api/auth/*) are mounted before this middleware
 * in the router, so they are never subject to this check.
 */

import type { Context, Next } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE } from '../app/auth-session.js'
import { authorizeRequest } from '../auth/access-policy.js'
import { type AuthPrincipal, DEV_AUTOMATION_PRINCIPAL } from '../auth/principal.js'
import { resolveProxyPrincipal } from '../auth/proxy-auth.js'
import { setRequestPrincipal } from '../auth/request-principal.js'
import { apiError, apiErrorPayload } from '../openapi/common.js'
import { getSessionPrincipal, isSetupComplete } from '../services/auth.js'

const DEV_API_TOKEN_PATTERN = /^[a-f0-9]{64}$/i
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', '[::1]'])

type AuthEnvironment = Record<string, string | undefined>

/**
 * Resolve the opt-in development API credential.
 *
 * The credential is deliberately ignored outside development. When enabled,
 * it is accepted only on a loopback-bound server so a bearer token is never
 * sent over plaintext LAN traffic.
 */
export function getDevApiToken(env: AuthEnvironment = process.env): string | null {
  if (env['NODE_ENV'] !== 'development') return null

  const token = env['SHUMOKU_DEV_API_TOKEN']?.trim()
  if (!token) return null

  if (!DEV_API_TOKEN_PATTERN.test(token)) {
    throw new Error('SHUMOKU_DEV_API_TOKEN must be a 64-character hexadecimal token')
  }

  const host = env['HOST'] ?? '0.0.0.0'
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error('SHUMOKU_DEV_API_TOKEN requires HOST=127.0.0.1 or HOST=::1')
  }

  return token
}

/** Fail fast during startup instead of discovering a bad dev credential on the first request. */
export function validateDevApiAuthConfiguration(env: AuthEnvironment = process.env): void {
  getDevApiToken(env)
}

async function continueAsPrincipal(
  c: Context,
  next: Next,
  principal: AuthPrincipal,
): Promise<void> {
  setRequestPrincipal(c.req.raw, principal)
  await next()
}

async function authorizeAndContinue(
  c: Context,
  next: Next,
  principal: AuthPrincipal,
): Promise<Response | undefined> {
  const pathname = new URL(c.req.url).pathname
  const decision = authorizeRequest(principal, c.req.method, pathname)
  if (!decision.allowed) {
    return apiError(c, `Permission required: ${decision.requiredPermission}`, 403)
  }

  await continueAsPrincipal(c, next, principal)
  return undefined
}

/**
 * Check if a request path + method is public (no auth needed)
 */
function isPublicRequest(method: string, pathname: string): boolean {
  // Health and runtime are always public
  if (pathname === '/api/health' || pathname === '/api/runtime.js') return true

  // Webhook endpoints are public (secret-based auth)
  if (method === 'POST' && pathname.startsWith('/api/webhooks/')) return true

  // Only GET requests can be public beyond this point
  if (method !== 'GET') return false

  // Public GET: token-scoped share endpoints only.
  // `/api/share/*` is mounted before this middleware (see openapi/router.ts), so it
  // never reaches here — anonymous read access to topology/dashboard/datasource
  // data is ONLY available through a share token, which gates and projects what
  // it exposes (see modules/share). The management
  // endpoints (/api/topologies/:id, /context, /render, /parsed,
  // /api/dashboards/:id, /api/datasources/:id/alerts) are intentionally NOT
  // public: exposing them un-projected let anyone who learned an id (e.g. from a
  // shared dashboard's layoutJson) read a topology's own shareToken, data-source
  // ids and host mappings, bypassing the share token's scoping entirely.

  return false
}

/**
 * Hono middleware that enforces authentication on protected routes
 */
export async function authMiddleware(c: Context, next: Next) {
  // Initial setup is handled by the public /api/auth routes. Management APIs
  // stay closed until an administrator password exists.
  if (!isSetupComplete()) {
    return apiError(c, 'Administrator setup required', 503)
  }

  const pathname = new URL(c.req.url).pathname
  const method = c.req.method

  // Allow public requests through
  if (isPublicRequest(method, pathname)) {
    await next()
    return
  }

  // Check session cookie
  const sessionToken = getCookie(c, SESSION_COOKIE)
  const sessionPrincipal = sessionToken ? getSessionPrincipal(sessionToken) : null
  if (sessionPrincipal) {
    return authorizeAndContinue(c, next, sessionPrincipal)
  }

  // Trusted reverse-proxy authentication (opt-in). Lets Shumoku sit behind an
  // external SSO/OIDC proxy (oauth2-proxy, Authelia, ...) that authenticates
  // the user and forwards their identity in a trusted header. Disabled unless
  // SHUMOKU_PROXY_AUTH_ENABLED=true — see auth/proxy-auth.ts for the security
  // contract (the proxy MUST overwrite these headers on every request).
  const proxyPrincipal = resolveProxyPrincipal(c.req.raw.headers)
  if (proxyPrincipal) {
    return authorizeAndContinue(c, next, proxyPrincipal)
  }

  // Development automation uses the standard Authorization: Bearer scheme.
  // Invoke Hono's official middleware only after the browser session check so
  // the existing UI authentication flow remains unchanged.
  const devApiToken = getDevApiToken()
  const authorization = c.req.header('authorization')
  if (devApiToken && authorization) {
    return bearerAuth({
      token: devApiToken,
      realm: 'shumoku-dev-api',
      noAuthenticationHeader: {
        message: (context) => apiErrorPayload(context, 'Authentication required', 401),
      },
      invalidAuthenticationHeader: {
        message: (context) => apiErrorPayload(context, 'Invalid authorization header', 400),
      },
      invalidToken: {
        message: (context) => apiErrorPayload(context, 'Invalid bearer token', 401),
      },
    })(c, () => continueAsPrincipal(c, next, DEV_AUTOMATION_PRINCIPAL))
  }

  if (devApiToken) {
    return bearerAuth({
      token: devApiToken,
      realm: 'shumoku-dev-api',
      noAuthenticationHeader: {
        message: (context) => apiErrorPayload(context, 'Authentication required', 401),
      },
      invalidAuthenticationHeader: {
        message: (context) => apiErrorPayload(context, 'Invalid authorization header', 400),
      },
      invalidToken: {
        message: (context) => apiErrorPayload(context, 'Invalid bearer token', 401),
      },
    })(c, next)
  }

  return apiError(c, 'Authentication required', 401)
}
