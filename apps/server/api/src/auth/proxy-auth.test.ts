import { describe, expect, it } from 'vitest'
import { getProxyAuthConfig, resolveProxyPrincipal } from './proxy-auth.js'

const ENABLED = { SHUMOKU_PROXY_AUTH_ENABLED: 'true' } as const

function headers(init: Record<string, string>): Headers {
  return new Headers(init)
}

describe('getProxyAuthConfig', () => {
  it('is disabled by default', () => {
    expect(getProxyAuthConfig({}).enabled).toBe(false)
  })

  it('uses oauth2-proxy header defaults', () => {
    const config = getProxyAuthConfig(ENABLED)
    expect(config.userHeader).toBe('x-auth-request-user')
    expect(config.emailHeader).toBe('x-auth-request-email')
    expect(config.defaultRole).toBe('admin')
    expect(config.roleHeader).toBeNull()
  })

  it('normalizes custom header names to lower case', () => {
    const config = getProxyAuthConfig({
      ...ENABLED,
      SHUMOKU_PROXY_AUTH_USER_HEADER: 'X-Forwarded-User',
      SHUMOKU_PROXY_AUTH_ROLE_HEADER: 'X-Forwarded-Groups',
    })
    expect(config.userHeader).toBe('x-forwarded-user')
    expect(config.roleHeader).toBe('x-forwarded-groups')
  })

  it('parses a role map', () => {
    const config = getProxyAuthConfig({
      ...ENABLED,
      SHUMOKU_PROXY_AUTH_ROLE_MAP: 'net-admins:admin, viewers:viewer',
    })
    expect(config.roleMap.get('net-admins')).toBe('admin')
    expect(config.roleMap.get('viewers')).toBe('viewer')
  })

  it('rejects an invalid default role', () => {
    expect(() =>
      getProxyAuthConfig({ ...ENABLED, SHUMOKU_PROXY_AUTH_DEFAULT_ROLE: 'root' }),
    ).toThrow('SHUMOKU_PROXY_AUTH_DEFAULT_ROLE')
  })

  it('rejects anonymous as an assignable role', () => {
    expect(() =>
      getProxyAuthConfig({ ...ENABLED, SHUMOKU_PROXY_AUTH_DEFAULT_ROLE: 'anonymous' }),
    ).toThrow('SHUMOKU_PROXY_AUTH_DEFAULT_ROLE')
  })

  it('rejects an invalid role in the role map', () => {
    expect(() =>
      getProxyAuthConfig({ ...ENABLED, SHUMOKU_PROXY_AUTH_ROLE_MAP: 'group:superuser' }),
    ).toThrow('SHUMOKU_PROXY_AUTH_ROLE_MAP')
  })
})

describe('resolveProxyPrincipal', () => {
  it('returns null when disabled, even with identity headers present', () => {
    expect(resolveProxyPrincipal(headers({ 'x-auth-request-user': 'alice' }), {})).toBeNull()
  })

  it('returns null when enabled but no identity header is present', () => {
    expect(resolveProxyPrincipal(headers({}), ENABLED)).toBeNull()
  })

  it('builds an admin principal from the user header by default', () => {
    const principal = resolveProxyPrincipal(headers({ 'x-auth-request-user': 'alice' }), ENABLED)
    expect(principal).toEqual({ subject: 'alice', role: 'admin', authMethod: 'proxy' })
  })

  it('falls back to the email header for the subject', () => {
    const principal = resolveProxyPrincipal(
      headers({ 'x-auth-request-email': 'alice@example.com' }),
      ENABLED,
    )
    expect(principal?.subject).toBe('alice@example.com')
  })

  it('applies the configured default role', () => {
    const principal = resolveProxyPrincipal(headers({ 'x-auth-request-user': 'bob' }), {
      ...ENABLED,
      SHUMOKU_PROXY_AUTH_DEFAULT_ROLE: 'viewer',
    })
    expect(principal?.role).toBe('viewer')
  })

  it('maps a group from the role header via the role map', () => {
    const principal = resolveProxyPrincipal(
      headers({ 'x-auth-request-user': 'carol', 'x-auth-request-groups': 'staff,net-admins' }),
      {
        ...ENABLED,
        SHUMOKU_PROXY_AUTH_ROLE_HEADER: 'x-auth-request-groups',
        SHUMOKU_PROXY_AUTH_ROLE_MAP: 'net-admins:admin',
      },
    )
    expect(principal?.role).toBe('admin')
  })

  it('accepts a role name directly from the header when no map is set', () => {
    const principal = resolveProxyPrincipal(
      headers({ 'x-auth-request-user': 'dave', 'x-auth-request-groups': 'viewer' }),
      { ...ENABLED, SHUMOKU_PROXY_AUTH_ROLE_HEADER: 'x-auth-request-groups' },
    )
    expect(principal?.role).toBe('viewer')
  })

  it('uses the default role when the role header has no recognized value', () => {
    const principal = resolveProxyPrincipal(
      headers({ 'x-auth-request-user': 'erin', 'x-auth-request-groups': 'unknown-group' }),
      {
        ...ENABLED,
        SHUMOKU_PROXY_AUTH_ROLE_HEADER: 'x-auth-request-groups',
        SHUMOKU_PROXY_AUTH_ROLE_MAP: 'net-admins:admin',
      },
    )
    expect(principal?.role).toBe('admin')
  })

  it('honors a custom user header name', () => {
    const principal = resolveProxyPrincipal(headers({ 'x-forwarded-user': 'frank' }), {
      ...ENABLED,
      SHUMOKU_PROXY_AUTH_USER_HEADER: 'X-Forwarded-User',
    })
    expect(principal?.subject).toBe('frank')
  })
})
