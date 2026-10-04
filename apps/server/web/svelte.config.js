import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true,
    }),
    paths: {
      base: '',
    },

    // `script-src 'self'` blocks inline `on*` handlers, `javascript:` and
    // injected <script>; hash mode passes SvelteKit's own bootstrap. This
    // constrains only script/object/base, so runtime <style>, inline styles and
    // external icon images keep working.
    csp: {
      mode: 'hash',
      directives: {
        'script-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
      },
    },
  },
}

export default config
