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

  test('a Manual source record is not double-counted as an observed source', async () => {
    const topo = await svc.create({ name: 'manual' })
    const manualId = await svc.ensureManualSource(topo.id)
    await svc.writeManualGraph(topo.id, manualId, graphWith('authored'))

    // Even if something records an observation against the manual source, it must
    // not create an observed contribution (the intrinsic owns the authored graph).
    await obs.record({
      topologyId: topo.id,
      sourceId: manualId,
      capturedAt: timestamp(),
      status: 'ok',
      graph: graphWith('authored'),
    })
    expect(contribCount(topo.id, manualId)).toBe(0)

    // The authored node still resolves exactly once (from the intrinsic).
    const names = await sysNames(topo.id)
    expect(names.filter((n) => n === 'authored')).toEqual(['authored'])
  })
})
