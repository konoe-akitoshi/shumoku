// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { TopologyService } from '../../src/services/topology.ts'
import { getDatabase, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let svc: TopologyService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => db_.teardown())

const revision = (id: string): number =>
  (
    getDatabase()
      .query('SELECT composition_revision AS r FROM topologies WHERE id = ?')
      .get(id) as {
      r: number
    }
  ).r

const artifactRevision = (id: string): number | null =>
  (
    getDatabase()
      .query('SELECT built_revision AS r FROM topology_resolved_graph WHERE topology_id = ?')
      .get(id) as { r: number } | undefined
  )?.r ?? null

describe('Phase 3 materialized resolved graph (composition_revision)', () => {
  test('first getParsed persists an artifact stamped at the current revision', async () => {
    const topo = await svc.create({ name: 'rc1' })
    expect(await svc.getParsed(topo.id)).not.toBeNull()
    expect(artifactRevision(topo.id)).toBe(revision(topo.id))
  })

  test('clearCache() bumps every revision (invalidates persisted artifacts) and rebuilds', async () => {
    const topo = await svc.create({ name: 'rc2' })
    await svc.getParsed(topo.id)
    const rev = revision(topo.id)
    // clearCache() is a bulk reset: it must invalidate persisted artifacts too,
    // so it bumps the revision. The next read recomputes at the new revision.
    svc.clearCache()
    expect(revision(topo.id)).toBe(rev + 1)
    expect(await svc.getParsed(topo.id)).not.toBeNull()
    expect(artifactRevision(topo.id)).toBe(rev + 1)
  })

  test('clearCacheEntry bumps the revision; the artifact rebuilds at the new one', async () => {
    const topo = await svc.create({ name: 'rc3' })
    await svc.getParsed(topo.id)
    const rev = revision(topo.id)
    svc.clearCacheEntry(topo.id)
    expect(revision(topo.id)).toBe(rev + 1)
    expect(artifactRevision(topo.id)).toBe(rev) // stale until next read
    await svc.getParsed(topo.id)
    expect(artifactRevision(topo.id)).toBe(rev + 1)
  })
})
