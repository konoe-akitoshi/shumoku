// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtainAccessToken } from './auth.js'

interface CapturedPkce {
  verifier: string
  challenge: string
  challengeMethod: string
  state: string
}

/**
 * Stubs the four-step Aruba SSO dance and records the PKCE values that cross
 * the wire: `code_challenge`/`state` on the authorize URL, `code_verifier` in
 * the token exchange body.
 */
function stubArubaSso(): { captured: () => CapturedPkce } {
  let authorizeUrl: URL | undefined
  let tokenBody: URLSearchParams | undefined

  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/aio/api/v1/mfa/validate/full') {
      return Response.json({ access_token: 'session-token' })
    }
    if (url.pathname === '/settings.json') {
      return Response.json({ ssoClientIdAuthZ: 'client-id' })
    }
    if (url.pathname === '/as/authorization.oauth2') {
      authorizeUrl = url
      return new Response(null, {
        status: 302,
        headers: { location: 'https://portal.arubainstanton.com/?code=auth-code' },
      })
    }
    if (url.pathname === '/as/token.oauth2') {
      tokenBody = new URLSearchParams(String(init?.body))
      return Response.json({ access_token: 'access-token', expires_in: 3600 })
    }
    return new Response(null, { status: 404 })
  })

  return {
    captured: () => ({
      verifier: tokenBody?.get('code_verifier') ?? '',
      challenge: authorizeUrl?.searchParams.get('code_challenge') ?? '',
      challengeMethod: authorizeUrl?.searchParams.get('code_challenge_method') ?? '',
      state: authorizeUrl?.searchParams.get('state') ?? '',
    }),
  }
}

function base64UrlSha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

describe('obtainAccessToken PKCE', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends an S256 challenge that is base64url(sha256(verifier)) of the verifier it later redeems', async () => {
    const sso = stubArubaSso()

    const token = await obtainAccessToken({ username: 'user', password: 'pass' })

    expect(token.token).toBe('access-token')
    const { verifier, challenge, challengeMethod } = sso.captured()
    expect(challengeMethod).toBe('S256')
    expect(challenge).toBe(base64UrlSha256(verifier))
  })

  it('uses a 32-byte verifier and 16-byte state, base64url-encoded without padding', async () => {
    // Bytes whose standard base64 is all `+` and `/`, so the URL-safe mapping
    // is exercised on every run rather than only when randomness happens to.
    const pattern = [0xfb, 0xff, 0xbf]
    const fill = (length: number) => Uint8Array.from({ length }, (_, i) => pattern[i % 3] ?? 0)
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(
      <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) array.set(fill(array.length))
        return array
      },
    )
    const sso = stubArubaSso()

    await obtainAccessToken({ username: 'user', password: 'pass' })

    const { verifier, state } = sso.captured()
    expect(verifier).toBe(Buffer.from(fill(32)).toString('base64url'))
    expect(state).toBe(Buffer.from(fill(16)).toString('base64url'))
  })

  it('draws a fresh verifier and state on every run', async () => {
    const sso = stubArubaSso()

    await obtainAccessToken({ username: 'user', password: 'pass' })
    const first = sso.captured()
    await obtainAccessToken({ username: 'user', password: 'pass' })
    const second = sso.captured()

    expect(second.verifier).not.toBe(first.verifier)
    expect(second.state).not.toBe(first.state)
  })
})
