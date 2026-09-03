import type { AuthPermission, AuthPrincipal } from './principal.js'
import { hasPermission } from './principal.js'

const ADMIN_SURFACES = [
  /^\/api\/admin(?:\/|$)/,
  /^\/api\/datasources(?:\/|$)/,
  /^\/api\/plugins(?:\/|$)/,
  /^\/api\/settings(?:\/|$)/,
  /^\/api\/topologies\/[^/]+\/sources(?:\/|$)/,
]

export interface AuthorizationDecision {
  allowed: boolean
  requiredPermission: AuthPermission
}

export function requiredPermission(method: string, pathname: string): AuthPermission {
  if (ADMIN_SURFACES.some((pattern) => pattern.test(pathname))) return 'admin:manage'
  return method === 'GET' || method === 'HEAD' ? 'workspace:read' : 'workspace:write'
}

/** One policy for HTTP and future user-backed sessions. */
export function authorizeRequest(
  principal: AuthPrincipal,
  method: string,
  pathname: string,
): AuthorizationDecision {
  const permission = requiredPermission(method, pathname)
  return {
    allowed: hasPermission(principal, permission),
    requiredPermission: permission,
  }
}
