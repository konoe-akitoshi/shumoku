import { readFileSync } from 'node:fs'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

const version = process.env['SHUMOKU_EDITOR_VERSION'] ?? manifest.version
const vercelEnvironment = process.env['VERCEL_TARGET_ENV'] ?? process.env['VERCEL_ENV']
const channel =
  process.env['SHUMOKU_EDITOR_CHANNEL'] ??
  (version.includes('-beta.')
    ? 'beta'
    : vercelEnvironment === 'production'
      ? 'stable'
      : vercelEnvironment === 'preview'
        ? 'preview'
        : 'development')

export default defineConfig({
  define: {
    __SHUMOKU_EDITOR_VERSION__: JSON.stringify(version),
    __SHUMOKU_EDITOR_COMMIT__: JSON.stringify(
      process.env['SHUMOKU_EDITOR_COMMIT'] ?? process.env['VERCEL_GIT_COMMIT_SHA'] ?? '',
    ),
    __SHUMOKU_EDITOR_CHANNEL__: JSON.stringify(channel),
  },
  plugins: [tailwindcss(), wasm(), sveltekit()],
})
