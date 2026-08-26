import { derived, writable } from 'svelte/store'

export type AuthRole = 'anonymous' | 'viewer' | 'user' | 'admin'
export type AuthMethod = 'anonymous' | 'password' | 'bearer'
export type AuthPermission = 'public:read' | 'workspace:read' | 'workspace:write' | 'admin:manage'

export interface AuthAccessState {
  subject: string
  role: AuthRole
  authMethod: AuthMethod
  permissions: AuthPermission[]
  publicDemo: boolean
}

export const authAccess = writable<AuthAccessState>({
  subject: 'anonymous',
  role: 'anonymous',
  authMethod: 'anonymous',
  permissions: [],
  publicDemo: false,
})
export const authRole = derived(authAccess, ($access) => $access.role)
export const readOnlyAccess = derived(authRole, ($role) => $role === 'viewer')
