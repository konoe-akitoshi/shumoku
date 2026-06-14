# @shumoku/docs

The documentation site for [Shumoku](https://github.com/konoe-akitoshi/shumoku), published at **[shumoku.dev](https://www.shumoku.dev/)**. Built with [Next.js](https://nextjs.org) and [Fumadocs](https://fumadocs.dev), with English and Japanese content.

## Develop

```bash
bun install            # from the repo root
cd apps/docs
bun run dev            # http://localhost:3000
```

| Script | Purpose |
|--------|---------|
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Production build |
| `bun start` | Serve the production build |
| `bun run typecheck` | Type check (runs the Fumadocs MDX generator first) |

## Content

Docs are MDX files under `content/docs/`, organized into two trees:

- **`server/`** — installation, data sources, topologies, dashboards, REST API
- **`npm/`** — YAML reference, vendor icons, custom integration, NetBox

Each page is bilingual via filename suffix — `installation.en.mdx` and `installation.ja.mdx`. A page is fully translated when both variants exist. Full-text search is served from `app/api/search/route.ts`, and the content source adapter is wired in `lib/source.ts`.

## Adding a page

1. Create `content/docs/<section>/<slug>.en.mdx` (and `.ja.mdx` for Japanese).
2. Add frontmatter (`title`, `description`) and, if needed, an entry in the section's `meta.json` to order it in the sidebar.
3. `bun run dev` and verify both languages render.

Frontmatter schema and MDX options live in `source.config.ts`.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
