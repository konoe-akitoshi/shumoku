import * as esbuild from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

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
  // Use browser entry point for renderer-svg (avoids resvg native module)
  alias: {
    '@shumoku/renderer-svg': path.resolve(
      __dirname,
      '../../../libs/@shumoku/renderer-svg/dist/index.js',
    ),
    '@shumoku/renderer-html': path.resolve(
      __dirname,
      '../../../libs/@shumoku/renderer-html/dist/index.js',
    ),
    '@shumoku/renderer-html/iife-string': path.resolve(
      __dirname,
      '../../../libs/@shumoku/renderer-html/dist/iife-string.js',
    ),
  },
})

console.log('Bundle created: dist/bundle.js')
