// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { TopologyService } from '../../src/services/topology.ts'
import { attachSource, getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let svc: TopologyService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => db_.teardown())

const columnExists = (table: string, col: string): boolean =>
  (getDatabase().query(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
    (c) => c.name === col,
  )

describe('mapping_json backfill (Phase 2 → bindings, then drop column)', () => {
  test('migrates a legacy mapping_json node entry to a binding, then drops the column', async () => {
    // The column is created by migration 001 and only dropped by the backfill.
    expect(columnExists('topologies', 'mapping_json')).toBe(true)

    const topo = await svc.create({ name: 'bf' })
    const graph: NetworkGraph = {
      version: '1',
      name: 'bf',
      nodes: [{ id: 'a', label: 'A', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }],
      links: [],
    } as NetworkGraph
    await svc.writeManualGraph(topo.id, graph)
    attachSource(topo.id, insertDataSource('zabbix', 'zbx_bf'), 'metrics')

    const nodeAId = (await svc.getParsed(topo.id))?.graph.nodes.find(
      (n) => n.identity?.mgmtIp === '10.0.0.1',
    )?.id
    expect(nodeAId).toBeTruthy()

    // Seed a legacy mapping_json keyed by the resolved node id.
    getDatabase()
      .query('UPDATE topologies SET mapping_json = ? WHERE id = ?')
      .run(JSON.stringify({ nodes: { [nodeAId as string]: { hostId: '99' } }, links: {} }), topo.id)

    await svc.backfillMetricsBindings()

    expect(columnExists('topologies', 'mapping_json')).toBe(false)
    const mapping = (await svc.getParsed(topo.id))?.mapping
    expect(mapping?.nodes?.[nodeAId as string]?.hostId).toBe('99')
    // create() still works after the column is gone (no mapping_json in INSERT).
    const after = await svc.create({ name: 'after-drop' })
    expect(after.id).toBeTruthy()
  })
})
