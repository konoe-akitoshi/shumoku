import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetBoxClient, resolveNetboxAuth } from './client.js'

// Synthetic fixtures with the documented v1/v2 shapes, never live credentials.
const V1 = 'a'.repeat(40)
const V2 = `nbt_testkey.${'b'.repeat(40)}`

describe('resolveNetboxAuth', () => {
  it('uses the Token scheme for a bare v1 token', () => {
    expect(resolveNetboxAuth(V1)).toEqual({ token: V1, scheme: 'Token' })
  })

  it('uses the Bearer scheme for a v2 token (nbt_<id>.<secret>)', () => {
    expect(resolveNetboxAuth(V2)).toEqual({ token: V2, scheme: 'Bearer' })
  })

  it('strips a copied "Token " prefix (NetBox UI example usage)', () => {
    expect(resolveNetboxAuth(`Token ${V1}`)).toEqual({ token: V1, scheme: 'Token' })
  })

  it('strips a copied "Bearer " prefix for a v2 token', () => {
    expect(resolveNetboxAuth(`Bearer ${V2}`)).toEqual({ token: V2, scheme: 'Bearer' })
  })

  it('is case-insensitive about the pasted scheme', () => {
    expect(resolveNetboxAuth(`token ${V1}`)).toEqual({ token: V1, scheme: 'Token' })
  })

  it('self-corrects a wrongly-copied scheme by re-detecting from the credential', () => {
    // "Token nbt_…" (wrong scheme copied) → strip → detect v2 → Bearer
    expect(resolveNetboxAuth(`Token ${V2}`).scheme).toBe('Bearer')
  })

  it('treats nbt_ without a dot as v1 (Token)', () => {
    expect(resolveNetboxAuth('nbt_nodotsuffix')).toEqual({
      token: 'nbt_nodotsuffix',
      scheme: 'Token',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(resolveNetboxAuth('  abc123  ')).toEqual({ token: 'abc123', scheme: 'Token' })
  })

  it('handles an empty or undefined token', () => {
    expect(resolveNetboxAuth('')).toEqual({ token: '', scheme: 'Token' })
    expect(resolveNetboxAuth(undefined)).toEqual({ token: '', scheme: 'Token' })
  })
})

describe('NetBoxClient Authorization header', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    { name: 'bare v1', input: V1, expected: `Token ${V1}` },
    { name: 'pasted v1', input: `Token ${V1}`, expected: `Token ${V1}` },
    { name: 'bare v2', input: V2, expected: `Bearer ${V2}` },
    { name: 'wrong pasted scheme', input: `Token ${V2}`, expected: `Bearer ${V2}` },
  ])('passes the normalized $name header through the shared SDK', async ({ input, expected }) => {
    let authorization: string | null = null
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get('Authorization')
      return Response.json({ count: 0, next: null, previous: null, results: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new NetBoxClient({ url: 'https://netbox.invalid/api', token: input })
    await expect(client.fetchDevices()).resolves.toMatchObject({ count: 0, results: [] })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(authorization).toBe(expected)
  })
})
