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
  // Use browser entry point for renderer (avoids resvg native module)
  alias: {
    '@shumoku/renderer': path.resolve(__dirname, '../../packages/@shumoku/renderer/dist/index.js'),
    '@shumoku/renderer/iife-string': path.resolve(
      __dirname,
      '../../packages/@shumoku/renderer/dist/iife-string.js',
    ),
  },
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`,
  },
})

console.log('Bundle created: dist/bundle.js')
