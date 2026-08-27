# Authentication and authorization model

Shumoku separates authentication (who made the request) from authorization
(what that identity may do). Every authenticated path resolves to one
`AuthPrincipal` before policy is evaluated:

```ts
interface AuthPrincipal {
  subject: string
  role: 'anonymous' | 'viewer' | 'user' | 'admin'
  authMethod: 'anonymous' | 'password' | 'bearer'
}
```

Current subjects are `local-admin` and `dev-automation`. The `viewer` and `user`
roles are part of the contract even though user management is not yet exposed.
This lets a future local-user or OIDC provider issue the same principal without
changing route authorization.

## Permissions

Routes authorize permissions, not cookie presence or authentication method.

| Role | Permissions |
|------|-------------|
| `anonymous` | none |
| `viewer` | `workspace:read` |
| `user` | `workspace:read`, `workspace:write` |
| `admin` | all user permissions plus `admin:manage` |

Data-source and topology-source configuration, Settings, plugin management, and
administrator diagnostics require `admin:manage`. Other workspace reads require
`workspace:read`; mutations require `workspace:write`. A viewer is an
authenticated read-only workspace user, not an anonymous fallback. Future
user-facing data-source consumption should receive its own narrow permission and
response DTO rather than exposing stored configuration.

HTTP and WebSocket authentication share the same principal types and permission
definitions. Middleware attaches the resolved principal to the raw request via
`getRequestPrincipal(request)`, so future handlers and audit logging can obtain
the subject without parsing cookies again.

## Sessions and future providers

Sessions store `subject`, `role`, and `auth_method`. Migration 033 upgrades
existing sessions to `local-admin` / `admin` / `password`. The initial
administrator Secret remains a credential bootstrap mechanism; it does not
define route permissions.

When adding multiple users, introduce the user/identity store behind principal
resolution and keep these invariants:

- Routes never inspect password hashes, cookies, or provider-specific claims.
- Providers translate their identity into `AuthPrincipal` at the boundary.
- Authorization uses permissions, not provider names or scattered role checks.
- Role changes invalidate or refresh affected sessions.
- Audit records use `principal.subject` as the actor identifier.

This keeps local passwords, OIDC, LDAP, and service credentials interchangeable
from the API's point of view.

## Public demo deployment boundary

`PUBLIC_DEMO` describes a future deployment experience, not an authentication
mode in the server. A demo launcher should provision an isolated, disposable
container per visitor, seed sample data, generate a per-instance administrator
credential, and send the visitor through the normal login flow. The credential
may be shown alongside that instance's login form because the entire instance is
temporary and dedicated to that visitor.

The server must not promote anonymous requests to `viewer`, reuse management APIs
as public APIs, or weaken WebSocket authentication. The launcher is responsible
for expiration, resource limits, network egress policy, and teardown. If a
shared public catalog is added later, it should use dedicated public routes and
explicit publish state rather than the authenticated workspace API.
