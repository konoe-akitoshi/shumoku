/**
 * Cross-site request forgery guard for `/api/*`.
 *
 * A browser sends some cross-origin writes (for example a `multipart/form-data`
 * POST) without a CORS preflight, and cookies still ride along when the page is
 * same-site (another port or subdomain) or the auth cookie is `SameSite=None`
 * (some auth proxies). So state-changing requests must prove they come from our
 * own origin:
 *
 * 1. Safe methods (GET / HEAD / OPTIONS) pass.
 * 2. `/api/webhooks/*` passes: it authenticates with a secret, not a cookie, and
 *    is called by other servers.
 * 3. With `Sec-Fetch-Site`, only `same-origin` and `none` (user-initiated) pass.
 * 4. Otherwise, with `Origin`, its host must equal the `Host` header — the same
 *    rule `/ws` uses. Plain-HTTP LAN origins get here, since browsers only send
 *    `Sec-Fetch-*` to potentially trustworthy origins.
 * 5. With neither header the caller is not a browser (browsers always send
 *    `Origin` on POST), e.g. curl or server-side rendering, so it passes.
 */

import type { MiddlewareHandler } from 'hono'
import { apiError } from '../openapi/common.js'

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])
const TRUSTED_FETCH_SITES: ReadonlySet<string> = new Set(['same-origin', 'none'])
const WEBHOOK_PATH_PREFIX = '/api/webhooks/'

/** Whether the request's `Origin` names the same host (and port) as its `Host` header. */
function originMatchesHost(req: Request): boolean {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * `/ws` bypasses Hono, so it checks the origin itself with the same comparison.
 * Unlike the API guard it lets a missing `Origin` through (non-browser clients).
 */
export function hasAllowedWebSocketOrigin(req: Request): boolean {
  return !req.headers.get('origin') || originMatchesHost(req)
}

function isTrustedSource(req: Request): boolean {
  const fetchSite = req.headers.get('sec-fetch-site')
  if (fetchSite !== null) return TRUSTED_FETCH_SITES.has(fetchSite)
  if (req.headers.has('origin')) return originMatchesHost(req)
  return true
}

export const csrfGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method) || c.req.path.startsWith(WEBHOOK_PATH_PREFIX)) {
    return next()
  }
  if (!isTrustedSource(c.req.raw)) {
    return apiError(c, 'Cross-origin request blocked', 403)
  }
  return next()
}
