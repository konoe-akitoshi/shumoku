// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// Unit tests only — the suites under src/lib are plain TS modules, so
// this deliberately skips the SvelteKit plugin (which needs a built
// .svelte-kit and an app shell) and keeps the svelte plugin for the
// `svelte` export condition that @xyflow/svelte resolution depends on.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: { $lib: new URL('./src/lib', import.meta.url).pathname },
    conditions: ['svelte', 'browser', 'import', 'default'],
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
