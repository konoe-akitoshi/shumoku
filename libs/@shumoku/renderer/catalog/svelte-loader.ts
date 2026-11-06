// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Lets Bun import `.svelte` files straight from `src/`, compiled for the server, so the catalog
 * draws with the kit as it is on disk, with no build first.
 */

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { plugin } from 'bun'
import { compile, preprocess } from 'svelte/compiler'

plugin({
  name: 'svelte',
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const source = await Bun.file(path).text()
      const { code } = await preprocess(source, vitePreprocess(), { filename: path })
      const out = compile(code, { filename: path, generate: 'server' })
      return { contents: out.js.code, loader: 'js' }
    })
  },
})
