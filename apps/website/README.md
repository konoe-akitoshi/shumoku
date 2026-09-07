# Shumoku website

SvelteKit homepage and Playground. Run `bun --cwd apps/website dev --port 4340`.
There is one website application; the migration-only website-next workspace is removed.

## Boundaries

- `src/routes/[lang=lang]/+layout.svelte`: shared shell, header/footer, styling and locale.
- `src/lib/layout/`: site header, footer and reusable page heading.
- `src/lib/site.ts`: localized page registry, navigation and content/workspace modes.
- `src/lib/home/`: existing homepage sections; copy in `tooling/website-content`.
- `src/lib/playground/`: input UI, shared Svelte renderer/camera, parsing and exports.
- `src/lib/PageMeta.svelte`: canonical, language and social metadata.
- `public/`: owned website assets, with unchanged public URLs.
- Docs stay in `apps/docs` on Cloudflare; Editor stays in `apps/editor`.

Home, About, Support and Playground pages are prerendered in both languages. The legacy layout API remains a Vercel
function; Playground computes locally and does not depend on it. HTML export's
standalone runtime is lazy loaded and is not part of the homepage bundle.

The unprefixed `/` is a runtime-only 307 language selector. It uses the saved manual
preference, then weighted `Accept-Language`, then English, with `private, no-store`
and `Vary: Accept-Language, Cookie`. Explicit `/ja` and `/en` URLs stay static and
are never overridden. `@shumoku/site-i18n` shares the policy with Docs; manual
selection saves a one-year preference across `shumoku.dev` (host-only on previews).

## Compatibility

`src/lib/legacy.ts` uses `tooling/docs/migration.routes.json`. Ready documentation
routes redirect to the matching Docs page, preserving language. Pending/partial
routes temporarily redirect to their original MDX at a pinned GitHub commit (so
Preview links also work before merge). Those sources are now preserved in
`tooling/docs/legacy-content`; they are **not** marked migrated. Old Markdown links
use the corresponding Markdown/raw source. Unknown URLs return 404.

- `/editor`, `/{lang}/editor` → standalone Editor.
- `/playground` → `/en/playground`.
- `/api/layout/compute` → same POST response shape; malformed requests return 400.
- `/api/search` → 410 JSON with the new Docs URL (no HTML redirect for API clients).
- Old OG URLs → existing topology screenshot; the old generated branded card is retired.
- `/llms-full.txt` → current Docs discovery index, not an all-version dump.

The header links directly to Docs instead of embedding the retired Fumadocs search.

## Adding pages

Add a route under `src/routes/[lang=lang]/` with the same prerender entries as About.
Register its path and localized navigation label in `sitePages` in `src/lib/site.ts`;
the header and sitemap consume that list. Use `PageMeta`, `PageHeading` and a
`<main id="main">` for a content page. Keep content inside `.site-container` and use
`.site-section` for consistent spacing. The shared layout owns the header/footer;
do not copy them into routes. The `workspace` mode omits the footer for tools such
as Playground. Footer groups remain intentionally curated.

The homepage presents the product, features, integrations, examples and setup.
Project background lives at `/{lang}/about`; commercial assistance and team use
live at `/{lang}/support`, reusing the original sections and translated copy.

## Deployment / rollback

Keep Vercel shumoku-docs Root Directory at `apps/website`. `vercel.json` overrides
the old framework/build settings with SvelteKit and builds workspace dependencies
through Turbo. Leave Output Directory automatic; remove any dashboard .next
override before cutover. No Vercel dashboard changes are made by this commit.

Validate the Preview Deployment, particularly redirects and the layout API,
before production promotion. Review the temporary archived-source destinations
above. Roll back by promoting the prior Vercel deployment; the old implementation
also remains in Git history before the replacement commit.

Run `bun --cwd apps/website test`, `typecheck`, `build`, and `bun run docs:check`.
