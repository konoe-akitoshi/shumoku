import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['docs/experiments/2026-10-06-model-separation/*.test.ts'] },
})
