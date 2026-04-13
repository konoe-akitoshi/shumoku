import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: 'src/wc.svelte.ts',
      formats: ['es'],
      fileName: 'wc',
    },
    rollupOptions: {
      // External: consumed by the host app's bundler
      external: [
        'svelte',
        'svelte/internal',
        'svelte/internal/client',
        'svelte/internal/disclose-version',
        '@shumoku/core',
        'd3-drag',
        'd3-selection',
        'd3-zoom',
      ],
    },
  },
})
