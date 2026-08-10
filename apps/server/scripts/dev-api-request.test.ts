import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseArgs } from './dev-api-request.js'

describe('development API request CLI', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses a loopback JSON request', () => {
    vi.stubEnv('SHUMOKU_DEV_API_URL', 'http://127.0.0.1:8080')
    expect(parseArgs(['post', '/api/topologies', '--json', '{"name":"lab"}'])).toEqual({
      method: 'POST',
      pathname: '/api/topologies',
      body: '{"name":"lab"}',
      baseUrl: 'http://127.0.0.1:8080',
    })
  })

  it('rejects paths outside the management API', () => {
    vi.stubEnv('SHUMOKU_DEV_API_URL', 'http://127.0.0.1:8080')
    expect(() => parseArgs(['GET', '/topology/example'])).toThrow('must start with /api/')
  })

  it('rejects paths that normalize outside the management API', () => {
    expect(() => parseArgs(['GET', '/api/../health'])).toThrow(
      'normalized request path must stay within /api/',
    )
  })

  it('rejects non-loopback destinations to prevent token disclosure', () => {
    expect(() =>
      parseArgs(['GET', '/api/topologies', '--base-url', 'http://192.0.2.10:8080']),
    ).toThrow('restricted to 127.0.0.1 or ::1')
  })

  it('does not send the generated credential to a remote HTTPS origin', () => {
    expect(() =>
      parseArgs(['GET', '/api/topologies', '--base-url', 'https://dev.example.test']),
    ).toThrow('restricted to 127.0.0.1 or ::1')
  })
})
