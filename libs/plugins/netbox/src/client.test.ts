import { describe, expect, it } from 'vitest'
import { resolveNetboxAuth } from './client.js'

// A real v1 token (40-char) and a v2 token (nbt_<id>.<secret>) per NetBox docs.
const V1 = '7QKANCgIC2VzIEUUmtckumVzIMt5y21FQCU6Kru8'
const V2 = 'nbt_4F9DAouzURLb.zjebxBPzICiPbWz0Wtx0fTL7bCKXKGTYhNzkgC2S'

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
