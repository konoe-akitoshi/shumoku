/**
 * iMaster NCE-Campus NBI client.
 *
 * NCE-Campus authenticates with a session token: `POST /controller/v2/tokens`
 * with the third-party account's username/password returns a `token_id` that
 * every subsequent request sends in the `X-ACCESS-TOKEN` header. The expiry is
 * sliding (each use extends it), so we refresh on a conservative timer and
 * re-login transparently on 401.
 *
 * The base URL is operator-supplied (typically `https://<controller>:18002`),
 * so we require HTTPS and never log the credentials.
 */

import type { HuaweiNceCampusConfig, NcePagedResponse, NceTokenResponse } from './types.js'

/** Re-login this long after obtaining a token (server default idle is longer). */
const TOKEN_TTL_MS = 20 * 60 * 1000

/** Page size for the v3 `pageIndex`/`pageSize` list endpoints. */
const PAGE_SIZE = 100

/** Upper bound on items fetched through paging, so a bad total can't spin. */
const MAX_ITEMS = 10_000

export class HuaweiNceCampusApi {
  private token: string | null = null
  private tokenExpiresAt = 0
  private pendingAuth: Promise<string> | null = null

  constructor(private readonly config: HuaweiNceCampusConfig) {
    if (!/^https:\/\//i.test(config.baseUrl)) {
      throw new Error('Huawei NCE-Campus `baseUrl` must be an https:// URL')
    }
  }

  /** GET a JSON resource, re-authenticating once if the token lapsed. */
  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', withQuery(path, query))
  }

  /** POST a JSON body, re-authenticating once if the token lapsed. */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  /**
   * Follow the v3 `pageIndex`/`pageSize` paging to exhaustion, concatenating
   * `data` across pages. `pageIndex` is 1-based; the envelope's `totalRecords`
   * bounds the walk, with a hard item cap as a backstop.
   */
  async getPaged<T>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T[]> {
    const out: T[] = []
    let pageIndex = 1
    while (out.length < MAX_ITEMS) {
      const page = await this.get<NcePagedResponse<T>>(path, {
        ...query,
        pageIndex,
        pageSize: PAGE_SIZE,
      })
      const items = page.data ?? []
      out.push(...items)
      const total = page.totalRecords ?? out.length
      if (items.length < PAGE_SIZE || out.length >= total) break
      pageIndex += 1
    }
    return out.slice(0, MAX_ITEMS)
  }

  // ------------------------------------------------------------------

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const send = async (token: string): Promise<Response> => {
      const init: RequestInit = {
        method,
        headers: {
          'X-ACCESS-TOKEN': token,
          Accept: 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
        },
      }
      if (body !== undefined && method !== 'GET') {
        init.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
      return fetch(url, init)
    }

    let token = await this.ensureToken()
    let resp = await send(token)
    if (resp.status === 401) {
      // Token idled out or was revoked — drop it and log in once more.
      this.token = null
      token = await this.ensureToken()
      resp = await send(token)
    }
    if (!resp.ok) {
      throw new Error(`Huawei NCE-Campus ${method} ${path} → HTTP ${resp.status}`)
    }
    if (resp.status === 204) return undefined as T
    return (await resp.json()) as T
  }

  /** Return a live token, deduping concurrent logins. */
  private async ensureToken(): Promise<string> {
    if (this.token && this.tokenExpiresAt > Date.now()) return this.token
    if (!this.pendingAuth) {
      this.pendingAuth = this.login().finally(() => {
        this.pendingAuth = null
      })
    }
    this.token = await this.pendingAuth
    this.tokenExpiresAt = Date.now() + TOKEN_TTL_MS
    return this.token
  }

  /** POST the credentials and capture the `token_id`. */
  private async login(): Promise<string> {
    const resp = await fetch(`${this.config.baseUrl}/controller/v2/tokens`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({
        userName: this.config.userName,
        password: this.config.password,
      }),
    })
    if (!resp.ok) {
      // Never echo the credentials back; the status is enough to diagnose.
      throw new Error(`Huawei NCE-Campus token request failed: HTTP ${resp.status}`)
    }
    const parsed = (await resp.json()) as NceTokenResponse
    const token = parsed.data?.token_id
    if (!token) {
      throw new Error(
        `Huawei NCE-Campus token request succeeded but returned no token_id (errcode ${parsed.errcode ?? '?'})`,
      )
    }
    return token
  }
}

function withQuery(path: string, query?: Record<string, string | number | undefined>): string {
  if (!query) return path
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  if (!qs) return path
  return `${path}${path.includes('?') ? '&' : '?'}${qs}`
}
