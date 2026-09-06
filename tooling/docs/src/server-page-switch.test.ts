import { expect, test } from 'bun:test'
import type { ServerDocsArtifact, ServerVersionsModel } from '../../../apps/docs/src/lib/docs-model'
import { docsNavigation } from '../../../apps/docs/src/lib/navigation'
import {
  correspondingServerPage,
  selectedServerArtifact,
} from '../../../apps/docs/src/lib/server-version'

function fixture(version: string, slug: string): ServerDocsArtifact {
  return {
    release: { version },
    guides: [{ id: 'install', locale: 'ja', slug }],
    pages: [],
    references: { api: { operations: [{ id: 'getTopology' }] }, plugins: { plugins: [] } },
  } as unknown as ServerDocsArtifact
}

test('released navigation remains authoritative even for IDs unknown to the current site', () => {
  const artifact = fixture('1.0.0', 'server/setup')
  const groups = [
    { label: 'Historical guides', links: [{ label: 'Old guide', href: '/ja/server/1.0.0/old' }] },
  ]
  artifact.navigation = { en: groups, ja: groups }
  expect(
    docsNavigation(
      '/ja/server/1.0.0',
      'ja',
      { schemaVersion: 2, sourceCommit: 'test', pages: [] },
      artifact,
    ),
  ).toEqual(groups)
})

test('switching follows guide identity across route changes and falls back for removed pages', () => {
  const current = fixture('next', 'server/install')
  const target = fixture('1.0.0', 'server/setup')
  expect(correspondingServerPage('/ja/server/next/guides/install', 'ja', current, target)).toBe(
    '/ja/server/1.0.0/guides/setup',
  )
  expect(correspondingServerPage('/ja/server/next/api/getTopology', 'ja', current, target)).toBe(
    '/ja/server/1.0.0/api/getTopology',
  )
  expect(correspondingServerPage('/ja/server/next/api/removed', 'ja', current, target)).toBe(
    '/ja/server/1.0.0',
  )
})

test('beta is the public entry when stable is absent even if next is included', () => {
  const beta = fixture('1.0.0-beta.1', 'server/setup')
  const model = {
    aliases: { beta: beta.release.version, next: 'next' },
    versions: [fixture('next', 'server/setup'), beta],
  } as ServerVersionsModel
  expect(selectedServerArtifact(model)).toBe(beta)
})
