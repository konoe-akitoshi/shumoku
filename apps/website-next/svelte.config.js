import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ runtime: 'nodejs24.x' }),
    // Shared assets during parallel migration; move ownership at cutover.
    files: { assets: '../website/public' },
  },
}
