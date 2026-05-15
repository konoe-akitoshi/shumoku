/**
 * Aruba Instant On authentication — OAuth2 + PKCE against the undocumented
 * portal API.
 *
 * **This is reverse-engineered**. Aruba's official position is that the API
 * does not exist; treat any failure as "the protocol may have changed
 * upstream" and re-verify the request shape rather than just patching the
 * error path.
 *
 * Flow summary:
 *   1. POST  sso/aio/api/v1/mfa/validate/full  (username+password)
 *      → JSON { access_token } — used below as the `sessionToken`.
 *   2. GET   portal/settings.json
 *      → JSON { ssoClientIdAuthZ } — the OAuth client_id.
 *   3. GET   sso/as/authorization.oauth2  (PKCE + sessionToken)
 *      → 302 Location: https://portal.arubainstanton.com/?code=...
 *        Manual redirect handling — we read Location, not follow.
 *   4. POST  sso/as/token.oauth2  (code + code_verifier)
 *      → JSON { access_token, expires_in }
 *
 * Security notes:
 *   - Credentials live only inside this module's call frames. No logging
 *     of username/password/tokens; failure messages never embed the body.
 *   - PKCE verifier uses 32 bytes of crypto-random, S256 challenge.
 *   - `redirect: 'manual'` so we don't auto-follow into the portal URL.
 *   - All endpoints are HTTPS, hardcoded — no operator-controlled base URL
 *     to repoint, so SSRF surface is limited to portal.arubainstanton.com /
 *     sso.arubainstanton.com.
 */

import { createHash, randomBytes } from 'node:crypto'

const SSO_BASE = 'https://sso.arubainstanton.com'
const PORTAL_BASE = 'https://portal.arubainstanton.com'

/** A live bearer token plus when we expect it to stop working. */
export interface AccessToken {
  token: string
  /** Epoch ms when the token should be assumed expired (~5min slack applied). */
  expiresAt: number
}

interface Credentials {
  username: string
  password: string
}

interface LoginResponse {
  access_token?: string
}

interface SettingsResponse {
  ssoClientIdAuthZ?: string
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
}

/**
 * Run the full PKCE auth dance and return an access token. Throws with a
 * scrubbed message on any step failure — never echoes the password back.
 */
export async function obtainAccessToken(creds: Credentials): Promise<AccessToken> {
  // 1. Login → sessionToken
  const sessionToken = await login(creds)

  // 2. Pull client_id from the portal's runtime settings
  const clientId = await fetchClientId()

  // 3. PKCE authorize → authorization code
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)
  const code = await authorize({ clientId, sessionToken, challenge })

  // 4. Token exchange
  const token = await exchangeCodeForToken({ clientId, code, verifier })

  return token
}

// ---------------------------------------------------------------------------
// Step implementations
// ---------------------------------------------------------------------------

async function login(creds: Credentials): Promise<string> {
  const body = new URLSearchParams({
    username: creds.username,
    password: creds.password,
  })
  const resp = await fetch(`${SSO_BASE}/aio/api/v1/mfa/validate/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) {
    throw new Error(`Aruba Instant On login failed: HTTP ${resp.status}`)
  }
  const json = (await resp.json()) as LoginResponse
  if (!json.access_token) {
    throw new Error(
      'Aruba Instant On login response missing access_token (account may have MFA enabled)',
    )
  }
  return json.access_token
}

async function fetchClientId(): Promise<string> {
  const resp = await fetch(`${PORTAL_BASE}/settings.json`)
  if (!resp.ok) {
    throw new Error(`Aruba Instant On settings.json fetch failed: HTTP ${resp.status}`)
  }
  const json = (await resp.json()) as SettingsResponse
  if (!json.ssoClientIdAuthZ) {
    throw new Error('Aruba Instant On settings.json missing ssoClientIdAuthZ')
  }
  return json.ssoClientIdAuthZ
}

interface AuthorizeArgs {
  clientId: string
  sessionToken: string
  challenge: string
}

async function authorize(args: AuthorizeArgs): Promise<string> {
  const url = new URL(`${SSO_BASE}/as/authorization.oauth2`)
  url.searchParams.set('client_id', args.clientId)
  url.searchParams.set('redirect_uri', PORTAL_BASE)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'profile openid')
  url.searchParams.set('state', generateState())
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', args.challenge)
  url.searchParams.set('sessionToken', args.sessionToken)

  // `manual` keeps us from chasing the redirect into the portal — we just
  // want the `code` query param off the Location header.
  const resp = await fetch(url, { redirect: 'manual' })
  if (resp.status !== 302 && resp.status !== 303 && resp.status !== 307) {
    throw new Error(`Aruba Instant On authorize returned non-redirect HTTP ${resp.status}`)
  }
  const loc = resp.headers.get('location')
  if (!loc) {
    throw new Error('Aruba Instant On authorize missing Location header')
  }
  const code = new URL(loc).searchParams.get('code')
  if (!code) {
    throw new Error('Aruba Instant On authorize redirect missing `code` parameter')
  }
  return code
}

interface ExchangeArgs {
  clientId: string
  code: string
  verifier: string
}

async function exchangeCodeForToken(args: ExchangeArgs): Promise<AccessToken> {
  const body = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: PORTAL_BASE,
    code: args.code,
    code_verifier: args.verifier,
    grant_type: 'authorization_code',
  })
  const resp = await fetch(`${SSO_BASE}/as/token.oauth2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!resp.ok) {
    throw new Error(`Aruba Instant On token exchange failed: HTTP ${resp.status}`)
  }
  const json = (await resp.json()) as TokenResponse
  if (!json.access_token) {
    throw new Error('Aruba Instant On token response missing access_token')
  }
  // Re-auth a bit before the upstream-stated expiry so a long-running poll
  // doesn't fire mid-request and surprise us with a 401.
  const ttlSec = json.expires_in ?? 3600
  const expiresAt = Date.now() + Math.max(ttlSec - 300, 60) * 1000
  return { token: json.access_token, expiresAt }
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  // 32 bytes ≈ 256 bits → ~43 base64url chars, well above RFC 7636's 43-min.
  return base64UrlEncode(randomBytes(32))
}

function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(createHash('sha256').update(verifier).digest())
}

function generateState(): string {
  return base64UrlEncode(randomBytes(16))
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
