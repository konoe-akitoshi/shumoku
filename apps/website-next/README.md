# SvelteKit website migration preview

Run `bun --cwd apps/website-next dev --port 4340` from the repository root.
English and Japanese home pages are prerendered; no SPA fallback or runtime API
is needed. The explicit Vercel adapter emits static pages for both languages.

This is a parallel preview, not a production cutover. `apps/website` continues
serving existing URLs. Shared copy lives in `tooling/website-content`; assets
temporarily remain owned by `apps/website/public`.

Before cutover:
- Decide whether Playground moves here or is consolidated into Editor.
- Port the project-background, adopters and commercial partner presentation.
- Inventory and test legacy Docs, Editor, search, OG and layout API URLs. Redirect
  editorial URLs to exact destinations; do not blindly redirect API requests.
- Move assets into the new website and remove the temporary asset dependency.
- Verify canonical/hreflang, social images, sitemap, robots and machine discovery.
- Compare desktop/mobile accessibility, bundle sizes and live preview performance.
- Change the existing Vercel project root/preset only after preview approval;
  retire Next/Fumadocs and rename this app to `apps/website` in the cutover PR.

Do not merge a hosting configuration change before these steps are complete.
