/**
 * iMaster NCE-Campus NBI client.
 *
 * NCE-Campus authenticates with a session token: `POST /controller/v2/tokens`
 * with the third-party account's username/password returns a `token_id` that
 * every subsequent request sends in the `X-ACCESS-TOKEN` header. The expiry is
 * sliding (each use extends it), so we refresh on a conservative timer and
 * re-login transparently on 401.
 *
 * Transport rides the shared plugin-sdk `HttpClient` (timeouts, typed errors,
 * runtime-portable `insecure` TLS — on-prem controllers commonly serve
 * Huawei's self-signed platform cert). The base URL is operator-supplied
 * (typically `https://<controller>:18002`), so we require HTTPS and never log
 * the credentials.
 */

import { HttpClient, HttpError } from '@shumoku/plugin-sdk'
import type { HuaweiNceCampusConfig, NcePagedResponse, NceTokenResponse } from './types.js'

/** Re-login this long after obtaining a token (server default idle is longer). */
const TOKEN_TTL_MS = 20 * 60 * 1000

/** Page size for the v3 `pageIndex`/`pageSize` list endpoints. */
const PAGE_SIZE = 100

/** Upper bound on items fetched through paging, so a bad total can't spin. */
const MAX_ITEMS = 10_000

export class HuaweiNceCampusApi {
  private readonly http: HttpClient
  private token: string | null = null
  private tokenExpiresAt = 0
  private pendingAuth: Promise<string> | null = null

  constructor(private readonly config: HuaweiNceCampusConfig) {
    if (!/^https:\/\//i.test(config.baseUrl)) {
      throw new Error('Huawei NCE-Campus `baseUrl` must be an https:// URL')
    }
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      timeoutMs: 30_000,
      insecure: config.insecure ?? false,
      defaultHeaders: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
    })
  }

  /** GET a JSON resource, re-authenticating once if the token lapsed. */
  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', path, query)
  }

  /** POST a JSON body, re-authenticating once if the token lapsed. */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, undefined, body)
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

  private async request<T>(
    method: string,
    path: string,
    query?: Record<string, string | number | undefined>,
    body?: unknown,
  ): Promise<T> {
    const send = (token: string): Promise<T> =>
      this.http.json<T>(path, {
        method,
        query,
        headers: { 'X-ACCESS-TOKEN': token },
        ...(body !== undefined ? { body } : {}),
      })

    let token = await this.ensureToken()
    try {
      return await send(token)
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 401) {
        throw wrapError(err, method, path)
      }
      // Token idled out or was revoked — drop it and log in once more.
      this.token = null
      token = await this.ensureToken()
      try {
        return await send(token)
      } catch (retryErr) {
        throw wrapError(retryErr, method, path)
      }
    }
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
    let parsed: NceTokenResponse
    try {
      parsed = await this.http.json<NceTokenResponse>('/controller/v2/tokens', {
        method: 'POST',
        body: {
          userName: this.config.userName,
          password: this.config.password,
        },
      })
    } catch (err) {
      // Never echo the credentials back; the status is enough to diagnose.
      if (err instanceof HttpError) {
        throw new Error(`Huawei NCE-Campus token request failed: HTTP ${err.status}`)
      }
      throw new Error(
        `Huawei NCE-Campus token request failed: ${err instanceof Error ? err.message : 'network error'}`,
      )
    }
    const token = parsed.data?.token_id
    if (!token) {
      throw new Error(
        `Huawei NCE-Campus token request succeeded but returned no token_id (errcode ${parsed.errcode ?? '?'})`,
      )
    }
    return token
  }
}

/** Keep the familiar `<method> <path> → HTTP <status>` shape for callers/logs. */
function wrapError(err: unknown, method: string, path: string): Error {
  if (err instanceof HttpError) {
    return new Error(`Huawei NCE-Campus ${method} ${path} → HTTP ${err.status}`)
  }
  return err instanceof Error ? err : new Error(String(err))
}
