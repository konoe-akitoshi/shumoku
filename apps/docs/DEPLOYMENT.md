# Website and docs deployment boundary

The two applications are separate deployable units. Do not configure a deployment
from the repository root.

| Unit | Root directory | Build command | Output | Purpose |
| --- | --- | --- | --- | --- |
| Website | `apps/website` | `bun run build` | `.next` | Existing Next.js homepage, Fumadocs pages, Playground, and Editor routes |
| Docs | `apps/docs` | `bun run build` | `dist` | Fully static Astro documentation and Pagefind index |

Install dependencies from the repository root with `bun install --frozen-lockfile`
before either build. Give each deployment its own cache and environment-variable
scope. A docs deployment does not require the website's runtime variables.

## Vercel preview

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
Use `GITHUB_TOKEN` only when the unauthenticated GitHub API rate limit is too low.
Release assets are produced by `server-release.yml`; production never presents
the current `main` checkout as `latest`.

## Cloudflare alternative

For Cloudflare Pages, create a distinct project manually with `apps/docs` as the
root directory, `bun run build` as the build command, and `dist` as the output
directory. `public/_headers` carries the equivalent static cache and security
headers.

The project name, production domain, DNS, and credentials are owner decisions and
are deliberately not committed here. Keep the existing website deployment rooted
at `apps/website` after the rename. Do not enable old-route redirects or remove
Fumadocs until the new preview has been accepted.

## Cutover checklist

1. Run `bun run docs:check` at the commit being deployed.
2. Accept the Vercel preview, including a mobile-width pass.
3. Attach `docs.shumoku.dev` and verify TLS and cache headers.
4. Apply redirects from the website only for rows marked `ready` in
   `tooling/docs/migration.routes.json`.
5. Remove legacy Fumadocs routes only after all rows are `ready`.
