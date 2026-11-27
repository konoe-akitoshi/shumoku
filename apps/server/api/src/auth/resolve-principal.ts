import { parse } from 'hono/utils/cookie'
import { SESSION_COOKIE } from '../app/auth-session.js'
import { hasAllowedWebSocketOrigin } from '../middleware/csrf.js'
import { type AuthPrincipal, hasPermission } from './principal.js'
import { isProxyAuthEnabled, resolveProxyPrincipal } from './proxy-auth.js'

type SessionLookup = (token: string) => AuthPrincipal | null
type ApiTokenLookup = (secret: string) => AuthPrincipal | null

/** Every API token starts with this, so it is never mistaken for another Bearer credential. */
export const API_TOKEN_PREFIX = 'shmk_'

/** The credential of an `Authorization: Bearer <credential>` header, or null. */
export function bearerCredential(authorization: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '')
  return match?.[1] ?? null
}

/**
 * The API token a request presents: null when it presents none, `'invalid'` when the token
 * is unknown, revoked or expired. Valid in every auth mode, proxy included: it trusts no
 * header the proxy sets.
 */
export function resolveApiTokenPrincipal(
  request: Request,
  lookup: ApiTokenLookup,
): AuthPrincipal | 'invalid' | null {
  const credential = bearerCredential(request.headers.get('authorization'))
  if (!credential?.startsWith(API_TOKEN_PREFIX)) return null
  return lookup(credential) ?? 'invalid'
}

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
