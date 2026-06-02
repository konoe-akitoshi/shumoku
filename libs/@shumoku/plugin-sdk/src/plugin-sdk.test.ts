// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { createHttpClient, HttpError } from './http-client.js'
import { type Page, paginate } from './paginate.js'

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), { status: 200, ...init })

const headersOf = (init: RequestInit | undefined): Record<string, string> =>
  (init?.headers as Record<string, string>) ?? {}

describe('HttpClient', () => {
  it('joins base+path, builds query (arrays repeat, undefined dropped), applies bearer auth', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedInit = init
      return jsonResponse({ ok: 1 })
    }) as unknown as typeof fetch

    const client = createHttpClient({
      baseUrl: 'https://api.example.com/',
      auth: { type: 'bearer', token: 'secret' },
      fetchImpl,
    })
    const out = await client.json<{ ok: number }>('/things', {
      query: { limit: 10, tags: ['a', 'b'], skip: undefined },
    })

    expect(out).toEqual({ ok: 1 })
    expect(capturedUrl).toBe('https://api.example.com/things?limit=10&tags=a&tags=b')
    expect(headersOf(capturedInit).Authorization).toBe('Bearer secret')
  })

  it('produces Token and Basic auth headers', async () => {
    const captured: RequestInit[] = []
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      captured.push(init ?? {})
      return jsonResponse({})
    }) as unknown as typeof fetch

    await createHttpClient({
      baseUrl: 'https://n',
      auth: { type: 'token', token: 't' },
      fetchImpl,
    }).json('/x')
    await createHttpClient({
      baseUrl: 'https://n',
      auth: { type: 'basic', username: 'u', password: 'p' },
      fetchImpl,
    }).json('/x')

    expect(headersOf(captured[0]).Authorization).toBe('Token t')
    expect(headersOf(captured[1]).Authorization).toBe(
      `Basic ${Buffer.from('u:p').toString('base64')}`,
    )
  })

  it('treats an absolute path as-is (a pagination next URL)', async () => {
    let url = ''
    const fetchImpl = (async (u: string | URL | Request) => {
      url = String(u)
      return jsonResponse({})
    }) as unknown as typeof fetch
    await createHttpClient({ baseUrl: 'https://a/api', fetchImpl }).json(
      'https://a/api/things?offset=50',
    )
    expect(url).toBe('https://a/api/things?offset=50')
  })

  it('JSON-encodes a non-string body and sets Content-Type', async () => {
    let init: RequestInit | undefined
    const fetchImpl = (async (_u: unknown, i?: RequestInit) => {
      init = i
      return jsonResponse({})
    }) as unknown as typeof fetch
    await createHttpClient({ baseUrl: 'https://a', fetchImpl }).json('/x', {
      method: 'POST',
      body: { a: 1 },
    })
    expect(init?.body).toBe('{"a":1}')
    expect(headersOf(init)['Content-Type']).toBe('application/json')
  })

  it('throws HttpError with status + body excerpt on non-2xx', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    const client = createHttpClient({ baseUrl: 'https://a', fetchImpl })
    await expect(client.json('/missing')).rejects.toBeInstanceOf(HttpError)
    const err = await client.json('/missing').catch((e) => e)
    expect(err).toBeInstanceOf(HttpError)
    expect((err as HttpError).status).toBe(404)
    expect((err as HttpError).bodyText).toBe('nope')
  })

  it('returns undefined for a 204 No Content', async () => {
    const fetchImpl = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch
    expect(await createHttpClient({ baseUrl: 'https://a', fetchImpl }).json('/x')).toBeUndefined()
  })

  it('aborts a request that exceeds the timeout', async () => {
    const fetchImpl = ((_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch
    const client = createHttpClient({ baseUrl: 'https://a', timeoutMs: 10, fetchImpl })
    await expect(client.json('/slow')).rejects.toThrow()
  })

  it('never passes credentials to the debug sink', async () => {
    const logs: string[] = []
    const fetchImpl = (async () => jsonResponse({})) as unknown as typeof fetch
    await createHttpClient({
      baseUrl: 'https://a',
      auth: { type: 'bearer', token: 'topsecret' },
      debug: (m) => logs.push(m),
      fetchImpl,
    }).json('/x')
    expect(logs.join('\n')).not.toContain('topsecret')
    expect(logs.join('\n')).toContain('GET https://a/x')
  })
})

describe('paginate', () => {
  it('follows next until null and concatenates in order', async () => {
    const pages: Record<string, Page<number>> = {
      '/start': { items: [1, 2], next: '/p2' },
      '/p2': { items: [3, 4], next: '/p3' },
      '/p3': { items: [5], next: null },
    }
    const out = await paginate<number>('/start', async (u) => pages[u] ?? { items: [], next: null })
    expect(out).toEqual([1, 2, 3, 4, 5])
  })

  it('stops at maxPages and reports truncation rather than hiding it', async () => {
    let truncatedAt = 0
    const out = await paginate<number>('/p', async () => ({ items: [1], next: '/p' }), {
      maxPages: 3,
      onTruncated: (pages) => {
        truncatedAt = pages
      },
    })
    expect(out).toEqual([1, 1, 1])
    expect(truncatedAt).toBe(3)
  })
})
