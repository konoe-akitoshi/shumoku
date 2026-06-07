// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Stage 3 of the DB-native persistence refactor (db-native-persistence.md):
 * an external source's observed graph is materialized into the contribution
 * store by `ObservationsService.record()`, and `resolve()` reads observed state
 * from there — NOT from the `topology_observations` audit log.
 *
 * These tests pin the invariants that the rewire introduced:
 *   - record() writes BOTH the audit row AND the canonical contribution;
 *   - a `failed` scan never replaces the last-good contribution (C7);
 *   - an `empty` scan DOES retract (successful absence is real evidence);
 *   - detaching a source cascades its contribution away (no resurrection on
 *     re-attach without sync);
 *   - a Manual source's record is never double-counted as an observed source.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import {
  attachSource,
  getDatabase,
  insertDataSource,
  setupTempDb,
  type TempDb,
  timestamp,
} from './helper.ts'

let db_: TempDb
let svc: TopologyService
let obs: ObservationsService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
  obs = new ObservationsService()
})
afterAll(() => db_.teardown())

const graphWith = (...nodeIds: string[]): NetworkGraph =>
  ({
    version: '1',
    name: 't',
    nodes: nodeIds.map((id) => ({
      id,
      label: id,
      shape: 'rect',
      identity: { sysName: id },
    })),
    links: [],
  }) as NetworkGraph

const sysNames = async (topoId: string): Promise<string[]> => {
  svc.clearCacheEntry(topoId)
  const parsed = await svc.getParsed(topoId)
  return (parsed?.graph.nodes.map((n) => n.identity?.sysName).filter(Boolean) as string[]) ?? []
}

const contribCount = (topoId: string, sourceId: string): number => {
  const row = getDatabase()
    .query('SELECT COUNT(*) AS c FROM contribution_source WHERE topology_id = ? AND source_id = ?')
    .get(topoId, sourceId) as { c: number }
  return row.c
}

const auditCount = (topoId: string, sourceId: string): number => {
  const row = getDatabase()
    .query(
      'SELECT COUNT(*) AS c FROM topology_observations WHERE topology_id = ? AND source_id = ?',
    )
    .get(topoId, sourceId) as { c: number }
  return row.c
}

