---
id: server.installation
title: Install and operate the Server
description: Deploy safely with Docker and configure TLS, updates, and backups.
locale: en
canonicalLocale: ja
slug: server/installation
status: stable
audience: operator
owner: server
canonicalDigest: fa8a3723c56cc1b57969b3173b76d5bbee3ce3944b4050b1c507d6cd91528923
related:
  - /en/guides/server/api-access
---

Use a published container in production and pin an exact version. Store the SQLite database on a persistent volume and provide the administrator password through a file or secret.

## Run with Docker

```bash
install -d -m 700 .shumoku
openssl rand -base64 32 > .shumoku/admin-password
chmod 600 .shumoku/admin-password
docker run -d --name shumoku -p 8080:8080 -v shumoku-data:/data \
  -v "$PWD/.shumoku/admin-password:/run/secrets/shumoku_admin_password:ro" \
  -e SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE=/run/secrets/shumoku_admin_password \
  ghcr.io/konoe-akitoshi/shumoku:X.Y.Z
```

Open `http://localhost:8080/login` and sign in with the generated password. Pin `X.Y.Z` in production because `latest` may change before a later restart.

To run Compose from the repository, change to `apps/server`, copy `.env.example` to `.env`, and run `docker compose up -d`. That template is the source of truth for supported variables and defaults.

## HTTPS

The Server speaks HTTP. Terminate TLS with Caddy or nginx when exposing it and set `SHUMOKU_SECURE_COOKIES=true`. Enable `SHUMOKU_TRUST_PROXY=true` only when a trusted proxy replaces client-IP headers.

The `/ws` WebSocket needs upgrade headers. Give long-running SNMP synchronization enough proxy read timeout.

## Reverse-proxy SSO (OIDC/SAML) integration

Shumoku has no built-in OIDC/SSO, but you can place an authenticating reverse
proxy in front of it ([oauth2-proxy](https://github.com/oauth2-proxy/oauth2-proxy),
Authelia, Pomerium, …) and delegate authentication to the trusted headers that
proxy sets. Turn it on with `SHUMOKU_PROXY_AUTH_ENABLED=true` (off by default).

Before enabling this mode, update API clients that validate the `authMethod`
response enum to accept `proxy`. Existing deployments with proxy mode disabled
continue returning the existing values.

The proxy mode applies consistently to HTTP APIs, authentication status, and
WebSocket upgrades. Local session cookies and development bearer credentials
are ignored while it is enabled; local setup, login, and password changes are
disabled. This prevents a stale administrator cookie from overriding an IdP
role change. No Shumoku session is issued.

Without a role header, authenticated identities receive
`SHUMOKU_PROXY_AUTH_DEFAULT_ROLE` (default `viewer`). This grants every identity
accepted by the proxy read access. To restrict membership, configure a role
header and a map, for example:

```bash
SHUMOKU_PROXY_AUTH_ENABLED=true
SHUMOKU_PROXY_AUTH_ROLE_HEADER=X-Auth-Request-Groups
SHUMOKU_PROXY_AUTH_ROLE_MAP=net-admins:admin,viewers:viewer
```

With a role header configured, missing or unrecognized groups are denied; the
default role is not a fallback. Without a map, exact role names are accepted.
For multiple comma/space-separated groups, the highest explicitly granted role
wins (`admin` > `user` > `viewer`), regardless of header order. Invalid mappings
or header names fail validation at startup.

The user header (default `X-Auth-Request-User`, with email fallback) becomes a
`proxy:`-prefixed subject, separate from local identities. Configure an immutable
IdP identifier where possible. This subject is a request identity, not a durable
internal user ID; changing identity headers can change it. Future user management
must explicitly link external identities to internal accounts.

WebSocket authorization is checked at connection time. Existing connections
retain their principal until disconnected; IdP logout or role changes do not
immediately revoke an open connection. Configure the proxy connection lifetime
and disconnect existing connections when immediate revocation is required.

The sidebar displays SSO instead of local Logout. End the session through your
organization's authentication provider; deleting a Shumoku cookie cannot end a
proxy session.

> **Security prerequisite**: this is only safe when Shumoku is reachable
> **exclusively through the proxy** and the proxy **overwrites these headers on
> every request** (stripping any client-supplied copy). If clients can reach
> Shumoku directly, or the proxy forwards client-supplied headers, a request can
> spoof any identity. Enabling it delegates authentication entirely to the proxy.

With oauth2-proxy's auth-request integration, `--set-xauthrequest=true` emits
response headers; configure the front proxy to copy those headers into upstream
requests, including WebSocket upgrades. The flag alone does not forward them to
Shumoku. Strip client-supplied identity and role headers, including the email
fallback, on every request.

A bootstrap administrator secret (`SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD*`) is still
**required on first startup**. For emergency local access, restrict network access,
set `SHUMOKU_PROXY_AUTH_ENABLED=false`, and restart before using the local password.
Simply bypassing the proxy does not enable local login. Restore proxy-only network
access and re-enable proxy mode after recovery.


| Variable | Description | Default |
|---|---|---|
| `SHUMOKU_PROXY_AUTH_ENABLED` | Enable reverse-proxy header authentication (see below) | `false` |
| `SHUMOKU_PROXY_AUTH_USER_HEADER` | Header carrying the user identifier | `X-Auth-Request-User` |
| `SHUMOKU_PROXY_AUTH_EMAIL_HEADER` | Fallback email header when the user header is absent | `X-Auth-Request-Email` |
| `SHUMOKU_PROXY_AUTH_ROLE_HEADER` | Header carrying roles/groups (optional) | — |
| `SHUMOKU_PROXY_AUTH_DEFAULT_ROLE` | Role when no role header is configured (`viewer`/`user`/`admin`) | `viewer` |
| `SHUMOKU_PROXY_AUTH_ROLE_MAP` | `group:role,group:role` mapping of groups to roles | — |

### Passing settings to the container

Set these variables in the Server process environment: Docker `-e`, a Compose
`environment` override, or the Helm chart's `env` list. The current Compose file
only forwards its listed variables; adding proxy-auth settings to `.env` alone
has no effect. Keep the Server port inaccessible to clients except through the
authenticating proxy, including when using the Docker example above.

### Troubleshooting

- Startup refuses to run: check the bootstrap secret and role-map/header validation errors.
- API returns 401: verify identity headers and a recognized group when a role header is configured. Local cookies cannot bypass this check.
- API returns 403: the identity lacks the route's permission; check the group map.
- Only WebSocket fails: forward identity/group headers on the upgrade and preserve the external Host so it matches the browser Origin.

## Update

Take a backup, change the pinned image version, and recreate the service.

```bash
docker compose pull
docker compose up -d
```

Server releases are built from `server-v*` tags. See `docs/releasing.md` in the repository for image tags and the release process.

## Back up and restore

SQLite uses WAL mode, so do not copy only a live `shumoku.db`. Briefly stop the service and archive the complete `/data` volume, or use a SQLite-aware continuous backup tool such as Litestream.

```bash
docker compose stop
docker run --rm -v shumoku-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/shumoku-backup.tgz -C /data .
docker compose start
```

Test restoration in another environment before production use. Always take a restorable backup before an update containing schema changes.
