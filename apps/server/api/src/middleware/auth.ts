/**
 * Authentication Middleware
 * Protects management endpoints, allows public read access
 *
 * Note: Auth routes (/api/auth/*) are mounted before this middleware
 * in the router, so they are never subject to this check.
 */

import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { isSetupComplete, SESSION_COOKIE, validateSession } from '../services/auth.js'

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
  // `/api/share/*` is mounted before this middleware (see api/index.ts), so it
  // never reaches here — anonymous read access to topology/dashboard/datasource
  // data is ONLY available through a share token, which gates and projects what
  // it exposes (see api/share.ts + share-projections.ts). The management
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
  // If password not set yet, allow everything (setup not complete)
  if (!isSetupComplete()) {
    await next()
    return
  }

  const pathname = new URL(c.req.url).pathname
  const method = c.req.method

  // Allow public requests through
  if (isPublicRequest(method, pathname)) {
    await next()
    return
  }

  // Check session cookie
  const token = getCookie(c, SESSION_COOKIE)
  if (!token || !validateSession(token)) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  await next()
  return
}
