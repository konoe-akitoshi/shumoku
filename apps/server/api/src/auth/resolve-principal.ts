import { parse } from 'hono/utils/cookie'
import { SESSION_COOKIE } from '../app/auth-session.js'
import { hasAllowedWebSocketOrigin } from '../middleware/csrf.js'
import { type AuthPrincipal, hasPermission } from './principal.js'
import { isProxyAuthEnabled, resolveProxyPrincipal } from './proxy-auth.js'

type SessionLookup = (token: string) => AuthPrincipal | null

/** Proxy mode is exclusive: stale local cookies cannot override IdP authorization. */
export function resolveRequestPrincipal(
  request: Request,
  lookup: SessionLookup,
): AuthPrincipal | null {
  if (isProxyAuthEnabled()) return resolveProxyPrincipal(request.headers)
  const token = parse(request.headers.get('cookie') ?? '')[SESSION_COOKIE]
  return token ? lookup(token) : null
}

export function resolveWebSocketPrincipal(
  request: Request,
  lookup: SessionLookup,
  setupComplete: boolean,
): AuthPrincipal | null {
  if (!setupComplete) return null
  const principal = resolveRequestPrincipal(request, lookup)
  return principal && hasPermission(principal, 'workspace:read') ? principal : null
}

/**
 * `/ws` bypasses Hono, and with it the CSRF guard and authMiddleware, so the
 * upgrade checks both itself: a page on another origin must not open a socket
 * on the viewer's session cookie. Returns the principal to attach to the
 * socket, or the response that refuses the upgrade.
 */
export function admitWebSocketUpgrade(
  request: Request,
  lookup: SessionLookup,
  setupComplete: boolean,
): AuthPrincipal | Response {
  if (!hasAllowedWebSocketOrigin(request)) {
    return new Response('Forbidden origin', { status: 403 })
  }
  return (
    resolveWebSocketPrincipal(request, lookup, setupComplete) ??
    new Response('Unauthorized', { status: 401 })
  )
}
