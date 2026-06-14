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
bun run dev      # NODE_ENV=development bun --watch src/index.ts  → :8080
bun run start    # production
bun run build
```

Scripts: `dev`, `start`, `build`, `typecheck`, `lint`, `format`, and tests (`test`, `test:unit`, `test:db`).

## Layout

- `src/index.ts` — entry point
- `src/server.ts` — Hono app: static serving, health checker, WebSocket
- `src/api/*` — route modules: `auth`, `share`, `datasources` (+ `scan`), `plugins`, `topologies` (+ `sources`, `observations`, `resolved`, `discovery-policy`), `dashboards`, `settings`, `webhooks`, and `runtime.js`
- `src/plugins/loader.ts` — discovers bundled plugins and calls each one's `register(pluginRegistry)`
- `src/config.ts` — reads `PORT` / `HOST` / `DATA_DIR`; SQLite lives at `$DATA_DIR/shumoku.db` (default `/data`)

See the [server README](../README.md) for the full endpoint list, environment variables, and deployment.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
