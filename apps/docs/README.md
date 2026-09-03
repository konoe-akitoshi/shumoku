# @shumoku/docs

Shumoku's fully static, bilingual documentation site. It uses Astro as a thin
presentation layer and does not use Starlight.

```bash
bun run dev
bun run typecheck
bun run build
```

`build` creates `dist/` and then indexes it with Pagefind. Search assets do not
exist during `astro dev`, so the search component degrades quietly in development.

Reference generation is intentionally outside Astro. Future TypeDoc, OpenAPI,
schema, and CLI analysis belongs in a separate `tooling/docs` workspace that emits
plain content consumed by this app. CI and builds must stay deterministic and must
not call AI or LLM services.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the website/docs deployment boundary.
