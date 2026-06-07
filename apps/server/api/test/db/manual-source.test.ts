// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { ingestGraph } from '../../src/services/contribution-store.ts'
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

describe('project overlay = the project-owned contribution (attachment_id NULL)', () => {
  test('no overlay until something is written → readProjectOverlay is null', async () => {
    const topo = await svc.create({ name: 'm1' })
    expect(svc.readProjectOverlay(topo.id)).toBeNull()
  })

  test('writeProjectOverlay stores a NULL-attachment contribution and creates NO data source', async () => {
    const topo = await svc.create({ name: 'm2' })
    await svc.writeProjectOverlay(topo.id, g('a'))

    // No Manual (or any) data source is spawned by curation.
    expect(svc.findManualSourceId(topo.id)).toBeUndefined()
    const dsCount = (
      getDatabase()
        .query(`SELECT COUNT(*) AS c FROM topology_data_sources WHERE topology_id = ?`)
        .get(topo.id) as { c: number }
    ).c
    expect(dsCount).toBe(0)

    // The overlay is the project-owned contribution: attachment_id NULL, sentinel source_id.
    const src = getDatabase()
      .query(
        'SELECT source_id, attachment_id FROM contribution_source WHERE topology_id = ? AND attachment_id IS NULL',
      )
      .get(topo.id) as { source_id: string; attachment_id: string | null } | undefined
    expect(src).toBeDefined()
    expect(src?.attachment_id).toBeNull()
    expect(src?.source_id).toBe('intrinsic')

    expect(svc.readProjectOverlay(topo.id)?.nodes?.[0]?.id).toBe('a')
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })

  test('latest write wins on re-save (overlay is replaced), still exactly one overlay row', async () => {
    const topo = await svc.create({ name: 'm3' })
    await svc.writeProjectOverlay(topo.id, g('first'))
    await svc.writeProjectOverlay(topo.id, g('second'))
    expect(svc.readProjectOverlay(topo.id)?.nodes?.[0]?.id).toBe('second')
    const count = (
      getDatabase()
        .query(
          'SELECT COUNT(*) AS c FROM contribution_source WHERE topology_id = ? AND attachment_id IS NULL',
        )
        .get(topo.id) as { c: number }
    ).c
    expect(count).toBe(1)
  })
})

describe('Manual = an explicitly-added, ordinary hand-drawn source', () => {
  test('writeManualSourceGraph requires the source be attached (no find-or-create)', async () => {
    const topo = await svc.create({ name: 'ms1' })
    await expect(svc.writeManualSourceGraph(topo.id, 'nope', g('x'))).rejects.toThrow()
  })

  test('an attached Manual source folds as an ordinary source contribution', async () => {
    const topo = await svc.create({ name: 'ms2' })
    const { dataSourceId } = await svc.attachManualSource(topo.id, 'topology')
    await svc.writeManualSourceGraph(topo.id, dataSourceId, g('hand'))

    // Its contribution is a normal source row: attachment_id SET.
    const src = getDatabase()
      .query(
        'SELECT attachment_id FROM contribution_source WHERE topology_id = ? AND source_id = ?',
      )
      .get(topo.id, dataSourceId) as { attachment_id: string | null } | undefined
    expect(src?.attachment_id).not.toBeNull()

    expect(svc.readManualSourceGraph(topo.id, dataSourceId)?.nodes?.[0]?.id).toBe('hand')
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })
})

describe('migrateManualToProject — fold legacy Manual sources into the overlay, retire them', () => {
  test('moves Manual content into the project overlay and deletes the Manual data source', async () => {
    const topo = await svc.create({ name: 'mig' })
    // Simulate a pre-refactor DB: operator content stored as a Manual data source's
    // own contribution (attachment_id set).
    const { dataSourceId } = await svc.attachManualSource(topo.id, 'topology')
    await svc.writeManualSourceGraph(topo.id, dataSourceId, g('legacy'))
    // Clear the one-shot guard for this DB.
    getDatabase().query("DELETE FROM settings WHERE key = 'manual_to_project_migrated'").run()

    await svc.migrateManualToProject()

    // The Manual data source is retired entirely.
    expect(svc.findManualSourceId(topo.id)).toBeUndefined()
    const dsLeft = getDatabase().query('SELECT 1 FROM data_sources WHERE id = ?').get(dataSourceId)
    expect(dsLeft).toBeNull()

    // Content now lives in the project overlay (attachment_id NULL).
    const overlay = svc.readProjectOverlay(topo.id)
    expect(overlay?.nodes?.[0]?.id).toBe('legacy')
    const nullRow = getDatabase()
      .query('SELECT 1 FROM contribution_source WHERE topology_id = ? AND attachment_id IS NULL')
      .get(topo.id)
    expect(nullRow).not.toBeNull()
  })

  test('also re-homes a leftover legacy NULL-intrinsic contribution', async () => {
    const topo = await svc.create({ name: 'mig2' })
    // A pre-correction NULL-intrinsic row IS already the overlay slot — it should
    // simply remain readable as the overlay (no Manual source needed).
    ingestGraph(topo.id, 'intrinsic', g('older'), { attachmentId: null }, getDatabase())
    expect(svc.readProjectOverlay(topo.id)?.nodes?.[0]?.id).toBe('older')
  })
})
