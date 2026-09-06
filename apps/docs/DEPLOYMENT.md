# Website and docs deployment boundary

## Machine-readable discovery

The Docs build automatically emits `sitemap.xml`, a concise `/llms.txt`, scoped
language/product/Server-version indexes, and a `.md` mirror for each canonical
documentation page (for example `/ja/library.md`). Markdown is converted from
the rendered main content, including code, tables, source links and release
warnings, not from an independently maintained summary. HTML advertises its
Markdown alternate. Redirects and noindex recovery pages are excluded.

Server versions remain separate; `next` is never labelled as stable. No combined
all-version context dump is generated. Library/CLI track current source. These
files help retrieval tools; they do not guarantee AI citations or search ranking.
Existing crawler policy remains unchanged. Check the Cloudflare/WAF bot policy
separately if a specific crawler cannot retrieve otherwise public pages.

The two applications are separate deployable units. Do not configure a deployment
from the repository root.

| Unit | Root directory | Build command | Output | Purpose |
| --- | --- | --- | --- | --- |
| Website | `apps/website` | `bun run build` | `.next` | Existing Next.js homepage, Fumadocs pages, Playground, and Editor routes |
| Docs | `apps/docs` | `bun run build` | `dist` | Fully static Astro documentation and Pagefind index |

Install dependencies from the repository root with `bun install --frozen-lockfile`
before either build. Give each deployment its own cache and environment-variable
scope. A docs deployment does not require the website's runtime variables.

## Hosting decision (2026-09-06)

- Website: the existing Vercel `shumoku-docs` project, with Root Directory
  `apps/website` and the Next.js preset. The project name is historical.
- Docs: Cloudflare Pages `shumoku-docs`, with custom domain `docs.shumoku.dev`.
- Docs production branch: `main` (the website/docs split has been merged).
- Cloudflare root: repository root; output: `apps/docs/dist`; `BUN_VERSION=1.3.4`.
  Build command: `bun install --frozen-lockfile && bun x turbo run build --filter=@shumoku/docs --env-mode=loose`.
  Building through Turbo builds the workspace dependencies before reference generation.

- Bootstrap publication uses `next`. Existing Server releases do not yet have docs
  artifacts. Enable GitHub release discovery only after a release provides one;
  never relabel working-tree docs as a published Server release.
- Changing Vercel's root affects future builds, not the already-serving deployment.

Docs uses Astro `build.format: 'file'` and extensionless URLs without trailing
slashes. Cloudflare Pages serves these directly; directory output would add a
redirect to every navigation. The layout normalizes Astro's build-time `.html`
pathname for navigation, language/version switching, and Pagefind result URLs.
Astro ClientRouter swaps documents without full browser reloads. Visible sidebar
links prefetch on viewport entry; other internal links prefetch on hover/focus.
Search destroys its Pagefind UI and document listeners before each swap, while
the responsive sidebar refreshes on `astro:page-load`. No transition animation
is added to delay reading.

### Recovery from pre-migration redirect caches

The earlier directory build permanently redirected `/path` to `/path/`; file
output redirects in the opposite direction. Returning browsers may cache the old
308 and loop even though a fresh browser works. Do not reverse this URL policy
again or add another redirect as a workaround.

Open `https://docs.shumoku.dev/recover` directly in the affected browser. Its
`Clear-Site-Data: "cache"` header requests clearing only this origin's HTTP cache,
not cookies or storage. The page is outside ClientRouter, not linked for prefetch,
and uses `no-store`. If the browser does not support cache clearing, clear cached
files manually. This is a recovery step, not a header to apply to every page.
Cloudflare cache purges do not clear redirects stored in visitors' browsers.

## Vercel preview (optional alternative for Docs)

Create a separate Vercel project with `apps/docs` as its Root Directory. The
committed `vercel.json` installs the monorepo from the repository root, builds
Astro and Pagefind, and serves `dist`. Keep “Include source files outside of the
Root Directory in the Build Step” enabled because reference generation reads
`libs/`, `tooling/`, and `apps/server/`.

Before attaching a production domain, verify both locales, Pagefind search, the
Core and Server indexes, the YAML example, and the Server topology guide on the
preview URL. Preview builds need no environment variables and publish the current
Server source under `/en/server/next` and `/ja/server/next`.

Production builds set `SHUMOKU_DOCS_SERVER_RELEASES=github`. The build then reads
public GitHub Releases, downloads the digest-verified `server-docs-X.Y.Z.json`
assets, and retains every release with a documentation artifact (including betas).
Releases predating documentation artifacts are skipped. Beta-only repositories are
supported. Release discovery is paginated; old version URLs do not expire as new
versions are published. `SHUMOKU_DOCS_STABLE_VERSIONS` is no longer used.
The default entry prefers stable, then beta, then local next. Rebuild Docs after
publishing a release to update the static version list.
New artifacts include localized navigation snapshots. Existing artifacts without
snapshots retain the legacy navigation fallback. Version switching preserves the
guide/page ID or API/plugin identifier when available, otherwise opens the version home.
Documentation asset uploads refuse to overwrite an existing release asset.
Identical uploads succeed on retry; differing bytes fail without replacing the asset.
After publication, the release workflow calls the optional `DOCS_DEPLOY_HOOK`
repository secret. Configure it with the Docs project's Cloudflare Pages Deploy Hook during
deployment migration, targeting the production branch. Without it the workflow
emits a notice and an explicit rebuild is still required.
CI builds stable, archived stable, and beta fixtures without network access via
`bun --cwd tooling/docs check:versions`, including version switch and internal links.
Use `GITHUB_TOKEN` only when the unauthenticated GitHub API rate limit is too low.
Release assets are produced by `server-release.yml`; production never presents
the current `main` checkout as `latest`.

## Cloudflare Pages

Use the repository-root build settings above so workspace packages are available
before reference generation. `public/_headers` carries the static cache and security
headers.

The project name, production domain, DNS, and credentials are owner decisions and
are deliberately not committed here. Keep the existing website deployment rooted
at `apps/website` after the rename. Do not enable old-route redirects or remove
Fumadocs until the new preview has been accepted.

## Cutover checklist

1. Run `bun run docs:check` at the commit being deployed.
2. Accept the Cloudflare Pages deployment, including a mobile-width pass.
3. Attach `docs.shumoku.dev` and verify TLS and cache headers.
4. Apply redirects from the website only for rows marked `ready` in
   `tooling/docs/migration.routes.json`.
5. Remove legacy Fumadocs routes only after all rows are `ready`.
