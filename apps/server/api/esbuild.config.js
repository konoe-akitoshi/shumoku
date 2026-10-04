import { copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const buildInfoDefines = {
  __SHUMOKU_VERSION__: JSON.stringify(process.env.SHUMOKU_VERSION ?? 'development'),
  __SHUMOKU_COMMIT__: JSON.stringify(process.env.SHUMOKU_COMMIT ?? ''),
  __SHUMOKU_BUILD_DATE__: JSON.stringify(process.env.SHUMOKU_BUILD_DATE ?? ''),
  __SHUMOKU_CHANNEL__: JSON.stringify(process.env.SHUMOKU_CHANNEL ?? 'development'),
}

await esbuild.build({
  entryPoints: ['dist/api/src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'esnext',
  format: 'esm',
  outfile: 'dist/bundle.js',
  external: ['bun:sqlite', 'bun', '@resvg/resvg-js', 'jsdom'],
  define: buildInfoDefines,
  loader: { '.sql': 'text' },
  alias: {
    '@shumoku/renderer-html/iife-string': path.resolve(
      __dirname,
      '../../../libs/@shumoku/renderer-html/dist/iife-string.js',
    ),
  },
})

// The derivation Worker is its OWN entry point: it is spawned at runtime via
// `new Worker(url)`, so the main bundle never imports it and esbuild won't
// pick it up. Ship it as a sibling bundle — derivation.ts resolves
// `./derive-worker.js` next to the running entry in production.
await esbuild.build({
  entryPoints: ['dist/api/src/services/derive-worker.js'],
  bundle: true,
  platform: 'node',
  target: 'esnext',
  format: 'esm',
  outfile: 'dist/derive-worker.js',
  external: ['bun:sqlite', 'bun'],
  define: buildInfoDefines,
})

// The sandbox's guest prelude (Buffer, AbortController, and shims for gaps in
// quickjs-wasi's native URL/URLSearchParams) is evaluated *inside* each
// plugin VM, not by Node/Bun, so it needs its own plain-script (non-ESM)
// bundle — quickjs-vm.ts resolves `./guest-prelude.js` next to the running
// entry in production, matching the derive-worker.js sibling-bundle pattern
// above. `platform: 'neutral'` with `mainFields: ['main']` is deliberate:
// `--platform=browser` makes esbuild prefer abort-controller's `browser`
// field, which assumes a native AbortController already exists (a no-op
// passthrough) instead of its real polyfill.
await esbuild.build({
  entryPoints: ['dist/api/src/plugins/sandbox/guest-prelude-entry.js'],
  bundle: true,
  platform: 'neutral',
  mainFields: ['main'],
  target: 'esnext',
  format: 'iife',
  outfile: 'dist/guest-prelude.js',
})

// The sandbox engine and its native extensions are loaded next to the running
// entry too (see quickjs-vm.ts). They're WASM, not JS, so they're copied as
// files rather than bundled; the list comes from quickjs-vm.ts itself.
const { SANDBOX_RUNTIME_ASSET_SOURCES } = await import(
  './dist/api/src/plugins/sandbox/quickjs-vm.js'
)
for (const asset of SANDBOX_RUNTIME_ASSET_SOURCES) {
  if (!asset.package) continue
  copyFileSync(fileURLToPath(import.meta.resolve(asset.package)), `dist/${asset.file}`)
}

console.log(
  `Bundles created: dist/bundle.js, dist/derive-worker.js, ${SANDBOX_RUNTIME_ASSET_SOURCES.map((asset) => `dist/${asset.file}`).join(', ')}`,
)
