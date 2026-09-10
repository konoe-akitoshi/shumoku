import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [
    {
      name: 'shumoku-brand-assets',
      hooks: {
        'astro:config:setup': async () => {
          for (const name of [
            'favicon.ico',
            'favicon.svg',
            'favicon-96x96.png',
            'apple-touch-icon.png',
            'web-app-manifest-192x192.png',
            'web-app-manifest-512x512.png',
          ]) {
            await copyFile(
              new URL(`../../assets/${name}`, import.meta.url),
              new URL(`./public/${name}`, import.meta.url),
            )
          }
        },
      },
    },
  ],
  site: 'https://docs.shumoku.dev',
  output: 'static',
  compressHTML: true,
  trailingSlash: 'never',
  build: { format: 'file' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
})
