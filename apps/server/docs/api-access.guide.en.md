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
canonicalDigest: 784cc40c22fabc43014a4473e8382690b0a1456e72d9b4b50b4e0e7f686fac0b
related:
  - /en/reference/server
---

Management APIs normally require the administrator session cookie obtained at login. Exceptions are the health check, token-scoped share routes, and secret-authenticated webhooks. See the [generated Server API](/en/reference/server) for individual requests and responses.

## Bootstrap authentication

A fresh Server bound beyond loopback refuses to start without an administrator secret. Prefer an owner-readable file through `SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE`. Browser-driven setup through `SHUMOKU_ALLOW_WEB_SETUP` is for loopback development only.

`DEMO_MODE` seeds sample data; it does not enable anonymous access.

## Development API automation

`bun run dev:server` creates an ephemeral loopback-only credential. Use the wrapper without displaying or copying the credential.

```bash
bun run dev:server:request -- GET /api/topologies
```

This route is available only in development on loopback. Production uses session authentication.

## Sharing and webhooks

A topology or dashboard share token grants read-only access scoped to that resource. It cannot enumerate unrelated management resources. Revoke unused tokens from the corresponding settings screen.

Prefer the `X-Webhook-Secret` header for webhooks. A query parameter may be recorded in access logs.

## WebSocket

`/ws` requires an authenticated session, an allowed Origin, and `workspace:read`. Forward WebSocket upgrades through a reverse proxy. The message contract currently remains in Server source and will be extracted into a dedicated reference later.
