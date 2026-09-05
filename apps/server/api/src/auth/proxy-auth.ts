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
const DEFAULT_ROLE: AuthRole = 'admin'

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
    if (separator === -1) continue
    const key = pair.slice(0, separator).trim()
    const role = pair.slice(separator + 1).trim()
    if (!key || !role) continue
    map.set(key, parseAssignableRole(role, 'SHUMOKU_PROXY_AUTH_ROLE_MAP'))
  }
  return map
}

/** Read the proxy-auth configuration from the environment. */
export function getProxyAuthConfig(env: AuthEnvironment = process.env): ProxyAuthConfig {
  return {
    enabled: env['SHUMOKU_PROXY_AUTH_ENABLED'] === 'true',
    userHeader: normalizeHeaderName(env['SHUMOKU_PROXY_AUTH_USER_HEADER'], DEFAULT_USER_HEADER),
    emailHeader: normalizeHeaderName(env['SHUMOKU_PROXY_AUTH_EMAIL_HEADER'], DEFAULT_EMAIL_HEADER),
    roleHeader: env['SHUMOKU_PROXY_AUTH_ROLE_HEADER']?.trim().toLowerCase() || null,
    defaultRole: parseDefaultRole(env['SHUMOKU_PROXY_AUTH_DEFAULT_ROLE'], DEFAULT_ROLE),
    roleMap: parseRoleMap(env['SHUMOKU_PROXY_AUTH_ROLE_MAP']),
  }
}

function resolveRole(config: ProxyAuthConfig, headers: Headers): AuthRole {
  if (!config.roleHeader) return config.defaultRole
  const raw = headers.get(config.roleHeader)
  if (!raw) return config.defaultRole
  // The role header may carry several comma/space separated groups; the first
  // recognized value wins so precedence is deterministic.
  const candidates = raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
  for (const candidate of candidates) {
    const mapped = config.roleMap.get(candidate)
    if (mapped) return mapped
    // With no explicit map, accept a header value that already names a role.
    if (config.roleMap.size === 0 && isAuthRole(candidate) && candidate !== 'anonymous') {
      return candidate
    }
  }
  return config.defaultRole
}

/**
 * Build an authenticated principal from trusted proxy headers, or return null
 * when proxy auth is disabled or no identity header is present.
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

  return {
    subject,
    role: resolveRole(config, headers),
    authMethod: 'proxy',
  }
}
