/**
 * CV-CUE Open API client.
 *
 * CV-CUE authenticates by **session**, not bearer: `POST /session` with the
 * API key credentials returns a `JSESSIONID` cookie that every subsequent
 * request must send back (plus a `Version` header). The session idles out
 * after ~1h, so we re-login transparently on 401 and refresh a bit early.
 *
 * The base URL is operator-supplied (CV-CUE is a documented, multi-tenant
 * product with per-tenant hosts), so we require HTTPS and never log the key.
 */

import type { AristaCvCueConfig, CvSessionResponse } from './types.js'

/** CV-CUE serves the latest version of each module when asked for `latest`. */
const VERSION_HEADER = 'latest'

/** Refresh the session a little before the server's ~1h idle timeout. */
const SESSION_TTL_MS = 50 * 60 * 1000

export class AristaCvCueApi {
  private cookie: string | null = null
  private sessionExpiresAt = 0
  private pendingAuth: Promise<string> | null = null

  constructor(private readonly config: AristaCvCueConfig) {
    if (!/^https:\/\//i.test(config.baseUrl)) {
      throw new Error('Arista CV-CUE `baseUrl` must be an https:// URL')
    }
  }

  /** GET a JSON resource, re-authenticating once if the session lapsed. */
  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', this.withQuery(path, query))
  }

  /**
   * Follow CV-CUE's `startindex` / `pagesize` paging to exhaustion, returning
   * the concatenation of `extract(page)` across pages. Bounded so a runaway
   * `totalCount` can't spin forever.
   */
  async getPaged<T, E extends { totalCount?: number }>(
    path: string,
    extract: (page: E) => T[],
    query?: Record<string, string | number | undefined>,
    opts?: { pageSize?: number; maxItems?: number },
  ): Promise<T[]> {
    const pageSize = opts?.pageSize ?? 200
    const maxItems = opts?.maxItems ?? 5000
    const out: T[] = []
    let startIndex = 0
    while (out.length < maxItems) {
      const page = await this.get<E>(path, { ...query, startindex: startIndex, pagesize: pageSize })
      const items = extract(page)
      out.push(...items)
      const total = page.totalCount ?? out.length
      if (items.length < pageSize || out.length >= total) break
      startIndex += pageSize
    }
    return out.slice(0, maxItems)
  }

  /** Raw passthrough for the dev-only native API endpoint. */
  async nativeApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    const path =
      typeof params['path'] === 'string' ? (params['path'] as string) : '/manageddevices/aps'
    return this.request<unknown>(method, path, params['body'])
  }

  // ------------------------------------------------------------------

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const send = async (cookie: string): Promise<Response> => {
      const init: RequestInit = {
        method,
        headers: {
          Cookie: cookie,
          Version: VERSION_HEADER,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
      if (body !== undefined && method !== 'GET') {
        init.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
      return fetch(url, init)
    }

    let cookie = await this.ensureSession()
    let resp = await send(cookie)
    if (resp.status === 401) {
      // Session idled out or was invalidated — drop it and log in once more.
      this.cookie = null
      cookie = await this.ensureSession()
      resp = await send(cookie)
    }
    if (!resp.ok) {
      throw new Error(`Arista CV-CUE ${method} ${path} → HTTP ${resp.status}`)
    }
    if (resp.status === 204) return undefined as T
    return (await resp.json()) as T
  }

  /** Return a live session cookie, deduping concurrent logins. */
  private async ensureSession(): Promise<string> {
    if (this.cookie && this.sessionExpiresAt > Date.now()) return this.cookie
    if (!this.pendingAuth) {
      this.pendingAuth = this.login().finally(() => {
        this.pendingAuth = null
      })
    }
    this.cookie = await this.pendingAuth
    this.sessionExpiresAt = Date.now() + SESSION_TTL_MS
    return this.cookie
  }

  /** POST the API-key credentials and capture the JSESSIONID cookie. */
  private async login(): Promise<string> {
    const url = this.withQuery(
      `${this.config.baseUrl}/session`,
      this.config.customerId ? { CID: this.config.customerId } : undefined,
    )
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Version: VERSION_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'apikeycredentials',
        keyId: this.config.keyId,
        keyValue: this.config.keyValue,
      }),
    })
    if (!resp.ok) {
      // Never echo the key back; the status is enough to diagnose.
      throw new Error(`Arista CV-CUE session login failed: HTTP ${resp.status}`)
    }
    const cookie = extractJSessionId(resp)
    if (!cookie) {
      throw new Error('Arista CV-CUE login succeeded but no JSESSIONID cookie was returned')
    }
    // Touch the body so an unexpected shape (non-JSON) fails here, loudly.
    ;(await resp.json()) as CvSessionResponse
    return cookie
  }

  private withQuery(path: string, query?: Record<string, string | number | undefined>): string {
    const merged: Record<string, string | number | undefined> = {
      locationid: this.config.locationId ?? 0,
      ...query,
    }
    const qs = Object.entries(merged)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (!qs) return path
    return `${path}${path.includes('?') ? '&' : '?'}${qs}`
  }
}

/**
 * Pull the `JSESSIONID=...` pair out of the login response's Set-Cookie
 * header(s). Uses `getSetCookie()` (array) when available (undici/Node/Bun),
 * falling back to the combined `set-cookie` header.
 */
function extractJSessionId(resp: Response): string | null {
  const headers = resp.headers as Headers & { getSetCookie?: () => string[] }
  const raw = headers.getSetCookie?.() ?? [resp.headers.get('set-cookie') ?? '']
  for (const line of raw) {
    const m = line.match(/JSESSIONID=([^;]+)/)
    if (m?.[1]) return `JSESSIONID=${m[1]}`
  }
  return null
}
