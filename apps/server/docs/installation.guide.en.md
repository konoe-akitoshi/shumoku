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
canonicalDigest: 909fbf68e434d692a04cbaf3b9c672d3d497d409f4a31e79bd627c1d8e714c96
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
