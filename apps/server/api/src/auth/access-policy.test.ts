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

  it('lets an authenticated viewer read workspace resources without mutation access', () => {
    expect(authorizeRequest(viewer, 'GET', '/api/topologies/topology-1/view').allowed).toBe(true)
    expect(authorizeRequest(viewer, 'GET', '/api/topologies/topology-1/sources').allowed).toBe(
      false,
    )
    expect(authorizeRequest(viewer, 'POST', '/api/topologies').allowed).toBe(false)
  })
})
