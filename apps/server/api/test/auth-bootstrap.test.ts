import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getBootstrapAdminPassword } from '../src/services/auth.js'

let directory: string | null = null

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true })
  directory = null
})

describe('administrator bootstrap secret', () => {
  test('prefers an explicit secret file and removes one trailing newline', () => {
    directory = mkdtempSync(join(tmpdir(), 'shumoku-auth-'))
    const passwordFile = join(directory, 'password')
    writeFileSync(passwordFile, 'generated-password\n', { mode: 0o600 })

    expect(getBootstrapAdminPassword({ SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE: passwordFile })).toBe(
      'generated-password',
    )
  })

  test('rejects ambiguous and short bootstrap configuration', () => {
    expect(() =>
      getBootstrapAdminPassword({
        SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE: '/unused',
        SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD: 'another-password',
      }),
    ).toThrow('Set only one')
    expect(() => getBootstrapAdminPassword({ SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD: 'short' })).toThrow(
      'at least 8 characters',
    )
  })

  test('rejects a secret path that is not a regular file', () => {
    directory = mkdtempSync(join(tmpdir(), 'shumoku-auth-'))

    expect(() =>
      getBootstrapAdminPassword({ SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE: directory ?? undefined }),
    ).toThrow('must name a file')
  })
})
