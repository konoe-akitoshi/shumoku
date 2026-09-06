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
exist during `astro dev`, so it shows an availability notice. Use `bun run build`
followed by `bun run preview` to test search. Pagefind loads the current HTML
language's index. Global search includes shared documents and the current public
Server release; versioned Server pages search only their selected version.

Reference generation is intentionally outside Astro. Future TypeDoc, OpenAPI,
schema, and CLI analysis belongs in a separate `tooling/docs` workspace that emits
plain content consumed by this app. Shared contracts and navigation live in
`tooling/docs/src/model`; generation never imports from the site. Docs builds and
typechecks bypass Turbo caching because their sources span the repository and
release discovery depends on external state. CI and builds must stay deterministic and must
not call AI or LLM services.

The public information architecture is product-first: `/:lang/library/` contains
the topology schema and TypeScript API, `/:lang/cli/` contains command reference,
and `/:lang/server/` contains version-matched guides, API, and bundled data
sources. Repository ownership remains code-first; those routes are generated
from `libs/`, `apps/cli`, and `apps/server` rather than being authored as a second
site-shaped content tree. Old `reference/*` and `guides/server/*` URLs are
non-indexed compatibility redirects.

The Core reference publishes every public function exposed by TypeDoc, and the
Server reference publishes every operation in the checked-in OpenAPI contract.
Plugin reference pages are generated from bundled plugin descriptors and the
Manual source descriptor, including capabilities and configuration schemas.
The CLI reference comes from the same typed command model used by argument
parsing and `--help`. See
[`tooling/docs/README.md`](../../tooling/docs/README.md) for how that scope expands.

The YAML reference is generated from the Zod runtime schema used by `YamlParser`. Its
getting-started example is stored once in `examples/getting-started.yaml` and is parsed, laid out,
and rendered during `docs:check`.

Server releases produce one immutable, digest-verified artifact containing the
OpenAPI model, bundled plugin descriptors, and localized Server guides. Local
builds expose the working tree at `/:lang/server/next`; production can set
`SHUMOKU_DOCS_SERVER_RELEASES=github` to build exact release URLs and derive the
stable and beta aliases from GitHub Release assets. No versioned Markdown copies
are committed.

User workflows that cannot live in API comments use colocated
`*.guide.en.md` / `*.guide.ja.md` files under an owning app's `docs` directory or
beside its UI route. UI workflows may point to a typed `*.journey.ts`; generation
then verifies that its stable `data-doc-step` anchors still exist in the UI.
A digest on translated guides makes `docs:check` fail with an actionable message
when the canonical text changes. Concept and operations guides do not need to
invent a journey when no UI flow exists.

From the repository root, `bun run docs:check` builds the production site, confirms the source
inventory, regenerates references a second time to catch nondeterministic output, and validates
all internal links in the built HTML. It also requires the legacy route inventory
to match every English MDX page still served by the website.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the website/docs deployment boundary.
