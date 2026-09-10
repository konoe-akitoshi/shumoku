import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/layout/auto-placement/flat-tree/bench.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    // Each case measures several layouts, including the largest fixture.
    testTimeout: 30_000,
  },
})
