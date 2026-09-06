import { describe, expect, it } from 'vitest'
import { legacyDestination } from './legacy'

describe('legacy website links', () => {
  it('preserves the language for reviewed Docs routes', () => {
    expect(legacyDestination('/ja/docs/server/installation')).toBe(
      'https://docs.shumoku.dev/ja/server/guides/installation',
    )
    expect(legacyDestination('/docs/npm/cli')).toBe(
      'https://docs.shumoku.dev/en/cli/commands/render',
    )
  })
  it('preserves unported content rather than sending it to an unrelated homepage', () => {
    expect(legacyDestination('/ja/docs/npm/multi-file')).toBe(
      'https://github.com/konoe-akitoshi/shumoku/blob/main/tooling/docs/legacy-content/npm/multi-file.ja.mdx',
    )
  })
  it('does not redirect unknown pages or API requests', () => {
    expect(legacyDestination('/api/layout/compute')).toBeNull()
    expect(legacyDestination('/ja/docs/not-real')).toBeNull()
  })
  it('keeps standalone entry links working', () => {
    expect(legacyDestination('/ja/editor')).toBe('https://editor.shumoku.dev')
    expect(legacyDestination('/playground')).toBe('/en/playground')
  })
  it('keeps old machine-readable links on text destinations', () => {
    expect(legacyDestination('/llms-full.txt')).toBe('https://docs.shumoku.dev/llms.txt')
    expect(legacyDestination('/llms.mdx/docs/npm/cli')).toBe(
      'https://docs.shumoku.dev/en/cli/commands/render.md',
    )
    expect(legacyDestination('/ja/docs/npm/multi-file.mdx')).toBe(
      'https://raw.githubusercontent.com/konoe-akitoshi/shumoku/main/tooling/docs/legacy-content/npm/multi-file.ja.mdx',
    )
  })
})
