/**
 * Reverse-proxy (trusted header) authentication.
 *
 * Opt-in: this is OFF unless `SHUMOKU_PROXY_AUTH_ENABLED=true`. When enabled,
 * Shumoku trusts identity headers set by an authenticating reverse proxy placed
 * in front of it (for example oauth2-proxy, Authelia, or Pomerium). This lets
 * operators put Shumoku behind an existing SSO / OIDC provider without native
 * OIDC support in Shumoku itself.
 *
 * SECURITY: only enable this when Shumoku is reachable *exclusively* through a
 * proxy that overwrites these headers on every request. If clients can reach
 * Shumoku directly — or the proxy forwards a client-supplied copy of the header
 * — a request could spoof any identity. Enabling proxy auth delegates
 * authentication entirely to the proxy.
 */

import { type AuthPrincipal, type AuthRole, isAuthRole } from './principal.js'

type AuthEnvironment = Record<string, string | undefined>

// oauth2-proxy's `--set-xauthrequest=true` defaults. Header lookups are
// case-insensitive (Fetch `Headers`), so these are stored lower-cased.
const DEFAULT_USER_HEADER = 'x-auth-request-user'
const DEFAULT_EMAIL_HEADER = 'x-auth-request-email'
const DEFAULT_ROLE: AuthRole = 'viewer'

export interface ProxyAuthConfig {
  enabled: boolean
  userHeader: string
  emailHeader: string
  roleHeader: string | null
  defaultRole: AuthRole
  roleMap: ReadonlyMap<string, AuthRole>
}

function normalizeHeaderName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().toLowerCase()
  return trimmed ? trimmed : fallback
}

/** Roles a proxy may assign. `anonymous` is never a valid authenticated role. */
function parseAssignableRole(value: string, source: string): AuthRole {
  if (!isAuthRole(value) || value === 'anonymous') {
    throw new Error(`${source} must be one of: viewer, user, admin`)
  }
  return value
}

function parseDefaultRole(value: string | undefined, fallback: AuthRole): AuthRole {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  return parseAssignableRole(trimmed, 'SHUMOKU_PROXY_AUTH_DEFAULT_ROLE')
}

/** Parse `group:role,group:role` pairs mapping proxy-supplied groups to roles. */
function parseRoleMap(value: string | undefined): ReadonlyMap<string, AuthRole> {
  const map = new Map<string, AuthRole>()
  if (!value?.trim()) return map
  for (const pair of value.split(',')) {
    const separator = pair.lastIndexOf(':')
    if (separator === -1) throw new Error('SHUMOKU_PROXY_AUTH_ROLE_MAP requires group:role pairs')
    const key = pair.slice(0, separator).trim()
    const role = pair.slice(separator + 1).trim()
    if (!key || !role || map.has(key))
      throw new Error('SHUMOKU_PROXY_AUTH_ROLE_MAP requires unique nonempty groups and roles')
    map.set(key, parseAssignableRole(role, 'SHUMOKU_PROXY_AUTH_ROLE_MAP'))
  }
  return map
}

export function isProxyAuthEnabled(env: AuthEnvironment = process.env): boolean {
  return env['SHUMOKU_PROXY_AUTH_ENABLED'] === 'true'
}

/** Read the proxy-auth configuration from the environment. */
export function getProxyAuthConfig(env: AuthEnvironment = process.env): ProxyAuthConfig {
  if (!isProxyAuthEnabled(env)) {
    return {
      enabled: false,
      userHeader: DEFAULT_USER_HEADER,
      emailHeader: DEFAULT_EMAIL_HEADER,
      roleHeader: null,
      defaultRole: DEFAULT_ROLE,
      roleMap: new Map(),
    }
  }
  if (
    env['SHUMOKU_PROXY_AUTH_ROLE_MAP']?.trim() &&
    !env['SHUMOKU_PROXY_AUTH_ROLE_HEADER']?.trim()
  ) {
    throw new Error('SHUMOKU_PROXY_AUTH_ROLE_MAP requires SHUMOKU_PROXY_AUTH_ROLE_HEADER')
  }
  const names = [
    env['SHUMOKU_PROXY_AUTH_USER_HEADER'],
    env['SHUMOKU_PROXY_AUTH_EMAIL_HEADER'],
    env['SHUMOKU_PROXY_AUTH_ROLE_HEADER'],
  ]
  for (const name of names) {
    if (name?.trim()) new Headers().get(name.trim())
  }
  return {
    enabled: env['SHUMOKU_PROXY_AUTH_ENABLED'] === 'true',
    userHeader: normalizeHeaderName(env['SHUMOKU_PROXY_AUTH_USER_HEADER'], DEFAULT_USER_HEADER),
    emailHeader: normalizeHeaderName(env['SHUMOKU_PROXY_AUTH_EMAIL_HEADER'], DEFAULT_EMAIL_HEADER),
    roleHeader: env['SHUMOKU_PROXY_AUTH_ROLE_HEADER']?.trim().toLowerCase() || null,
    defaultRole: parseDefaultRole(env['SHUMOKU_PROXY_AUTH_DEFAULT_ROLE'], DEFAULT_ROLE),
    roleMap: parseRoleMap(env['SHUMOKU_PROXY_AUTH_ROLE_MAP']),
  }
}

function resolveRole(config: ProxyAuthConfig, headers: Headers): AuthRole | null {
  if (!config.roleHeader) return config.defaultRole
  const candidates = (headers.get(config.roleHeader) ?? '').split(/[,\s]+/).filter(Boolean)
  const roles = candidates.map((candidate) => {
    if (config.roleMap.size > 0) return config.roleMap.get(candidate)
    return isAuthRole(candidate) && candidate !== 'anonymous' ? candidate : undefined
  })
  // Highest explicitly granted role wins, independently of upstream group order.
  for (const role of ['admin', 'user', 'viewer'] as const) {
    if (roles.includes(role)) return role
  }
  return null
}

/**
 * Build an authenticated principal from trusted proxy headers, or return null
 * when proxy auth is disabled, identity is missing, or no role is granted.
 */
export function resolveProxyPrincipal(
  headers: Headers,
  env: AuthEnvironment = process.env,
): AuthPrincipal | null {
  const config = getProxyAuthConfig(env)
  if (!config.enabled) return null

  const subject =
    headers.get(config.userHeader)?.trim() || headers.get(config.emailHeader)?.trim() || ''
  if (!subject) return null

  const role = resolveRole(config, headers)
  if (!role) return null
  return {
    subject: `proxy:${subject}`,
    role,
    authMethod: 'proxy',
  }
}
