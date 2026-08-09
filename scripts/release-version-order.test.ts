import { describe, expect, it } from 'bun:test'
import {
  compareProductReleaseVersions,
  parseProductReleaseTag,
  validateProductReleaseOrder,
} from './release-version-order'

describe('product release ordering', () => {
  it('orders beta releases before their stable release', () => {
    const beta = parseProductReleaseTag('server-v0.1.5-beta.6')
    const stable = parseProductReleaseTag('server-v0.1.5')

    expect(beta).not.toBeNull()
    expect(stable).not.toBeNull()
    if (!beta || !stable) return
    expect(compareProductReleaseVersions(beta, stable)).toBe(-1)
  })

  it('rejects a beta published after the stable release of the same version', () => {
    expect(() => validateProductReleaseOrder('server-v0.1.5-beta.6', ['server-v0.1.5'])).toThrow(
      'must be newer than',
    )
  })

  it('rejects a release behind a newer beta line', () => {
    expect(() => validateProductReleaseOrder('server-v0.1.6', ['server-v0.1.7-beta.1'])).toThrow(
      'server-v0.1.7-beta.1',
    )
  })

  it('accepts the next beta line and its stable promotion', () => {
    expect(() =>
      validateProductReleaseOrder('server-v0.1.6-beta.1', [
        'server-v0.1.5',
        'server-v0.1.5-beta.6',
      ]),
    ).not.toThrow()
    expect(() =>
      validateProductReleaseOrder('server-v0.1.6', ['server-v0.1.6-beta.1']),
    ).not.toThrow()
  })

  it('ignores the target tag when rerunning its release workflow', () => {
    expect(() =>
      validateProductReleaseOrder('server-v0.1.6-beta.1', [
        'server-v0.1.5',
        'server-v0.1.6-beta.1',
      ]),
    ).not.toThrow()
  })
})
