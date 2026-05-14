/**
 * Aruba Instant On API client — holds the bearer token and adds the headers
 * the portal expects on every call. Handles transparent re-auth on token
 * expiry / 401.
 */

import { type AccessToken, obtainAccessToken } from './auth.js'
import type { ArubaInstantOnConfig } from './types.js'

const API_BASE = 'https://nb.portal.arubainstanton.com/api'

/** Required by the portal — version bumps would be the canary for a breaking change. */
const API_VERSION_HEADER = '7'

export class ArubaInstantOnApi {
  private token: AccessToken | null = null
  private pendingAuth: Promise<AccessToken> | null = null

  constructor(private readonly config: ArubaInstantOnConfig) {}

  /**
   * GET <path> (path starts with `/api/...` semantics; we prepend the host).
   * Re-auths once if the upstream rejects the token.
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  /**
   * Raw passthrough used by the dev-mode native API endpoint. `method` is the
   * HTTP method; `params` carries either a `path` query (for GET) or whatever
   * the developer wants to slot into a body. Keep this thin — it's debug.
   */
  async nativeApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    const path = typeof params['path'] === 'string' ? (params['path'] as string) : '/sites/'
    return this.request<unknown>(method, path, params['body'])
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
    const send = async (token: string): Promise<Response> => {
      const init: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-ion-api-version': API_VERSION_HEADER,
          'Content-Type': 'application/json',
        },
      }
      if (body !== undefined && method !== 'GET') {
        init.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
      return fetch(url, init)
    }

    let { token } = await this.ensureToken()
    let resp = await send(token)
    if (resp.status === 401) {
      // Token may have been revoked or expired earlier than we tracked.
      this.token = null
      ;({ token } = await this.ensureToken())
      resp = await send(token)
    }
    if (!resp.ok) {
      throw new Error(`Aruba Instant On API ${method} ${path} → HTTP ${resp.status}`)
    }
    if (resp.status === 204) {
      return undefined as T
    }
    return (await resp.json()) as T
  }

  /**
   * Obtain a non-expired token. Concurrent callers share one in-flight auth
   * so we don't fire several parallel `obtainAccessToken` flows when the
   * plugin's metrics poll, alerts fetch, etc. all hit at once.
   */
  private async ensureToken(): Promise<AccessToken> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token
    if (!this.pendingAuth) {
      this.pendingAuth = obtainAccessToken({
        username: this.config.username,
        password: this.config.password,
      }).finally(() => {
        this.pendingAuth = null
      })
    }
    this.token = await this.pendingAuth
    return this.token
  }
}
