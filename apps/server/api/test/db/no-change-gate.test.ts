// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * No-change gate (migration 023): `record()` reports whether the snapshot
 * CHANGED the source's canonical contribution. Re-scans of an unchanged
 * network (even with fresh `observedAt` stamps) must report false so callers
 * skip the revision bump — and with it the multi-minute layout re-bake.
 */

import { afterAll, beforeAll, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { ObservationsService } from '../../src/services/observations.ts'
import { attachSource, getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let obs: ObservationsService
beforeAll(() => {
  db_ = setupTempDb()
  obs = new ObservationsService()
})
afterAll(() => db_.teardown())

function makeTopology(id: string): void {
  getDatabase()
    .query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run(id, id)
}

const graphWith = (observedAt: number, ...nodeIds: string[]): NetworkGraph =>
  ({
    version: '1',
    name: 't',
    nodes: nodeIds.map((id) => ({
      id,
      label: id,
      shape: 'rect',
      identity: { sysName: id },
      provenance: { source: 's', observedAt },
    })),
    links: [],
  }) as NetworkGraph

test('identical re-scan (fresh observedAt) does NOT change the contribution', async () => {
  makeTopology('t_gate_1')
  const ds = insertDataSource('zabbix', 'ds_gate_1')
  attachSource('t_gate_1', ds, 'topology')

  const first = await obs.record({
    topologyId: 't_gate_1',
    sourceId: ds,
    capturedAt: 1000,
    status: 'ok',
    graph: graphWith(1000, 'a', 'b'),
  })
  expect(first.contributionChanged).toBe(true)

  // Same structure, NEW observedAt stamps — the volatile field is stripped.
  const second = await obs.record({
    topologyId: 't_gate_1',
    sourceId: ds,
    capturedAt: 2000,
    status: 'ok',
    graph: graphWith(2000, 'a', 'b'),
  })
  expect(second.contributionChanged).toBe(false)

  // Freshness columns still advance even when gated.
  const row = getDatabase()
    .query('SELECT last_ok_at FROM contribution_source WHERE topology_id = ? AND source_id = ?')
    .get('t_gate_1', ds) as { last_ok_at: number }
  expect(row.last_ok_at).toBe(2000)
})

test('a structural change DOES change the contribution', async () => {
  makeTopology('t_gate_2')
  const ds = insertDataSource('zabbix', 'ds_gate_2')
  attachSource('t_gate_2', ds, 'topology')

  await obs.record({
    topologyId: 't_gate_2',
    sourceId: ds,
    capturedAt: 1000,
    status: 'ok',
    graph: graphWith(1000, 'a'),
  })
  const changed = await obs.record({
    topologyId: 't_gate_2',
    sourceId: ds,
    capturedAt: 2000,
    status: 'ok',
    graph: graphWith(2000, 'a', 'b'),
  })
  expect(changed.contributionChanged).toBe(true)
})

test('failed scans and unattached sources never report a change', async () => {
  makeTopology('t_gate_3')
  const attached = insertDataSource('zabbix', 'ds_gate_3a')
  attachSource('t_gate_3', attached, 'topology')
  const unattached = insertDataSource('zabbix', 'ds_gate_3b')

  const failed = await obs.record({
    topologyId: 't_gate_3',
    sourceId: attached,
    capturedAt: 1000,
    status: 'failed',
    graph: null,
  })
  expect(failed.contributionChanged).toBe(false)

  const noAttach = await obs.record({
    topologyId: 't_gate_3',
    sourceId: unattached,
    capturedAt: 1000,
    status: 'ok',
    graph: graphWith(1000, 'x'),
  })
  expect(noAttach.contributionChanged).toBe(false)
})
