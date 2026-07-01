# assets/ — canonical brand assets

This directory is the **single source of truth** for Shumoku brand assets:
the leaf logo (symbol / horizontal wordmark), the favicon set, and the SVG
path data as TypeScript constants (`brand.ts`).

Nothing here is served or bundled directly. Every consumer takes the assets
through one of three mechanisms, each chosen to work around a different
tooling constraint:

| Consumer | Mechanism | Why not a direct reference |
|---|---|---|
| `apps/server/web/static/*` | **git symlink** into `/assets` | SvelteKit serves `static/` as-is; symlinks keep it in sync automatically |
| `apps/docs/public/logo-symbol.svg` | **plain copy** | Vercel deployments don't follow the symlinks (see 58802651) |
| `docs/slides/images/*` | **plain copy** | the slide deck is a self-contained, portable artifact |
| `apps/docs/lib/og-brand.tsx` | direct import of `brand.ts` | Next.js can import from the monorepo root |
| `libs/@shumoku/renderer-svg/src/brand.ts` | **hand-maintained TS mirror** | tsc `rootDir: ./src` can't import outside the package |

## Known weaknesses (deliberate trade-offs, not surprises)

- **The renderer mirror is synced by hand.** `libs/@shumoku/renderer-svg/src/brand.ts`
  duplicates `LOGO_VIEWBOX` / `LOGO_PATHS`, and nothing in the type system
  connects the two files. This is the copy most likely to drift, and it ships
  in a published npm package.
- **Plain copies drift silently.** A logo update that forgets `apps/docs/public/`
  or `docs/slides/images/` fails no build.
- **Symlinks degrade on Windows.** Without symlink support enabled
  (`git config core.symlinks true` + Developer Mode), git checks the
  `apps/server/web/static/` links out as small text files containing the link
  target, so favicons are broken in local dev on such checkouts. CI and
  production builds (Linux) are unaffected.

To keep these trade-offs honest, CI runs `scripts/check-brand-assets.ts`
(`bun run check:brand-assets`) in the lint job. It byte-compares every copy
(following the symlinks-as-text-files case) and deep-compares the TS mirror
constants, so content drift fails the build even though the duplication
itself remains.

## Updating the logo or favicons

1. Replace the file(s) in `/assets`.
2. Re-copy the plain copies listed above (`apps/docs/public/`, `docs/slides/images/`).
3. If `brand.ts` changed, update the mirror in
   `libs/@shumoku/renderer-svg/src/brand.ts` (and add a changeset — it's a
   published package).
4. Regenerate the favicon set from `favicon.svg` if the mark itself changed.
5. Run `bun run check:brand-assets` — it must pass before CI will.

## If this ever becomes painful

The structural fix is to promote this directory to a private workspace
package (`@shumoku/brand`): the renderer would then depend on it like any
other package and the hand-synced mirror disappears; the web apps would copy
from the package at build time. We haven't done it because the brand changes
rarely and the check script catches drift — revisit if either stops being true.
