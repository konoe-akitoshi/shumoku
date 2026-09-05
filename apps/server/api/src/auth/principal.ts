export const AUTH_ROLES = ['anonymous', 'viewer', 'user', 'admin'] as const
export type AuthRole = (typeof AUTH_ROLES)[number]

export const AUTH_METHODS = ['anonymous', 'password', 'bearer', 'proxy'] as const
export type AuthMethod = (typeof AUTH_METHODS)[number]

export const AUTH_PERMISSIONS = ['workspace:read', 'workspace:write', 'admin:manage'] as const
export type AuthPermission = (typeof AUTH_PERMISSIONS)[number]

export interface AuthPrincipal {
  subject: string
  role: AuthRole
  authMethod: AuthMethod
}

const ROLE_PERMISSIONS: Record<AuthRole, readonly AuthPermission[]> = {
  anonymous: [],
  viewer: ['workspace:read'],
  user: ['workspace:read', 'workspace:write'],
  admin: AUTH_PERMISSIONS,
}

export const ANONYMOUS_PRINCIPAL: AuthPrincipal = {
  subject: 'anonymous',
  role: 'anonymous',
  authMethod: 'anonymous',
}

export const LOCAL_ADMIN_PRINCIPAL: AuthPrincipal = {
  subject: 'local-admin',
  role: 'admin',
  authMethod: 'password',
}

export const DEV_AUTOMATION_PRINCIPAL: AuthPrincipal = {
  subject: 'dev-automation',
  role: 'admin',
  authMethod: 'bearer',
}

export function permissionsForRole(role: AuthRole): readonly AuthPermission[] {
  return ROLE_PERMISSIONS[role]
}

export function hasPermission(principal: AuthPrincipal, permission: AuthPermission): boolean {
  return ROLE_PERMISSIONS[principal.role].includes(permission)
}

export function isAuthRole(value: string): value is AuthRole {
  return (AUTH_ROLES as readonly string[]).includes(value)
}

export function isAuthMethod(value: string): value is AuthMethod {
  return (AUTH_METHODS as readonly string[]).includes(value)
}
