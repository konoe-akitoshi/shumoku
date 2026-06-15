import { describe, expect, it, vi } from 'vitest'
import { compareVersions, parseReleaseVersion, UpdateChecker } from './system-info.js'

describe('system version helpers', () => {
  it('accepts only Server stable and beta release tags', () => {
    expect(parseReleaseVersion('server-v1.2.3')).toBe('1.2.3')
    expect(parseReleaseVersion('server-v1.2.3-beta.1')).toBe('1.2.3-beta.1')
    expect(parseReleaseVersion('1.2.3-beta.1')).toBe('1.2.3-beta.1')
    expect(parseReleaseVersion('v1.2.3')).toBeNull()
    expect(parseReleaseVersion('editor-v1.2.3')).toBeNull()
    expect(parseReleaseVersion('@shumoku/core@1.2.3')).toBeNull()
  })

  it('compares stable and beta semantic versions', () => {
    expect(compareVersions('server-v0.1.1', 'server-v0.1.2')).toBe(-1)
    expect(compareVersions('server-v0.2.0-beta.1', 'server-v0.2.0-beta.2')).toBe(-1)
    expect(compareVersions('server-v0.2.0-beta.2', 'server-v0.2.0')).toBe(-1)
    expect(compareVersions('server-v0.2.0', 'server-v0.1.9')).toBe(1)
    expect(compareVersions('server-v1.0.0', 'server-v1.0.0')).toBe(0)
    expect(compareVersions('development', 'server-v1.0.0')).toBeNull()
  })

  it('does not describe a development build as current', async () => {
    const checker = new UpdateChecker({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify([{ tag_name: 'server-v0.1.2' }]), { status: 200 }),
        ),
    })

    const result = await checker.get('development', 'development')

    expect(result.status).toBe('unknown')
    expect(result.latestVersion).toBe('0.1.2')
  })

  it('caches the latest release response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          { tag_name: 'server-v0.1.1' },
          { tag_name: 'server-v9.0.0-beta.1', prerelease: true },
          { tag_name: 'server-v8.0.0', draft: true },
          { tag_name: '@shumoku/core@0.3.0' },
          {
            tag_name: 'server-v0.1.2',
            html_url: 'https://github.com/konoe-akitoshi/shumoku/releases/tag/server-v0.1.2',
            published_at: '2026-06-14T00:00:00Z',
          },
        ]),
        { status: 200 },
      ),
    )
    const checker = new UpdateChecker({
      fetcher,
      now: () => Date.parse('2026-06-14T01:00:00Z'),
    })

    const first = await checker.get('0.1.1')
    const second = await checker.get('0.1.1')

    expect(first.status).toBe('available')
    expect(first.latestVersion).toBe('0.1.2')
    expect(second).toEqual(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('offers beta builds a newer beta without exposing it to stable builds', async () => {
    const releases = [
      { tag_name: 'server-v0.2.0-beta.2', prerelease: true },
      { tag_name: 'server-v0.1.2' },
    ]
    const betaChecker = new UpdateChecker({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(releases), { status: 200 })),
    })
    const stableChecker = new UpdateChecker({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(releases), { status: 200 })),
    })

    const beta = await betaChecker.get('0.2.0-beta.1', 'beta')
    const stable = await stableChecker.get('0.1.1', 'stable')

    expect(beta.latestVersion).toBe('0.2.0-beta.2')
    expect(beta.status).toBe('available')
    expect(stable.latestVersion).toBe('0.1.2')
  })

  it('reports an unavailable update source without failing the API', async () => {
    const checker = new UpdateChecker({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    })

    const result = await checker.get('0.1.1')

    expect(result.status).toBe('unknown')
    expect(result.error).toContain('HTTP 503')
  })
})