describe('Stage 3: observed graph materializes into the contribution store', () => {
  test('record() writes both an audit row and a contribution; resolve reads the contribution', async () => {
    const topo = await svc.create({ name: 'obs' })
    const nb = insertDataSource('netbox', 'nb_obs1')
    attachSource(topo.id, nb, 'topology')

    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: timestamp(),
      status: 'ok',
      graph: graphWith('nb-A', 'nb-B'),
    })

    expect(contribCount(topo.id, nb)).toBe(1)
    expect(auditCount(topo.id, nb)).toBe(1)
    expect(await sysNames(topo.id)).toEqual(expect.arrayContaining(['nb-A', 'nb-B']))
  })

  test('a failed scan never replaces the last-good contribution', async () => {
    const topo = await svc.create({ name: 'fail' })
    const nb = insertDataSource('netbox', 'nb_fail')
    attachSource(topo.id, nb, 'topology')

    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: timestamp(),
      status: 'ok',
      graph: graphWith('good-1'),
    })
    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: timestamp(),
      status: 'failed',
      graph: null,
    })

    // The contribution still holds the last-good node; the audit log has 2 rows.
    expect(contribCount(topo.id, nb)).toBe(1)
    expect(auditCount(topo.id, nb)).toBe(2)
    expect(await sysNames(topo.id)).toContain('good-1')
  })

  test('an empty scan retracts the prior contribution', async () => {
    const topo = await svc.create({ name: 'empty' })
    const nb = insertDataSource('netbox', 'nb_empty')
    attachSource(topo.id, nb, 'topology')

    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: timestamp(),
      status: 'ok',
      graph: graphWith('will-vanish'),
    })
    expect(await sysNames(topo.id)).toContain('will-vanish')

    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: timestamp(),
      status: 'empty',
      graph: graphWith(),
    })
    expect(await sysNames(topo.id)).not.toContain('will-vanish')
  })

  test('detaching a source cascades its contribution (no resurrection)', async () => {
    const topo = await svc.create({ name: 'detach' })
    const nb = insertDataSource('netbox', 'nb_detach')
    attachSource(topo.id, nb, 'topology')
    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: timestamp(),
      status: 'ok',
      graph: graphWith('detach-node'),
    })
    expect(contribCount(topo.id, nb)).toBe(1)

    // Detach = remove the topology_data_sources attach row → FK cascade.
    getDatabase()
      .query('DELETE FROM topology_data_sources WHERE topology_id = ? AND data_source_id = ?')
      .run(topo.id, nb)
    expect(contribCount(topo.id, nb)).toBe(0)
    expect(await sysNames(topo.id)).not.toContain('detach-node')
  })

  test('priority decides the field winner across two observed sources', async () => {
    const topo = await svc.create({ name: 'prio' })
    const lo = insertDataSource('netbox', 'nb_lo')
    const hi = insertDataSource('zabbix', 'zbx_hi')
    attachSource(topo.id, lo, 'topology')
    attachSource(topo.id, hi, 'topology')
    // Give hi a higher priority directly on the attach row.
    getDatabase()
      .query('UPDATE topology_data_sources SET priority = 10 WHERE data_source_id = ?')
      .run(hi)

    const loGraph = graphWith('shared')
    loGraph.nodes[0].label = 'from-lo'
    const hiGraph = graphWith('shared')
    hiGraph.nodes[0].label = 'from-hi'

    await obs.record({
      topologyId: topo.id,
      sourceId: lo,
      capturedAt: timestamp(),
      status: 'ok',
      graph: loGraph,
    })
    await obs.record({
      topologyId: topo.id,
      sourceId: hi,
      capturedAt: timestamp(),
      status: 'ok',
      graph: hiGraph,
    })

    svc.clearCacheEntry(topo.id)
    const parsed = await svc.getParsed(topo.id)
    const shared = parsed?.graph.nodes.find((n) => n.identity?.sysName === 'shared')
    expect(shared?.label).toBe('from-hi')
  })

  test('the project overlay (fed as authored) is not double-counted as an observed snapshot', async () => {
    const topo = await svc.create({ name: 'manual' })
    await svc.writeProjectOverlay(topo.id, graphWith('authored'))

    // The overlay is the project-owned contribution: a single NULL-attachment row,
    // and NO data source is created.
    expect(svc.findManualSourceId(topo.id)).toBeUndefined()
    expect(contribCount(topo.id, 'intrinsic')).toBe(1)
    // resolve folds it once (as the top-priority authored contribution); the
    // observed-snapshot feed only reads attachment_id IS NOT NULL, so it never doubles.
    const names = await sysNames(topo.id)
    expect(names.filter((n) => n === 'authored')).toEqual(['authored'])
  })

  test('an out-of-order (older) scan does not regress newer canonical state', async () => {
    const topo = await svc.create({ name: 'ooo' })
    const nb = insertDataSource('netbox', 'nb_ooo')
    attachSource(topo.id, nb, 'topology')

    // Newer scan lands first...
    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: 2000,
      status: 'ok',
      graph: graphWith('newer'),
    })
    // ...then a delayed older scan arrives. It must NOT overwrite the newer graph.
    await obs.record({
      topologyId: topo.id,
      sourceId: nb,
      capturedAt: 1000,
      status: 'ok',
      graph: graphWith('older'),
    })

    const names = await sysNames(topo.id)
    expect(names).toContain('newer')
    expect(names).not.toContain('older')
    // Both scans still recorded in the audit log (history is complete).
    expect(auditCount(topo.id, nb)).toBe(2)
  })

  test('detaching a metrics attachment leaves the topology contribution intact', async () => {
    const topo = await svc.create({ name: 'dual' })
    const ds = insertDataSource('zabbix', 'zbx_dual')
    attachSource(topo.id, ds, 'topology')
    attachSource(topo.id, ds, 'metrics')
    await obs.record({
      topologyId: topo.id,
      sourceId: ds,
      capturedAt: timestamp(),
      status: 'ok',
      graph: graphWith('dual-node'),
    })
    expect(contribCount(topo.id, ds)).toBe(1)

    // Remove ONLY the metrics attach row. The contribution is owned by the
    // topology attach row, so the FK cascade must not touch it.
    getDatabase()
      .query('DELETE FROM topology_data_sources WHERE id = ?')
      .run(`tds_${topo.id}_${ds}_metrics`)
    expect(contribCount(topo.id, ds)).toBe(1)
    expect(await sysNames(topo.id)).toContain('dual-node')

    // Removing the topology attach row DOES cascade the contribution away.
    getDatabase()
      .query('DELETE FROM topology_data_sources WHERE id = ?')
      .run(`tds_${topo.id}_${ds}_topology`)
    expect(contribCount(topo.id, ds)).toBe(0)
  })

  test('legacy audit snapshots are lazily backfilled into contributions on read', async () => {
    const topo = await svc.create({ name: 'backfill' })
    const nb = insertDataSource('netbox', 'nb_backfill')
    attachSource(topo.id, nb, 'topology')
    // Pre-cutover state: the source was synced (lastSyncedAt set) → eligible for
    // backfill. The audit must be captured within this attachment's lifecycle
    // (captured_at >= attach.createdAt), so stamp it after the attach.
    const syncedAt = timestamp() + 1000
    getDatabase()
      .query(
        'UPDATE topology_data_sources SET last_synced_at = ? WHERE topology_id = ? AND data_source_id = ?',
      )
      .run(syncedAt, topo.id, nb)

    // Simulate a pre-stage-3 state: a successful audit row exists but no
    // contribution (write the audit row directly, bypassing record()).
    getDatabase()
      .query(
        `INSERT INTO topology_observations
           (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
         VALUES (?, ?, ?, ?, 'ok', ?, 1, 0, 0, ?)`,
      )
      .run(
        'obs_legacy_1',
        topo.id,
        nb,
        syncedAt,
        JSON.stringify(graphWith('legacy-node')),
        syncedAt,
      )
    expect(contribCount(topo.id, nb)).toBe(0)

    // First resolve backfills the contribution and renders the node.
    expect(await sysNames(topo.id)).toContain('legacy-node')
    expect(contribCount(topo.id, nb)).toBe(1)
  })

  test('a stale audit predating the current attach is not backfilled even once synced', async () => {
    const topo = await svc.create({ name: 'stale-presync' })
    const nb = insertDataSource('netbox', 'nb_presync')
    attachSource(topo.id, nb, 'topology')

    // Stale successful audit from BEFORE this attachment (captured_at far in the
    // past, < attach.createdAt) — e.g. survived a bulk source replace.
    getDatabase()
      .query(
        `INSERT INTO topology_observations
           (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
         VALUES (?, ?, ?, 1000, 'ok', ?, 1, 0, 0, 1000)`,
      )
      .run('obs_presync_1', topo.id, nb, JSON.stringify(graphWith('ghost')))
    // The first sync FAILS — it still stamps lastSyncedAt but writes no contribution.
    getDatabase()
      .query(
        'UPDATE topology_data_sources SET last_synced_at = ? WHERE topology_id = ? AND data_source_id = ?',
      )
      .run(timestamp(), topo.id, nb)

    // Backfill must NOT revive the pre-attach ghost.
    expect(await sysNames(topo.id)).not.toContain('ghost')
    expect(contribCount(topo.id, nb)).toBe(0)
  })

  test('a fresh (never-synced) attach does NOT resurrect stale audit rows', async () => {
    const topo = await svc.create({ name: 'no-resurrect' })
    const nb = insertDataSource('netbox', 'nb_fresh')
    attachSource(topo.id, nb, 'topology') // lastSyncedAt stays null (fresh attach)

    // A stale audit row lingers (e.g. left over from a prior detach/replace).
    getDatabase()
      .query(
        `INSERT INTO topology_observations
           (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
         VALUES (?, ?, ?, ?, 'ok', ?, 1, 0, 0, ?)`,
      )
      .run('obs_stale_1', topo.id, nb, 1234, JSON.stringify(graphWith('stale-node')), timestamp())

    // No Sync yet → no contribution backfilled → the stale node must NOT appear.
    expect(await sysNames(topo.id)).not.toContain('stale-node')
    expect(contribCount(topo.id, nb)).toBe(0)
  })
})
