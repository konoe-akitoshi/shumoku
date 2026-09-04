import { describe, expect, test } from 'bun:test'
import {
  compareServerVersions,
  createVersionsModel,
  type ServerDocsArtifact,
} from './sync-server-versions'

function artifact(version: string, channel: 'development' | 'beta' | 'stable') {
  return {
    release: { version, channel },
  } as unknown as ServerDocsArtifact
}

describe('Server docs versions', () => {
  test('orders stable and beta releases semantically', () => {
    expect(compareServerVersions('0.2.0-beta.2', '0.2.0-beta.10')).toBeLessThan(0)
    expect(compareServerVersions('0.2.0-beta.10', '0.2.0')).toBeLessThan(0)
    expect(compareServerVersions('0.2.0', '0.1.9')).toBeGreaterThan(0)
  })

  test('derives moving aliases without creating editorial channels', () => {
    const model = createVersionsModel([
      artifact('0.1.6', 'stable'),
      artifact('0.2.0-beta.1', 'beta'),
      artifact('next', 'development'),
    ])
    expect(model.aliases).toEqual({ latest: '0.1.6', beta: '0.2.0-beta.1', next: 'next' })
  })
})
