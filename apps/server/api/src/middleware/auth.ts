/**
 * Authentication Middleware
 * Protects management endpoints, allows public read access
 *
 * Note: Auth routes (/api/auth/*) are mounted before this middleware
 * in the router, so they are never subject to this check.
 */

import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { SESSION_COOKIE, isSetupComplete, validateSession } from '../services/auth.js'

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

  // Public GET: individual dashboard viewing
  // Match /api/dashboards/:id but NOT /api/dashboards (list)
  if (/^\/api\/dashboards\/[^/]+$/.test(pathname)) return true

  // Public GET: topology view endpoints
  // Match /api/topologies/:id (single topology) and /api/topologies/:id/(context|render|alerts|parsed)
  if (/^\/api\/topologies\/[^/]+$/.test(pathname)) return true
  if (/^\/api\/topologies\/[^/]+\/(context|render|alerts|parsed)/.test(pathname)) return true

  // Public GET: data source alerts (for dashboard widgets)
  if (/^\/api\/datasources\/[^/]+\/alerts$/.test(pathname)) return true

  return false
}

/**
 * Hono middleware that enforces authentication on protected routes
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  // If password not set yet, allow everything (setup not complete)
  if (!isSetupComplete()) {
    return next()
  }

  const pathname = new URL(c.req.url).pathname
  const method = c.req.method

  // Allow public requests through
  if (isPublicRequest(method, pathname)) {
    return next()
  }

  // Check session cookie
  const token = getCookie(c, SESSION_COOKIE)
  if (!token || !validateSession(token)) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  return next()
}
