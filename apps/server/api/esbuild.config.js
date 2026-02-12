import * as esbuild from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

await esbuild.build({
  entryPoints: ['dist/index.js'],
  bundle: true,
  platform: 'node',
  target: 'esnext',
  format: 'esm',
  outfile: 'dist/bundle.js',
  external: ['bun:sqlite', 'bun'],
  loader: { '.sql': 'text' },
  // Use browser entry point for renderer (avoids resvg native module)
  alias: {
    '@shumoku/renderer': path.resolve(
      __dirname,
      '../../../packages/@shumoku/renderer/dist/index.js',
    ),
    '@shumoku/renderer/iife-string': path.resolve(
      __dirname,
      '../../../packages/@shumoku/renderer/dist/iife-string.js',
    ),
  },
})

console.log('Bundle created: dist/bundle.js')
