import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { AuthPrincipal } from '../src/auth/principal.js'
import { createSession, deleteAllSessions, getSessionPrincipal } from '../src/services/auth.js'
import { setupTempDb, type TempDb } from './db/helper.js'

let database: TempDb

beforeAll(() => {
  database = setupTempDb()
})

afterAll(() => database.teardown())

describe('principal-backed sessions', () => {
  test('defaults new password sessions to the local administrator', () => {
    const token = createSession()
    expect(getSessionPrincipal(token)).toEqual({
      subject: 'local-admin',
      role: 'admin',
      authMethod: 'password',
    })
  })

  test('round-trips a future normal-user principal', () => {
    const principal: AuthPrincipal = {
      subject: 'user-1',
      role: 'user',
      authMethod: 'password',
    }
    const token = createSession(principal)
    expect(getSessionPrincipal(token)).toEqual(principal)
  })

  test('does not persist anonymous principals', () => {
    expect(() =>
      createSession({ subject: 'anonymous', role: 'anonymous', authMethod: 'anonymous' }),
    ).toThrow('Anonymous principals')
    deleteAllSessions()
  })
})
