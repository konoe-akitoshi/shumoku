import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { getDatabase } from '../src/db/index.js'
import {
  createApiToken,
  getApiTokenPrincipal,
  listApiTokens,
  revokeApiToken,
} from '../src/services/api-tokens.js'
import { setupTempDb, type TempDb } from './db/helper.js'

let database: TempDb

beforeAll(() => {
  database = setupTempDb()
})

afterAll(() => database.teardown())

describe('API tokens', () => {
  test('issues a shmk_ secret that resolves to a bearer principal with its role', () => {
    const { token, apiToken } = createApiToken({ name: 'terraform', role: 'admin' })
    expect(token).toMatch(/^shmk_[A-Za-z0-9_-]{43}$/)
    expect(apiToken.prefix).toBe(token.slice(0, 9))
    expect(getApiTokenPrincipal(token)).toEqual({
      subject: `api-token:${apiToken.id}`,
      role: 'admin',
      authMethod: 'bearer',
    })
  })

  test('stores only a digest of the secret', () => {
    const { token, apiToken } = createApiToken({ name: 'ci', role: 'viewer' })
    const row = getDatabase()
      .prepare('SELECT * FROM api_tokens WHERE id = ?')
      .get(apiToken.id) as Record<string, unknown>
    expect(JSON.stringify(row)).not.toContain(token.slice(5))
    expect(listApiTokens().find((t) => t.id === apiToken.id)).not.toHaveProperty('token_hash')
  })

  test('records use, at most once a minute', () => {
    const now = 1_800_000_000_000
    const { token, apiToken } = createApiToken({ name: 'use', role: 'user', now })
    getApiTokenPrincipal(token, now + 1000)
    getApiTokenPrincipal(token, now + 2000)
    expect(listApiTokens().find((t) => t.id === apiToken.id)?.lastUsedAt).toBe(now + 1000)
    getApiTokenPrincipal(token, now + 61_000 + 1000)
    expect(listApiTokens().find((t) => t.id === apiToken.id)?.lastUsedAt).toBe(now + 62_000)
  })

  test('refuses expired, revoked, unknown and malformed secrets', () => {
    const now = Date.now()
    const expired = createApiToken({ name: 'old', role: 'admin', expiresAt: now + 10, now })
    expect(getApiTokenPrincipal(expired.token, now + 5)).not.toBeNull()
    expect(getApiTokenPrincipal(expired.token, now + 10)).toBeNull()

    const revoked = createApiToken({ name: 'gone', role: 'admin' })
    expect(revokeApiToken(revoked.apiToken.id)).toBe(true)
    expect(revokeApiToken(revoked.apiToken.id)).toBe(false)
    expect(getApiTokenPrincipal(revoked.token)).toBeNull()

    expect(getApiTokenPrincipal(`shmk_${'A'.repeat(43)}`)).toBeNull()
    expect(getApiTokenPrincipal('shmk_short')).toBeNull()
  })
})
