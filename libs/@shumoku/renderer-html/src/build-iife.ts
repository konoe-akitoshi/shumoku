/**
 * Build IIFE bundle for standalone usage
 */

import { join } from 'node:path'

const result = await Bun.build({
  entrypoints: [join(import.meta.dir, 'html', 'iife-entry.ts')],
  outdir: join(import.meta.dir, '..', 'dist'),
  naming: 'shumoku-interactive.iife.js',
  format: 'iife',
  target: 'browser',
  minify: true,
})

if (!result.success) {
  console.error('Build failed:')
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

console.log('IIFE bundle written to dist/shumoku-interactive.iife.js')
