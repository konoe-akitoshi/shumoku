// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { TopologyService } from '../../src/services/topology.ts'
import { getDatabase, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let svc: TopologyService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => db_.teardown())

const g = (nodeId: string): NetworkGraph =>
  ({
    version: '1',
    name: 'manual',
    nodes: [{ id: nodeId, label: nodeId, shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }],
    links: [],
  }) as NetworkGraph

describe('Manual = a uniform data source (its graph is its own contribution)', () => {
  test('no Manual source until something is written → readManualGraph is null', async () => {
    const topo = await svc.create({ name: 'm1' })
    expect(svc.findManualSourceId(topo.id)).toBeUndefined()
    expect(svc.readManualGraph(topo.id)).toBeNull()
  })

  test('writeManualGraph find-or-creates a Manual data source and stores its contribution (attachment_id set)', async () => {
    const topo = await svc.create({ name: 'm2' })
    await svc.writeManualGraph(topo.id, g('a'))

    // A real type='manual' data source now exists, attached to the topology.
    const manualId = svc.findManualSourceId(topo.id)
    expect(manualId).toBeDefined()
    const ds = getDatabase().query('SELECT type FROM data_sources WHERE id = ?').get(manualId) as
      | { type: string }
      | undefined
    expect(ds?.type).toBe('manual')

    // Its graph is its OWN contribution — attachment_id SET (equal to any source),
    // NOT a NULL "intrinsic" row.
    const src = getDatabase()
      .query(
        'SELECT source_id, attachment_id FROM contribution_source WHERE topology_id = ? AND source_id = ?',
      )
      .get(topo.id, manualId) as { source_id: string; attachment_id: string | null } | undefined
    expect(src).toBeDefined()
    expect(src?.attachment_id).not.toBeNull()
    // No NULL-"intrinsic" row exists (bun:sqlite .get() returns null for no row).
    const intrinsic = getDatabase()
      .query('SELECT 1 FROM contribution_source WHERE topology_id = ? AND attachment_id IS NULL')
      .get(topo.id)
    expect(intrinsic).toBeNull()

    expect(svc.readManualGraph(topo.id)?.nodes?.[0]?.id).toBe('a')
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })

  test('latest write wins on re-save (the Manual contribution is replaced)', async () => {
    const topo = await svc.create({ name: 'm3' })
    await svc.writeManualGraph(topo.id, g('first'))
    await svc.writeManualGraph(topo.id, g('second'))
    expect(svc.readManualGraph(topo.id)?.nodes?.[0]?.id).toBe('second')
    // Still exactly one Manual source for THIS topology (find-or-create, not spawn-per-save).
    const count = (
      getDatabase()
        .query(
          `SELECT COUNT(*) AS c FROM topology_data_sources tds
           JOIN data_sources ds ON ds.id = tds.data_source_id
           WHERE tds.topology_id = ? AND ds.type = 'manual'`,
        )
        .get(topo.id) as { c: number }
    ).c
    expect(count).toBe(1)
  })
})

describe('migrateIntrinsicToManual — re-home the legacy NULL-intrinsic into a Manual source', () => {
  test('re-homes a NULL-intrinsic contribution into a real Manual data source', async () => {
    const topo = await svc.create({ name: 'mig' })
    // Simulate a pre-correction DB: an authored graph stored as the NULL "intrinsic"
    // contribution (source_id='intrinsic', attachment_id NULL), no Manual source.
    const { ingestGraph } = await import('../../src/services/contribution-store.ts')
    ingestGraph(topo.id, 'intrinsic', g('legacy'), { attachmentId: null }, getDatabase())
    // (one-shot guard may be set from a prior test's run — clear it for this DB)
    getDatabase().query("DELETE FROM settings WHERE key = 'intrinsic_to_manual_migrated'").run()

    await svc.migrateIntrinsicToManual()

    // The NULL row is gone; the graph now lives in a real Manual source's contribution.
    const nullRow = getDatabase()
      .query('SELECT 1 FROM contribution_source WHERE topology_id = ? AND attachment_id IS NULL')
      .get(topo.id)
    expect(nullRow).toBeNull()
    const manualId = svc.findManualSourceId(topo.id)
    expect(manualId).toBeDefined()
    expect(svc.readManualGraph(topo.id)?.nodes?.[0]?.id).toBe('legacy')
  })
})
