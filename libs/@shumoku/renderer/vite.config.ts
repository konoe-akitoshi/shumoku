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
      // Only @shumoku/core is external (sibling package).
      // svelte + d3 are bundled so consumers don't need to install them.
      external: ['@shumoku/core'],
    },
  },
})
