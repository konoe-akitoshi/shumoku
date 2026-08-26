import { describe, expect, it } from 'vitest'
import { authorizeRequest } from './access-policy.js'
import type { AuthPrincipal } from './principal.js'

const user: AuthPrincipal = { subject: 'user-1', role: 'user', authMethod: 'password' }
const viewer: AuthPrincipal = {
  subject: 'public-demo',
  role: 'viewer',
  authMethod: 'anonymous',
}

describe('principal authorization policy', () => {
  it('lets a normal user read and write workspace resources but not administration', () => {
    expect(authorizeRequest(user, 'GET', '/api/topologies').allowed).toBe(true)
    expect(authorizeRequest(user, 'POST', '/api/topologies').allowed).toBe(true)
    expect(authorizeRequest(user, 'GET', '/api/datasources').allowed).toBe(false)
    expect(authorizeRequest(user, 'GET', '/api/settings').allowed).toBe(false)
    expect(authorizeRequest(user, 'POST', '/api/plugins/reload').allowed).toBe(false)
  })

  it('keeps a viewer on the projected public allow-list', () => {
    expect(authorizeRequest(viewer, 'GET', '/api/topologies/topology-1/view')).toMatchObject({
      allowed: true,
      projectPublicResponse: true,
    })
    expect(authorizeRequest(viewer, 'GET', '/api/topologies/topology-1/sources').allowed).toBe(
      false,
    )
    expect(authorizeRequest(viewer, 'POST', '/api/topologies').allowed).toBe(false)
  })
})
