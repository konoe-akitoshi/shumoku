// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shared HTTP client for data source plugins (layer 2 of the 3-layer shared
 * design — Node runtime, NOT browser-safe; see
 * `apps/server/docs/design/plugin-contract-unification.md` §3.9).
 *
 * The audit found six hand-rolled fetch wrappers that had each drifted:
 * missing timeouts, a Bun-only `tls:{rejectUnauthorized}` that broke under
 * Node, ad-hoc auth headers, and inconsistent error handling. This is the one
 * client they share. It:
 * - normalizes `baseUrl` + path joining and query-string building,
 * - applies an auth strategy (Bearer / Token / Basic / none),
 * - enforces a per-request timeout (default 10s) via AbortSignal,
 * - supports `insecure` TLS in BOTH Bun and Node (Bun `tls`, Node undici
 *   `dispatcher`) — never the Bun-only form,
 * - throws a typed `HttpError` on non-2xx,
 * - NEVER logs credentials.
 */

/** Authorization strategies plugins use against upstreams. */
export type AuthStrategy =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  /** `Authorization: <scheme> <token>` (NetBox uses scheme `Token`). */
  | { type: 'token'; token: string; scheme?: string }
  | { type: 'basic'; username: string; password: string }

export interface HttpClientOptions {
  /** Base URL; trailing slash is normalized away. */
  baseUrl: string
  auth?: AuthStrategy
  /** Default per-request timeout in ms (default 10000). */
  timeoutMs?: number
  /** Skip TLS certificate verification (self-signed upstreams). */
  insecure?: boolean
  /** Headers sent on every request. */
  defaultHeaders?: Record<string, string>
  /** Debug sink. Receives method/url/status only — never credentials. */
  debug?: (message: string) => void
  /** Injectable fetch for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
}

export interface HttpRequestOptions {
  method?: string
  /** Query params; arrays repeat the key; `undefined` values are dropped. */
  query?: Record<string, string | number | boolean | undefined | (string | number)[]>
  headers?: Record<string, string>
  /** Request body. Strings/`Uint8Array` are sent verbatim; anything else is JSON-encoded. */
  body?: unknown
  /** Per-request timeout override (ms). */
  timeoutMs?: number
  /** External cancellation; combined with the timeout. */
  signal?: AbortSignal
}

/** Thrown on a non-2xx response. Carries status, URL, and a body excerpt. */
export class HttpError extends Error {
  readonly status: number
  readonly url: string
  readonly bodyText: string
  constructor(status: number, url: string, bodyText: string) {
    super(`HTTP ${status} for ${url}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
    this.bodyText = bodyText
  }
}

/** RequestInit plus the runtime-specific insecure-TLS escapes. */
type FetchInit = RequestInit & { dispatcher?: unknown; tls?: { rejectUnauthorized: boolean } }

function isBun(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path // already absolute (e.g. a pagination `next`)
  const base = stripTrailingSlash(baseUrl)
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function buildQuery(query: HttpRequestOptions['query']): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v))
    } else {
      params.append(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function authHeader(auth: AuthStrategy | undefined): Record<string, string> {
  if (!auth || auth.type === 'none') return {}
  switch (auth.type) {
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` }
    case 'token':
      return { Authorization: `${auth.scheme ?? 'Token'} ${auth.token}` }
    case 'basic': {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64')
      return { Authorization: `Basic ${encoded}` }
    }
  }
}

export class HttpClient {
  private readonly options: HttpClientOptions
  private readonly fetchImpl: typeof fetch
  /** Memoized insecure-TLS init (async because Node needs `import('undici')`). */
  private insecureInit?: Promise<FetchInit>

  constructor(options: HttpClientOptions) {
    this.options = options
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
  }

  get baseUrl(): string {
    return stripTrailingSlash(this.options.baseUrl)
  }

  /** Raw request. Throws `HttpError` on non-2xx; resolves the `Response` otherwise. */
  async request(path: string, opts: HttpRequestOptions = {}): Promise<Response> {
    const url = joinUrl(this.options.baseUrl, path) + buildQuery(opts.query)
    const method = opts.method ?? 'GET'
    const timeoutMs = opts.timeoutMs ?? this.options.timeoutMs ?? 10_000

    const headers: Record<string, string> = {
      ...this.options.defaultHeaders,
      ...authHeader(this.options.auth),
      ...opts.headers,
    }

    let body: BodyInit | undefined
    if (opts.body !== undefined) {
      if (typeof opts.body === 'string' || opts.body instanceof Uint8Array) {
        body = opts.body as BodyInit
      } else {
        body = JSON.stringify(opts.body)
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
      }
    }

    const init: FetchInit = { method, headers, body }
    if (this.options.insecure) Object.assign(init, await this.resolveInsecureInit())

    const { signal, cancel } = withTimeout(timeoutMs, opts.signal)
    init.signal = signal
    this.options.debug?.(`${method} ${url}`) // no auth header here — credentials never logged

    try {
      const response = await this.fetchImpl(url, init)
      if (!response.ok) {
        const bodyText = await safeReadBody(response)
        throw new HttpError(response.status, url, bodyText)
      }
      return response
    } finally {
      cancel()
    }
  }

  /** Request + JSON parse. Returns `undefined` for empty (204) bodies. */
  async json<T>(path: string, opts?: HttpRequestOptions): Promise<T> {
    const response = await this.request(path, opts)
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  private resolveInsecureInit(): Promise<FetchInit> {
    if (!this.insecureInit) this.insecureInit = buildInsecureInit(this.options.debug)
    return this.insecureInit
  }
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  return new HttpClient(options)
}

async function buildInsecureInit(debug?: (m: string) => void): Promise<FetchInit> {
  if (isBun()) return { tls: { rejectUnauthorized: false } }
  try {
    const { Agent } = await import('undici')
    return { dispatcher: new Agent({ connect: { rejectUnauthorized: false } }) }
  } catch {
    debug?.('insecure TLS requested but undici is unavailable; using default verification')
    return {}
  }
}

/** Combine a timeout with an optional external signal. Caller must `cancel()`. */
function withTimeout(
  timeoutMs: number,
  external?: AbortSignal,
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)),
    timeoutMs,
  )
  const onExternalAbort = () => controller.abort(external?.reason)
  if (external) {
    if (external.aborted) controller.abort(external.reason)
    else external.addEventListener('abort', onExternalAbort, { once: true })
  }
  const cancel = () => {
    clearTimeout(timer)
    external?.removeEventListener('abort', onExternalAbort)
  }
  return { signal: controller.signal, cancel }
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : text
  } catch {
    return ''
  }
}
