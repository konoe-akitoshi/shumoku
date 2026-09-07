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

### Event announcement

`src/lib/announcement.ts` is the source for the temporary header announcement and the
permanent connpass community URL. Edit the localized labels, destination and timezone-explicit
`expiresAt` when replacing the event. The notice appears on content pages, not Playground.
It is evaluated after hydration against the visitor's clock and expires while the page is open,
without a new deployment or network request. With JavaScript disabled only the permanent footer
community link is shown, avoiding stale announcements in prerendered HTML.

### Vercel Web Analytics

- Uses `@vercel/analytics/sveltekit` for initial and client-side page views; do not add manual pageview listeners.
- Shares GA4's deferred initialization, production-host guard, region policy and saved analytics choice.
- The SDK initializes once. `beforeSend` blocks rejected/custom events and removes query strings and hashes.
- Enable **Web Analytics** for the existing HP project in the Vercel dashboard before deploying this PR. No new Vercel project, paid upgrade or Speed Insights is required by this code.
- After deployment verify `/_vercel/insights/*` requests and page views in the dashboard, including SPA navigation and rejection. Local/preview visits intentionally send nothing.
- Dashboard enablement and live ingestion cannot be validated by the local build. GA4 and Vercel may report different totals due to their different counting methods.

### GA4 and regional analytics preferences

The website uses `vanilla-cookieconsent` and Google tag `G-SHX2VE8F8F`.
The localized layout schedules the optional client chunk after window load and
browser idle (2-second idle deadline). Consent JS/CSS is dynamically imported;
neither the policy request nor Google tag blocks initial rendering.
Pages remain prerendered. Only `/api/analytics-policy` is a runtime endpoint.
It reads Vercel's country header and returns no-store, private responses; do not
cache its result globally, infer location from language, or accept country query overrides.

- Only a production build on www.shumoku.dev / shumoku.dev and a production
  Vercel policy response can enable collection. Local/preview never loads Google.
- JP: opt-out without an automatic banner. Saved rejections always take priority.
- Other/unknown countries: Basic consent gating; no Google tag before acceptance.
- Policy failure/timeout (1.5 seconds): no tracking and no automatic banner.
- Choices expire after 180 days. Region is rechecked once per full document load,
  not on SPA navigation. An implicit JP default is not saved as explicit consent.
- Preferences remain accessible from the footer and /{lang}/privacy. Revoking
  analytics clears host-only GA cookies and reloads to remove loaded tag listeners.
- Signals, advertising storage and personalization are disabled. No custom events
  containing Playground contents or uploaded file names are implemented.

**GA4 dashboard setup before launch:** keep Enhanced Measurement Page Views
enabled, including “Page changes based on browser history events”. This is the
sole page-view producer: do not add afterNavigate page_view calls, a duplicate
gtag snippet or a GTM history trigger. Other Enhanced Measurement options
(especially site search, forms and file downloads) should be reviewed/disabled
if their URL or filename data is not needed. Confirm retention and data-sharing
settings in the property, and review the privacy notice and JP opt-out policy
against your actual processing obligations; this implementation is not a legal determination.

After deployment verify a single initial/SPA page_view in GA4 DebugView and
network behavior for JP, non-JP, unknown country, saved rejection and withdrawal.
The local preference dialog can be opened via the footer without sending to Google.
Library/controller tests mock Google; they do not pollute the production property.
Official references:
[SPA tracking](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications),
[CookieConsent configuration](https://cookieconsent.orestbida.com/reference/configuration-reference.html).

Keep Vercel shumoku-docs Root Directory at `apps/website`. `vercel.json` overrides
the old framework/build settings with SvelteKit and builds workspace dependencies
through Turbo. Leave Output Directory automatic; remove any dashboard .next
override before cutover. No Vercel dashboard changes are made by this commit.

Validate the Preview Deployment, particularly redirects and the layout API,
before production promotion. Review the temporary archived-source destinations
above. Roll back by promoting the prior Vercel deployment; the old implementation
also remains in Git history before the replacement commit.

Run `bun --cwd apps/website test`, `typecheck`, `build`, and `bun run docs:check`.
