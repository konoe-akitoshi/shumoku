# @shumoku/server-api

HTTP + WebSocket API for the Shumoku [server](../README.md). Bun + [Hono](https://hono.dev), with an SQLite store and the data-source plugin loader. In production it also serves the built [web UI](../web).

## Run

From the repo root (recommended — starts API + web together):

```bash
bun run dev:server
```

Or just the API, from here:

```bash
cd apps/server/api
bun run dev      # API only, session authentication, → :8080
bun run start    # production
bun run build
```

For development automation, use the server-level launcher instead. It binds the
API to loopback, creates an ephemeral Bearer credential, and removes it when the
API exits:

```bash
# From the repo root
bun run dev:server
bun run dev:server:request -- GET /api/topologies
```

The direct API command does not create an automation credential. See the
[API reference](../docs/api.en.mdx#development-automation) for the authentication
and security boundaries.

Scripts: `dev`, `start`, `build`, `typecheck`, `lint`, `format`, and tests (`test`, `test:unit`, `test:db`).

## Layout

- `src/index.ts` — entry point
- `src/server.ts` — composition root: Hono app, static serving, schedulers, and WebSocket
- `src/app/services.ts` — explicit dependencies injected into migrated route modules
- `src/modules/*` — feature-local OpenAPI routes and runtime schemas
- `src/openapi/*` — shared contract, error, and security definitions
- `src/api/*` — legacy HTTP route modules being migrated incrementally
- `src/middleware/*` — cross-cutting HTTP middleware, including session and dev Bearer auth
- `src/services/*` — application and domain services used by routes and background jobs
- `src/db/*` — SQLite access, schema, and ordered migrations
- `src/discovery/*` — SNMP/LLDP deep-read infrastructure
- `src/plugins/loader.ts` — discovers bundled plugins and calls each one's `register(pluginRegistry)`
- `src/config.ts` — reads `PORT` / `HOST` / `DATA_DIR`; SQLite lives at `$DATA_DIR/shumoku.db` (default `/data`)
- `test/*` — Bun-powered SQLite integration tests; colocated `*.test.ts` files use Vitest

`GET /api/openapi.json` serves the authenticated OpenAPI 3.1 document. From the
repository root, inspect it without handling the development credential directly:

```bash
bun run dev:server:request -- GET /api/openapi.json
bun run dev:server:request -- GET /api/admin/status
```

The contract currently covers health, system/admin diagnostics, and topology
CRUD. Rendering, mapping, source attachment, and sync routes remain in
`src/api/topologies.ts` while they are migrated feature by feature.

The repository commits a deterministic contract and its generated web-client
types. Regenerate both after changing a route schema:

```bash
# From the repository root
bun run openapi:generate
bun run openapi:check
```

This updates `apps/server/api/openapi.json` and
`apps/server/web/src/lib/api.generated.ts`. The web topology CRUD client uses
those types through `openapi-fetch`; do not edit the generated file directly.
Server typechecking runs `openapi:check`, so stale generated artifacts fail CI.

Every HTTP API route must also be present either in the OpenAPI document or in
`src/openapi/legacy-operations.ts`. The API integration test
enforces this boundary. When migrating an endpoint, register it in a
feature-local `src/modules/*` OpenAPI router and remove its entry from the
legacy ledger in the same change.

See the [server README](../README.md) for the full endpoint list, environment variables, and deployment.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
