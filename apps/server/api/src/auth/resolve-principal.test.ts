import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCAL_ADMIN_PRINCIPAL } from './principal.js'
import { getProxyAuthConfig } from './proxy-auth.js'
import {
  admitWebSocketUpgrade,
  resolveRequestPrincipal,
  resolveWebSocketPrincipal,
} from './resolve-principal.js'

describe('shared authentication resolution', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('ignores an administrator cookie in proxy mode, including on WebSocket upgrades', () => {
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ENABLED', 'true')
    const lookup = vi.fn(() => LOCAL_ADMIN_PRINCIPAL)
    const request = new Request('http://localhost/ws', {
      headers: {
        cookie: 'shumoku_session=admin',
        'x-auth-request-user': 'alice',
      },
    })
    expect(resolveRequestPrincipal(request, lookup)).toEqual({
      subject: 'proxy:alice',
      role: 'viewer',
      authMethod: 'proxy',
    })
    expect(resolveWebSocketPrincipal(request, lookup, true)).toEqual(
      resolveRequestPrincipal(request, lookup),
    )
    expect(lookup).not.toHaveBeenCalled()
    expect(resolveWebSocketPrincipal(request, lookup, false)).toBeNull()
  })

  it('never falls back to cookies for missing identity or unmapped groups', () => {
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ENABLED', 'true')
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ROLE_HEADER', 'x-groups')
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ROLE_MAP', 'operators:admin')
    const lookup = vi.fn(() => LOCAL_ADMIN_PRINCIPAL)
    for (const identity of ['', 'alice']) {
      const request = new Request('http://localhost/ws', {
        headers: {
          cookie: 'shumoku_session=admin',
          'x-auth-request-user': identity,
          'x-groups': 'unknown',
        },
      })
      expect(resolveRequestPrincipal(request, lookup)).toBeNull()
      expect(resolveWebSocketPrincipal(request, lookup, true)).toBeNull()
    }
    expect(lookup).not.toHaveBeenCalled()
  })

  it('uses the highest mapped role independently of group order', () => {
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ENABLED', 'true')
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ROLE_HEADER', 'x-groups')
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ROLE_MAP', 'readers:viewer,operators:admin')
    for (const groups of ['readers,operators', 'operators readers']) {
      const request = new Request('http://localhost/api', {
        headers: {
          'x-auth-request-user': 'alice',
          'x-groups': groups,
        },
      })
      expect(resolveRequestPrincipal(request, () => null)?.role).toBe('admin')
    }
  })

  it('restores local authentication when disabled even with invalid leftover settings', () => {
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ENABLED', 'false')
    vi.stubEnv('SHUMOKU_PROXY_AUTH_DEFAULT_ROLE', 'root')
    vi.stubEnv('SHUMOKU_PROXY_AUTH_ROLE_MAP', 'invalid')
    const request = new Request('http://localhost/ws', {
      headers: { cookie: 'shumoku_session=admin' },
    })
    expect(resolveRequestPrincipal(request, () => LOCAL_ADMIN_PRINCIPAL)).toEqual(
      LOCAL_ADMIN_PRINCIPAL,
    )
  })

  it('fails startup validation for malformed role maps and headers', () => {
    for (const map of ['invalid', ':admin', 'group:', 'group:admin,group:viewer']) {
      expect(() =>
        getProxyAuthConfig({
          SHUMOKU_PROXY_AUTH_ENABLED: 'true',
          SHUMOKU_PROXY_AUTH_ROLE_HEADER: 'x-groups',
          SHUMOKU_PROXY_AUTH_ROLE_MAP: map,
        }),
      ).toThrow()
    }
    expect(() =>
      getProxyAuthConfig({
        SHUMOKU_PROXY_AUTH_ENABLED: 'true',
        SHUMOKU_PROXY_AUTH_USER_HEADER: 'invalid header',
      }),
    ).toThrow()
  })
})

describe('admitWebSocketUpgrade', () => {
  const upgrade = (origin: string) =>
    new Request('http://shumoku.example:8080/ws', {
      headers: { host: 'shumoku.example:8080', origin, cookie: 'shumoku_session=admin' },
    })

  // A page on another origin could otherwise open the socket on the viewer's
  // session cookie and read every topology's live metrics.
  it('refuses an upgrade from another origin even with a valid session', async () => {
    const response = admitWebSocketUpgrade(
      upgrade('http://attacker.example'),
      () => LOCAL_ADMIN_PRINCIPAL,
      true,
    )

    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(403)
    await expect((response as Response).text()).resolves.toBe('Forbidden origin')
  })

  it('admits an upgrade from its own origin with the session principal', () => {
    expect(
      admitWebSocketUpgrade(
        upgrade('http://shumoku.example:8080'),
        () => LOCAL_ADMIN_PRINCIPAL,
        true,
      ),
    ).toEqual(LOCAL_ADMIN_PRINCIPAL)
  })
})
