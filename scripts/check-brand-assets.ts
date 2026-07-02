/**
 * Verify that every copy / mirror of the canonical brand assets in /assets
 * is still in sync. See assets/README.md for why these duplicates exist at
 * all (symlink, plain copy, and TS mirror — each for a different tooling
 * constraint) and for the update checklist.
 *
 * Run: bun scripts/check-brand-assets.ts   (CI runs this in the lint job)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')

/**
 * Read a file, following git symlinks by hand when needed: on Windows
 * checkouts without symlink support, git materializes a symlink as a small
 * text file whose content is the link target path.
 */
function readAsset(relPath: string): Buffer {
  const abs = resolve(root, relPath)
  const buf = readFileSync(abs)
  if (buf.length < 256) {
    const text = buf.toString('utf8').trim()
    if (/^[\w./-]+$/.test(text)) {
      const target = resolve(dirname(abs), text)
      if (existsSync(target)) return readFileSync(target)
    }
  }
  return buf
}

function normalizeText(buf: Buffer): string {
  return buf.toString('utf8').replaceAll('\r\n', '\n')
}

interface Pair {
  canonical: string
  copy: string
  binary?: boolean
}

const pairs: Pair[] = [
  // SvelteKit statics are git symlinks into /assets (resolved above).
  { canonical: 'assets/logo-symbol.svg', copy: 'apps/server/web/static/logo-symbol.svg' },
  { canonical: 'assets/favicon.svg', copy: 'apps/server/web/static/favicon.svg' },
  { canonical: 'assets/favicon.ico', copy: 'apps/server/web/static/favicon.ico', binary: true },
  {
    canonical: 'assets/favicon-96x96.png',
    copy: 'apps/server/web/static/favicon-96x96.png',
    binary: true,
  },
  {
    canonical: 'assets/apple-touch-icon.png',
    copy: 'apps/server/web/static/apple-touch-icon.png',
    binary: true,
  },
  {
    canonical: 'assets/web-app-manifest-192x192.png',
    copy: 'apps/server/web/static/web-app-manifest-192x192.png',
    binary: true,
  },
  {
    canonical: 'assets/web-app-manifest-512x512.png',
    copy: 'apps/server/web/static/web-app-manifest-512x512.png',
    binary: true,
  },
  // Real copies: Vercel deploys can't follow the symlinks (see assets/README.md).
  { canonical: 'assets/logo-symbol.svg', copy: 'apps/docs/public/logo-symbol.svg' },
  { canonical: 'assets/logo-horizontal.svg', copy: 'apps/docs/public/logo-horizontal.svg' },
  // Real copies: the slide deck is a self-contained artifact.
  { canonical: 'assets/logo-symbol.svg', copy: 'docs/slides/images/logo-symbol.svg' },
  { canonical: 'assets/logo-horizontal.svg', copy: 'docs/slides/images/logo-horizontal.svg' },
]

let failed = false

function fail(message: string): void {
  failed = true
  console.error(`✗ ${message}`)
}

for (const { canonical, copy, binary } of pairs) {
  if (!existsSync(resolve(root, copy))) {
    fail(`${copy} is missing (expected a copy of ${canonical})`)
    continue
  }
  const a = readAsset(canonical)
  const b = readAsset(copy)
  const equal = binary ? a.equals(b) : normalizeText(a) === normalizeText(b)
  if (equal) {
    console.log(`✓ ${copy}`)
  } else {
    fail(`${copy} differs from ${canonical} — re-copy it from /assets`)
  }
}

// The renderer mirror duplicates the TS constants because tsc's rootDir
// prevents importing from the monorepo root. Compare the shared exports.
const canonicalBrand = await import('../assets/brand')
const mirrorBrand = await import('../libs/@shumoku/renderer-svg/src/brand')

if (canonicalBrand.LOGO_VIEWBOX !== mirrorBrand.LOGO_VIEWBOX) {
  fail('LOGO_VIEWBOX differs between assets/brand.ts and renderer-svg/src/brand.ts')
} else if (JSON.stringify(canonicalBrand.LOGO_PATHS) !== JSON.stringify(mirrorBrand.LOGO_PATHS)) {
  fail('LOGO_PATHS differs between assets/brand.ts and renderer-svg/src/brand.ts')
} else {
  console.log('✓ libs/@shumoku/renderer-svg/src/brand.ts (TS mirror)')
}

if (failed) {
  console.error(
    '\nBrand asset copies are out of sync. See assets/README.md for the update checklist.',
  )
  process.exit(1)
}
console.log('\nAll brand asset copies are in sync.')
