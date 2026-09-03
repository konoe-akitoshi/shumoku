# @shumoku/docs-tooling

This workspace turns repository-owned facts into a small, renderer-independent JSON model.
Astro consumes that model, but the extractor does not depend on Astro and can be reused by a
different documentation frontend later.

```bash
bun run docs:generate
```

The current vertical slice runs TypeDoc over `@shumoku/core`, selects
`computeNetworkLayout`, and writes `apps/docs/.generated/core.json`. Both TypeDoc's raw JSON
and the normalized model are generated files and are not committed.

The symbol allowlist in `src/normalize-core.ts` is intentionally explicit while the model and
page design are proven. Expand it package by package after adding support for the relevant
symbol kinds; do not publish the entire TypeDoc graph as an accidental public API.

TypeDoc warnings are currently visible during generation. They identify exported declarations
that refer to non-exported types or links outside this slice. Treat them as public-contract
backlog rather than suppressing them globally.

Generation is deterministic and must not call AI or LLM services. Human-authored guides remain
separate from this pipeline.
