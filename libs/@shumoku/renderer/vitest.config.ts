import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@shumoku/core': path.resolve(dir, '../core/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
