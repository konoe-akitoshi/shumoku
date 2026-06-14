# apps/

End-user applications built on the Shumoku libraries.

| App | Package | What it is |
|-----|---------|-----------|
| [`server`](server) | `@shumoku/server` | Real-time monitoring platform — Bun + Hono API with SQLite, and a SvelteKit web UI. Connect data sources, overlay live metrics, build dashboards, share read-only views. Split into [`api`](server/api) and [`web`](server/web). |
| [`editor`](editor) | `@shumoku/editor` | Visual designer for **physical** topologies — devices / modules / cables as products, a diagram canvas, and a derived bill of materials. |
| [`cli`](cli) | `@shumoku/cli` | `shumoku render` — turn a YAML/JSON `NetworkGraph` into SVG / HTML / PNG. |
| [`docs`](docs) | `@shumoku/docs` | The documentation site at [shumoku.dev](https://www.shumoku.dev) (Next.js + Fumadocs, bilingual EN/JA). |

Each app has its own README with setup and usage. Most run from the repo root via Turborepo:

```bash
bun install
bun run dev            # every app in dev mode
bun run dev:server     # just the server (API :8080 + web UI :5173)
```

See the root [README](../README.md) and [CONTRIBUTING](../CONTRIBUTING.md).
