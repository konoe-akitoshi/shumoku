import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://docs.shumoku.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  prefetch: { defaultStrategy: 'hover' },
})
