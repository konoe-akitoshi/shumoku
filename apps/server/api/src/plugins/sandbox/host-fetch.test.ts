// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { hostFetch } from './host-fetch.js'

/**
 * A fake that follows redirects the way the real `fetch` does: on its own,
 * unless the caller passes `redirect: 'manual'`. Records every URL it
 * actually requested, including hops it followed internally.
 */
function redirectFollowingFetch(routes: Record<string, () => Response>) {
  const requestedUrls: string[] = []
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    requestedUrls.push(url)
    const response = routes[url]?.() ?? new Response('not found', { status: 404 })
    const location = response.headers.get('location')
    if (location && init?.redirect !== 'manual') {
      return fetchImpl(new URL(location, url).toString(), init)
    }
    return response
  }
  return { fetchImpl, requestedUrls }
}

describe('hostFetch', () => {
  it('relays an allowed destination and returns status, headers, and body', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const fetchImpl = async (url: string) => {
      expect(url).toBe('https://netbox.example.com/api/dcim/devices/')
      return new Response('{"count":1}', {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await hostFetch(
      policy,
      'https://netbox.example.com/api/dcim/devices/',
      {},
      fetchImpl,
    )

    expect(result.status).toBe(200)
    expect(result.statusText).toBe('OK')
    expect(result.headers['content-type']).toBe('application/json')
    expect(result.body).toBe('{"count":1}')
  })

  it('rejects a disallowed destination without calling fetchImpl', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    let called = false
    const fetchImpl = async () => {
      called = true
      return new Response('should not be reached')
    }

    await expect(
      hostFetch(policy, 'https://evil.example.com/steal', {}, fetchImpl),
    ).rejects.toThrow('Sandbox net policy denied fetch to https://evil.example.com/steal')
    expect(called).toBe(false)
  })

  it('follows a relative redirect to an allowed destination', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const { fetchImpl, requestedUrls } = redirectFollowingFetch({
      'https://netbox.example.com/old-path': () =>
        new Response(null, {
          status: 302,
          headers: { location: '/new-path' },
        }),
      'https://netbox.example.com/new-path': () => new Response('moved', { status: 200 }),
    })

    const result = await hostFetch(policy, 'https://netbox.example.com/old-path', {}, fetchImpl)

    expect(result.status).toBe(200)
    expect(result.body).toBe('moved')
    expect(requestedUrls).toEqual([
      'https://netbox.example.com/old-path',
      'https://netbox.example.com/new-path',
    ])
  })

  it('rejects a redirect whose Location leaves the allowed origins, without requesting it', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const { fetchImpl, requestedUrls } = redirectFollowingFetch({
      'https://netbox.example.com/old-path': () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example.com/steal' },
        }),
      'https://evil.example.com/steal': () => new Response('secret', { status: 200 }),
    })

    await expect(
      hostFetch(policy, 'https://netbox.example.com/old-path', {}, fetchImpl),
    ).rejects.toThrow('Sandbox net policy denied fetch to https://evil.example.com/steal')
    expect(requestedUrls).toEqual(['https://netbox.example.com/old-path'])
  })

  it('caps the number of redirects it will follow', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return new Response(null, {
        status: 302,
        headers: { location: `https://netbox.example.com/hop-${calls}` },
      })
    }

    await expect(
      hostFetch(policy, 'https://netbox.example.com/hop-0', {}, fetchImpl),
    ).rejects.toThrow(/exceeded 5 redirects/)
    // The original request plus 5 followed hops.
    expect(calls).toBe(6)
  })

  it('returns a non-3xx response as is, even with a Location header', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const { fetchImpl, requestedUrls } = redirectFollowingFetch({
      'https://netbox.example.com/devices': () =>
        new Response('created', {
          status: 201,
          headers: { location: 'https://netbox.example.com/devices/1' },
        }),
    })

    const result = await hostFetch(policy, 'https://netbox.example.com/devices', {}, fetchImpl)

    expect(result.status).toBe(201)
    expect(result.body).toBe('created')
    expect(requestedUrls).toEqual(['https://netbox.example.com/devices'])
  })

  it('rejects when fetchImpl takes longer than the configured timeout', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const fetchImpl = () =>
      new Promise<Response>((resolve) => {
        setTimeout(() => resolve(new Response('too slow')), 200)
      })

    await expect(
      hostFetch(policy, 'https://netbox.example.com/slow', {}, fetchImpl, { timeoutMs: 20 }),
    ).rejects.toThrow('Sandbox fetch to https://netbox.example.com/slow timed out after 20ms')
  })

  it('times out a response whose body never finishes arriving', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    let cancelled = false
    const fetchImpl = async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"results":['))
        },
        cancel() {
          cancelled = true
        },
      })
      return new Response(stream, { status: 200 })
    }

    await expect(
      hostFetch(policy, 'https://netbox.example.com/trickle', {}, fetchImpl, { timeoutMs: 20 }),
    ).rejects.toThrow(/timed out after 20ms/)
    expect(cancelled).toBe(true)
  }, 1000)

  it('rejects when the caller-provided AbortSignal fires while fetchImpl is pending', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const controller = new AbortController()
    const fetchImpl = (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
        setTimeout(() => resolve(new Response('too slow')), 200)
      })

    const pending = hostFetch(policy, 'https://netbox.example.com/slow', {}, fetchImpl, {
      signal: controller.signal,
    })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('passes a caller abort that lands between redirect hops on to the next hop', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const controller = new AbortController()
    const signals: (AbortSignal | undefined)[] = []
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      signals.push(init?.signal ?? undefined)
      if (signals.length > 1) return new Response('second hop')
      controller.abort()
      return new Response(null, { status: 302, headers: { location: '/next' } })
    }

    await hostFetch(policy, 'https://netbox.example.com/first', {}, fetchImpl, {
      signal: controller.signal,
    }).catch(() => {})

    expect(signals.slice(1).every((signal) => signal?.aborted)).toBe(true)
  })

  it('accepts a response body of exactly the configured limit', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    const fetchImpl = async () => new Response('a'.repeat(15), { status: 200 })

    const result = await hostFetch(policy, 'https://netbox.example.com/exact', {}, fetchImpl, {
      maxBodyBytes: 15,
    })

    expect(result.body).toBe('a'.repeat(15))
  })

  it('rejects a body over the limit as it streams, and cancels the stream', async () => {
    const policy = { allowedOrigins: ['https://netbox.example.com'] }
    let cancelled = false
    const fetchImpl = async () => {
      // Never closes: a limit checked only after reading everything would hang.
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('a'.repeat(10)))
          controller.enqueue(new TextEncoder().encode('b'.repeat(10)))
        },
        cancel() {
          cancelled = true
        },
      })
      return new Response(stream, { status: 200 })
    }

    await expect(
      hostFetch(policy, 'https://netbox.example.com/big', {}, fetchImpl, { maxBodyBytes: 15 }),
    ).rejects.toThrow('Sandbox fetch response exceeded 15 bytes')
    expect(cancelled).toBe(true)
  }, 1000)
})
