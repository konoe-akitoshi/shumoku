# @shumoku/server-web

SvelteKit web UI for the Shumoku [server](../README.md) — topology viewer with live metrics, dashboards, data-source configuration, and shareable read-only views.

## Run

From the repo root (recommended — brings up the API first, then this):

```bash
bun run dev:server
```

Or just the web UI, from here (needs the API running on `:8080`):

```bash
cd apps/server/web
bun run dev       # Vite dev server on :5173 — proxies /api and /ws → :8080
bun run build
bun run preview
```

Scripts: `dev`, `build`, `preview`, `typecheck`, `check`, `lint`, `format`, `test`.

## Stack

Svelte 5 + SvelteKit, Vite, Tailwind CSS, [gridstack](https://gridstackjs.com) (dashboard grid), and bits-ui. Diagram rendering and interaction reuse the shared engine in [`@shumoku/renderer`](../../../libs/@shumoku/renderer).

## Pages

`src/routes/(app)`: home, `topologies`, `dashboards`, `datasources`, `plugins`, `settings`. Plus top-level `login` and `share/:token` (public, token-gated).

In production the built output is served by [`@shumoku/server-api`](../api) on the same port (`8080`).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
