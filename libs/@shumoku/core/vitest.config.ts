import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Wall-clock assertions run separately after the other workspace tasks finish.
    exclude: [...configDefaults.exclude, 'src/layout/auto-placement/flat-tree/bench.test.ts'],
  },
})
