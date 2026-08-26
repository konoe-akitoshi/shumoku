import type { AuthPermission, AuthPrincipal } from './principal.js'
import { hasPermission } from './principal.js'

const PUBLIC_DEMO_READS = [
  /^\/api\/topologies$/,
  /^\/api\/topologies\/[^/]+$/,
  /^\/api\/topologies\/[^/]+\/(?:graph|view|render|context)$/,
  /^\/api\/dashboards$/,
  /^\/api\/dashboards\/[^/]+$/,
  /^\/api\/datasources$/,
  /^\/api\/datasources\/by-capability\/alerts$/,
  /^\/api\/datasources\/[^/]+\/alerts$/,
  /^\/api\/system$/,
] as const

const ADMIN_SURFACES = [
  /^\/api\/admin(?:\/|$)/,
  /^\/api\/datasources(?:\/|$)/,
  /^\/api\/plugins(?:\/|$)/,
  /^\/api\/settings(?:\/|$)/,
  /^\/api\/topologies\/[^/]+\/sources(?:\/|$)/,
]

export interface AuthorizationDecision {
  allowed: boolean
  projectPublicResponse: boolean
  requiredPermission: AuthPermission
}

export function isPublicDemoRead(method: string, pathname: string): boolean {
  return method === 'GET' && PUBLIC_DEMO_READS.some((pattern) => pattern.test(pathname))
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
  if (principal.role === 'viewer') {
    return {
      allowed: hasPermission(principal, 'public:read') && isPublicDemoRead(method, pathname),
      projectPublicResponse: true,
      requiredPermission: 'public:read',
    }
  }

  const permission = requiredPermission(method, pathname)
  return {
    allowed: hasPermission(principal, permission),
    projectPublicResponse: false,
    requiredPermission: permission,
  }
}
