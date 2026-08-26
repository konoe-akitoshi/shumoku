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

Current subjects are `local-admin`, `public-demo`, and `dev-automation`. The
`user` role is part of the contract even though user management is not yet
exposed. This lets a future local-user or OIDC provider issue the same principal
without changing route authorization.

## Permissions

Routes authorize permissions, not cookie presence or authentication method.

| Role | Permissions |
|------|-------------|
| `anonymous` | none |
| `viewer` | `public:read` |
| `user` | `public:read`, `workspace:read`, `workspace:write` |
| `admin` | all user permissions plus `admin:manage` |

Data-source and topology-source configuration, Settings, plugin management, and
administrator diagnostics require `admin:manage`. Other workspace reads require
`workspace:read`; mutations require `workspace:write`. A public-demo viewer
additionally passes a strict route allow-list and receives only server-projected
responses. Future user-facing data-source consumption should receive its own
narrow permission and response DTO rather than exposing stored configuration.

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
