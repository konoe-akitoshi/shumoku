import { describe, expect, it } from 'bun:test'
import { resolveServerReleaseIntent } from './server-release-intent'

describe('Server release intent', () => {
  it('publishes a beta when its version change lands on main', () => {
    expect(
      resolveServerReleaseIntent('0.1.6-beta.2', 'push', 'refs/heads/main', '0.1.6-beta.1'),
    ).toEqual({
      release: true,
      channel: 'beta',
      version: '0.1.6-beta.2',
      tag: 'server-v0.1.6-beta.2',
      platforms: '["linux/amd64","linux/arm64"]',
    })
  })

  it('does not publish an ordinary merge to main', () => {
    expect(
      resolveServerReleaseIntent('0.1.6-beta.1', 'push', 'refs/heads/main', '0.1.6-beta.1'),
    ).toMatchObject({
      release: false,
      channel: 'development',
      tag: '',
      platforms: '["linux/amd64"]',
    })
  })

  it('does not publish a version change from a pull request run', () => {
    expect(
      resolveServerReleaseIntent(
        '0.1.6-beta.2',
        'pull_request',
        'refs/pull/662/merge',
        '0.1.6-beta.1',
      ),
    ).toMatchObject({ release: false, channel: 'development', tag: '' })
  })

  it('classifies a stable version change without moving the beta channel', () => {
    expect(
      resolveServerReleaseIntent('0.1.6', 'push', 'refs/heads/main', '0.1.6-beta.2'),
    ).toMatchObject({
      release: true,
      channel: 'stable',
      tag: 'server-v0.1.6',
    })
  })
})
