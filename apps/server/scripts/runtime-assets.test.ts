import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SANDBOX_RUNTIME_ASSETS } from '../api/src/plugins/sandbox/quickjs-vm.js'

/**
 * The API resolves these next to its running entry in production. The Docker
 * image once shipped only bundle.js and derive-worker.js, so every external
 * plugin failed to load there while dev (which falls back to node_modules or
 * an on-the-fly esbuild) looked fine.
 */
const RUNTIME_SIBLINGS = ['derive-worker.js', ...SANDBOX_RUNTIME_ASSETS]

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf-8')

describe('runtime sibling assets', () => {
  it('lists the sandbox engine, its native extensions, and the guest prelude', () => {
    expect(SANDBOX_RUNTIME_ASSETS).toEqual(
      expect.arrayContaining([
        'guest-prelude.js',
        'quickjs.wasm',
        'url.so',
        'encoding.so',
        'headers.so',
      ]),
    )
  })

  it.each(RUNTIME_SIBLINGS)('the Docker runtime stage copies %s next to server.js', (asset) => {
    expect(dockerfile.split('\n')).toContainEqual(expect.stringMatching(copyLine(asset)))
  })
})

/** `COPY --from=builder <dist>/<asset> ./<asset>` — a live instruction, not a comment. */
function copyLine(asset: string): RegExp {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^COPY --from=builder /app/apps/server/api/dist/${escaped} \\./${escaped}$`)
}
