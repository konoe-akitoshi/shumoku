import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: 'src/wc.svelte.ts',
      formats: ['es'],
      fileName: 'shumoku-renderer',
    },
    rollupOptions: {
      // Don't externalize — bundle everything for standalone WebComponent
    },
  },
})
