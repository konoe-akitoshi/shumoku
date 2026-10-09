// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { isOriginAllowed, type NetPolicy } from './net-policy.js'

/** A fetch-shaped function, injectable so tests never touch the real network. */
export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

export interface HostFetchRequest {
  method?: string
  headers?: Record<string, string>
  body?: string
}

/**
 * Response shape crossing the host/guest JSON boundary — a plain object, not
 * a live `Response`, since the guest only ever sees JSON.
 */
export interface HostFetchResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export interface HostFetchOptions {
  /** Abort the whole fetch — every redirect hop and reading the body — after this many ms. */
  timeoutMs?: number
  /** Reject if the response body exceeds this many bytes, checked while streaming. */
  maxBodyBytes?: number
  /** Abort the fetch (including any redirect hop) if this fires first. */
  signal?: AbortSignal
}

const MAX_REDIRECTS = 5
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024

interface FetchConfig {
  fetchImpl: FetchImpl
  maxBodyBytes: number
  signal: AbortSignal
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400
}

/** Fetches `url` on behalf of a sandboxed plugin, after checking `policy` allows it. */
export async function hostFetch(
  policy: NetPolicy,
  url: string,
  request: HostFetchRequest,
  fetchImpl: FetchImpl,
  options: HostFetchOptions = {},
): Promise<HostFetchResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (options.signal?.aborted) abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Sandbox fetch to ${url} timed out after ${timeoutMs}ms`))
      abort()
    }, timeoutMs)
  })
  const config: FetchConfig = {
    fetchImpl,
    maxBodyBytes: options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    signal: controller.signal,
  }
  try {
    // One deadline for the whole exchange: a server that sends headers
    // promptly and then trickles the body must not hold the request open.
    return await Promise.race([
      followRedirects(policy, url, request, config, MAX_REDIRECTS),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}

async function followRedirects(
  policy: NetPolicy,
  url: string,
  request: HostFetchRequest,
  config: FetchConfig,
  redirectsLeft: number,
): Promise<HostFetchResponse> {
  if (!isOriginAllowed(policy, url)) {
    throw new Error(`Sandbox net policy denied fetch to ${url}`)
  }
  const response = await config.fetchImpl(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // Each hop must come back here to be re-checked against the policy;
    // left to itself, fetch would follow a 3xx to any destination before we
    // ever saw the Location.
    redirect: 'manual',
    signal: config.signal,
  })

  const location = isRedirectStatus(response.status) ? response.headers.get('location') : null
  if (location) {
    if (redirectsLeft <= 0) {
      throw new Error(`Sandbox fetch to ${url} exceeded ${MAX_REDIRECTS} redirects`)
    }
    const nextUrl = new URL(location, url).toString()
    return followRedirects(policy, nextUrl, request, config, redirectsLeft - 1)
  }

  const body = await readBodyWithLimit(response, config.maxBodyBytes, config.signal)
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  // Release the upstream stream on abort even if fetchImpl ignored the signal.
  const cancel = () => {
    reader.cancel().catch(() => {})
  }
  if (signal.aborted) cancel()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    return await decodeChunks(reader, new TextDecoder(), maxBytes, 0, '')
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

async function decodeChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  maxBytes: number,
  bytesRead: number,
  text: string,
): Promise<string> {
  const { done, value } = await reader.read()
  if (done) return text + decoder.decode()

  const total = bytesRead + value.byteLength
  if (total > maxBytes) {
    await reader.cancel()
    throw new Error(`Sandbox fetch response exceeded ${maxBytes} bytes`)
  }

  return decodeChunks(
    reader,
    decoder,
    maxBytes,
    total,
    text + decoder.decode(value, { stream: true }),
  )
}
