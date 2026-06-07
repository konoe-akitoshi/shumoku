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

describe('Manual = uniform data source (authored graph as the intrinsic contribution)', () => {
  test('attachManualSource seeds config {} (no graph) and reads null until saved', async () => {
    const topo = await svc.create({ name: 'm1' })
    const manualId = await svc.ensureManualSource(topo.id)
    const cfg = getDatabase()
      .query('SELECT config_json FROM data_sources WHERE id = ?')
      .get(manualId) as { config_json: string }
    expect(JSON.parse(cfg.config_json).graph).toBeUndefined()
    expect(svc.readManualGraph(topo.id, manualId)).toBeNull()
  })

  test('writeManualGraph stores the intrinsic contribution; readManualGraph + resolve see it', async () => {
    const topo = await svc.create({ name: 'm2' })
    await svc.writeManualGraph(topo.id, 'intrinsic', g('a'))

    // Stored in the contribution store (intrinsic = attachment_id NULL), NOT an observation.
    const src = getDatabase()
      .query(
        'SELECT source_id FROM contribution_source WHERE topology_id = ? AND attachment_id IS NULL',
      )
      .get(topo.id) as { source_id: string } | undefined
    expect(src).toBeDefined()
    const node = getDatabase()
      .query("SELECT local_id FROM contribution_element WHERE topology_id = ? AND kind = 'node'")
      .get(topo.id) as { local_id: string } | undefined
    expect(node?.local_id).toBe('a')

    expect(svc.readManualGraph(topo.id)?.nodes?.[0]?.id).toBe('a')
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })

  test('latest write wins on re-save (intrinsic is replaced)', async () => {
    const topo = await svc.create({ name: 'm3' })
    await svc.writeManualGraph(topo.id, 'intrinsic', g('first'))
    await svc.writeManualGraph(topo.id, 'intrinsic', g('second'))
    expect(svc.readManualGraph(topo.id)?.nodes?.[0]?.id).toBe('second')
  })
})
