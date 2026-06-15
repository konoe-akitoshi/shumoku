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
  external: ['bun:sqlite', 'bun'],
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

console.log('Bundles created: dist/bundle.js, dist/derive-worker.js')
