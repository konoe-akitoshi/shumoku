import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The static entry as plain server JS: the kit's Svelte components are compiled for the server
// and svelte's runtime is bundled in, so Node and Bun can import it with no plugin.
export default defineConfig({
  plugins: [svelte()],
  publicDir: false,
  build: {
    ssr: 'src/static.ts',
    outDir: 'dist/ssr',
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'static.js' },
    },
  },
  ssr: {
    // Only @shumoku/core is a dependency of the output; svelte is bundled.
    noExternal: ['svelte'],
    external: ['@shumoku/core'],
    target: 'node',
  },
})
