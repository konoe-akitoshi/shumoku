import { fileURLToPath } from 'node:url'
import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'

export default {
  extensions: ['.svelte', '.md'],
  preprocess: [
    vitePreprocess(),
    mdsvex({
      extensions: ['.md'],
      layout: fileURLToPath(new URL('./src/lib/blog/MarkdownLayout.svelte', import.meta.url)),
    }),
  ],
  kit: {
    adapter: adapter({ runtime: 'nodejs24.x' }),
    files: { assets: 'public' },
  },
}
