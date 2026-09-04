# @shumoku/docs-tooling

This workspace turns repository-owned facts into a small, renderer-independent JSON model.
Astro consumes that model, but the extractor does not depend on Astro and can be reused by a
different documentation frontend later.

```bash
bun run docs:generate
```

The current vertical slices:

- run TypeDoc over `@shumoku/core`, select `computeNetworkLayout`, and write
  `apps/docs/.generated/core.json`;
- verify the code-generated Server OpenAPI artifact is current, select the topology list/create
  operations, and write `apps/docs/.generated/server.json`;
- read the same typed CLI command model used by `parseArgs` and help output, and write
  `apps/docs/.generated/cli.json`.

TypeDoc's raw JSON and both normalized models are generated files and are not committed.

The symbol allowlist in `src/normalize-core.ts` is intentionally explicit while the model and
page design are proven. Expand it package by package after adding support for the relevant
symbol kinds; do not publish the entire TypeDoc graph as an accidental public API.

TypeDoc warnings are currently visible during generation. They identify exported declarations
that refer to non-exported types or links outside this slice. Treat them as public-contract
backlog rather than suppressing them globally.

Generation is deterministic and must not call AI or LLM services. Human-authored guides remain
separate from this pipeline.

`docs.sources.json` is the minimal source inventory. `bun run docs:check` from the repository
root builds the site and checks that every inventoried source/output exists, a second generation
produces identical output, and every internal link in the built HTML resolves.
