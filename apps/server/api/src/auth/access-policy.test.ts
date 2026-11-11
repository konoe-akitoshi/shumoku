import { describe, expect, it } from 'vitest'
import { authorizeRequest } from './access-policy.js'
import type { AuthPrincipal } from './principal.js'

const user: AuthPrincipal = { subject: 'user-1', role: 'user', authMethod: 'password' }
const viewer: AuthPrincipal = {
  subject: 'viewer-1',
  role: 'viewer',
  authMethod: 'password',
}

describe('principal authorization policy', () => {
  it('lets a normal user read and write workspace resources but not administration', () => {
    expect(authorizeRequest(user, 'GET', '/api/topologies').allowed).toBe(true)
    expect(authorizeRequest(user, 'POST', '/api/topologies').allowed).toBe(true)
    expect(authorizeRequest(user, 'GET', '/api/datasources').allowed).toBe(false)
    expect(authorizeRequest(user, 'GET', '/api/settings').allowed).toBe(false)
    expect(authorizeRequest(user, 'POST', '/api/plugins/reload').allowed).toBe(false)
  })

  it('keeps credentials an administrator surface but device assignment a user action', () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      expect(authorizeRequest(user, method, '/api/credentials').allowed).toBe(false)
      expect(authorizeRequest(user, method, '/api/credentials/cr_1').allowed).toBe(false)
    }
    expect(authorizeRequest(user, 'POST', '/api/credentials/test').allowed).toBe(false)
    expect(authorizeRequest(viewer, 'GET', '/api/credentials').allowed).toBe(false)
    expect(authorizeRequest(user, 'PATCH', '/api/topologies/x/devices').allowed).toBe(true)
    expect(authorizeRequest(user, 'POST', '/api/topologies/x/devices/read').allowed).toBe(true)
    expect(authorizeRequest(viewer, 'GET', '/api/topologies/x/devices').allowed).toBe(true)
    expect(authorizeRequest(viewer, 'PATCH', '/api/topologies/x/devices').allowed).toBe(false)
  })

  it('lets an authenticated viewer read workspace resources without mutation access', () => {
    expect(authorizeRequest(viewer, 'GET', '/api/topologies/topology-1/view').allowed).toBe(true)
    expect(authorizeRequest(viewer, 'GET', '/api/topologies/topology-1/sources').allowed).toBe(
      false,
    )
    expect(authorizeRequest(viewer, 'POST', '/api/topologies').allowed).toBe(false)
  })
})
