import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  compareServerVersions,
  createVersionsModel,
  parseArtifact,
  type ServerDocsArtifact,
} from './sync-server-versions'

function artifact(version: string, channel: 'development' | 'beta' | 'stable') {
  return {
    release: { version, channel },
  } as unknown as ServerDocsArtifact
}

describe('Server docs versions', () => {
  test('retains older stable and beta artifacts while advancing aliases', () => {
    const model = createVersionsModel([
      artifact('0.1.0', 'stable'),
      artifact('0.2.0', 'stable'),
      artifact('0.3.0', 'stable'),
      artifact('0.4.0-beta.1', 'beta'),
      artifact('0.4.0-beta.2', 'beta'),
    ])
    expect(model.versions).toHaveLength(5)
    expect(model.aliases).toEqual({ latest: '0.3.0', beta: '0.4.0-beta.2' })
  })
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

  test('normalizes legacy repository documents without changing their release', () => {
    const content = {
      schemaVersion: 1,
      product: 'server',
      release: {
        version: '0.1.6',
        productVersion: '0.1.6',
        channel: 'stable',
        tag: 'server-v0.1.6',
        sourceCommit: 'abc123',
      },
      references: { api: {}, plugins: {} },
      guides: [],
      documents: [
        {
          id: 'server-overview',
          owner: 'server',
          route: 'overview',
          locale: 'en',
          title: 'Server',
          description: 'Server overview',
          file: 'apps/server/README.md',
          manifest: 'apps/server/docs.manifest.json',
          body: '# Server',
        },
      ],
    }
    const parsed = parseArtifact(
      {
        ...content,
        integrity: {
          algorithm: 'sha256',
          inputs: {},
          contentDigest: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
        },
      },
      'legacy fixture',
    )

    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.release.version).toBe('0.1.6')
    expect(parsed['pages']).toHaveLength(1)
    expect(parsed['documents']).toBeUndefined()
  })
})
