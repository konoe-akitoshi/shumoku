# @shumoku/docs

Shumoku's fully static, bilingual documentation site. It uses Astro as a thin
presentation layer and does not use Starlight.

```bash
bun run dev
bun run typecheck
bun run build
```

Each command first runs the deterministic reference generator in `tooling/docs`.
`build` then creates `dist/` and indexes it with Pagefind. Search assets do not
exist during `astro dev`, so the search component degrades quietly in development.

Reference generation is intentionally outside Astro. Future TypeDoc, OpenAPI,
schema, and CLI analysis belongs in a separate `tooling/docs` workspace that emits
plain content consumed by this app. CI and builds must stay deterministic and must
not call AI or LLM services.

The initial vertical slices publish `@shumoku/core.computeNetworkLayout` at
`/:lang/reference/core/computeNetworkLayout/` and the topology list/create Server operations
under `/:lang/reference/server/`. See
[`tooling/docs/README.md`](../../tooling/docs/README.md) for how that scope expands.

From the repository root, `bun run docs:check` builds the production site, confirms the source
inventory, regenerates references a second time to catch nondeterministic output, and validates
all internal links in the built HTML.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the website/docs deployment boundary.
