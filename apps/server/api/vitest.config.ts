import { defineConfig } from 'vitest/config'

// Vitest runs the pure unit tests under `src/`. DB-backed tests live in `test/`
// and run under `bun test` instead, because they import `bun:sqlite` (via the
// migration runner / services) which the Node-based vitest runtime can't load.
// See the `test` script (`vitest run && bun test ./test`).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
