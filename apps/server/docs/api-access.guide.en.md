---
id: server.api-access
title: Authentication, APIs, and shared access
description: Understand access boundaries for management APIs, sharing, webhooks, and WebSocket.
locale: en
canonicalLocale: ja
slug: server/api-access
status: stable
audience: operator
owner: server
canonicalDigest: 9ca66785ed158e0e9faf4778a49e142626773a648d21e1009068fe874e7df274
related:
  - /en/reference/server
---

Protected APIs require an authenticated principal with the appropriate permissions, resolved from a local session or opt-in trusted proxy headers. Workspace reads require `workspace:read`, mutations require `workspace:write`, and data-source configuration, settings, and administrator diagnostics require `admin:manage`. Exceptions are the health check, token-scoped share routes, and secret-authenticated webhooks. See the [generated Server API](/en/reference/server) for individual requests and responses.

## Bootstrap authentication

A fresh Server bound beyond loopback refuses to start without an administrator secret. Prefer an owner-readable file through `SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE`. Browser-driven setup through `SHUMOKU_ALLOW_WEB_SETUP` is for loopback development only.

`DEMO_MODE` seeds sample data; it does not enable anonymous access.

## Reverse-proxy SSO

See [installation](/en/guides/server/installation) for the proxy trust boundary and environment variables. Proxy mode is exclusive: local login, setup, password changes, cookies, and development bearer credentials cannot grant access while it is enabled. The bootstrap administrator secret remains required for initial setup.

`GET /api/auth/status` reports `authMethod: proxy` and a `proxy:`-prefixed subject. Without a role header, the default is `viewer`; with a role header, missing or unrecognized groups are denied. Multiple groups grant the highest mapped role. A denied request to a protected API receives 401; an authenticated identity without the required permission receives 403.

Sign out through the organization's authentication provider. Shumoku's logout endpoint only clears local sessions. For emergency local login, restrict network access, disable proxy mode, and restart. Clients that exhaustively decode `authMethod` must support `proxy` before enabling this mode.

## Development API automation

`bun run dev:server` creates an ephemeral loopback-only credential. Use the wrapper without displaying or copying the credential.

```bash
bun run dev:server:request -- GET /api/topologies
```

This route is available only in development on loopback. Production uses local sessions or opt-in proxy authentication. The development bearer credential is ignored in proxy mode.

## Sharing and webhooks

A topology or dashboard share token grants read-only access scoped to that resource. It cannot enumerate unrelated management resources. Revoke unused tokens from the corresponding settings screen.

Prefer the `X-Webhook-Secret` header for webhooks. A query parameter may be recorded in access logs.

## WebSocket

`/ws` requires a local session or trusted proxy identity, an allowed Origin, and `workspace:read`. Proxy mode uses the same identity resolution as HTTP and ignores local cookies. Authorization is checked on connection; an existing socket retains its principal until disconnected. Forward WebSocket upgrades through a reverse proxy. The message contract currently remains in Server source and will be extracted into a dedicated reference later.
