import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

await esbuild.build({
  entryPoints: ['dist/api/src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'esnext',
  format: 'esm',
  outfile: 'dist/bundle.js',
  external: ['bun:sqlite', 'bun'],
  loader: { '.sql': 'text' },
  alias: {
    '@shumoku/renderer-html/iife-string': path.resolve(
      __dirname,
      '../../../libs/@shumoku/renderer-html/dist/iife-string.js',
    ),
  },
})

console.log('Bundle created: dist/bundle.js')
