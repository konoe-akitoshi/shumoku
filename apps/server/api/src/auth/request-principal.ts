import type { AuthPrincipal } from './principal.js'

const requestPrincipals = new WeakMap<Request, AuthPrincipal>()

export function setRequestPrincipal(request: Request, principal: AuthPrincipal): void {
  requestPrincipals.set(request, principal)
}

export function getRequestPrincipal(request: Request): AuthPrincipal | null {
  return requestPrincipals.get(request) ?? null
}
