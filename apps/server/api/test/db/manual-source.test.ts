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

describe('Manual = uniform data source (authored graph as observation)', () => {
  test('attachManualSource seeds config {} (no graph) and reads null until saved', async () => {
    const topo = await svc.create({ name: 'm1' })
    const manualId = await svc.ensureManualSource(topo.id)
    const cfg = getDatabase()
      .query('SELECT config_json FROM data_sources WHERE id = ?')
      .get(manualId) as { config_json: string }
    expect(JSON.parse(cfg.config_json).graph).toBeUndefined()
    expect(svc.readManualGraph(topo.id, manualId)).toBeNull()
  })

  test('writeManualGraph records an observation; readManualGraph + resolve see it', async () => {
    const topo = await svc.create({ name: 'm2' })
    const manualId = await svc.ensureManualSource(topo.id)
    await svc.writeManualGraph(topo.id, manualId, g('a'))

    // Stored as an observation, not in config_json.
    const obs = getDatabase()
      .query(
        'SELECT graph_json, status FROM topology_observations WHERE topology_id = ? AND source_id = ?',
      )
      .get(topo.id, manualId) as { graph_json: string; status: string } | undefined
    expect(obs?.status).toBe('ok')
    expect(JSON.parse(obs?.graph_json ?? '{}').nodes).toHaveLength(1)

    expect(svc.readManualGraph(topo.id, manualId)?.nodes?.[0]?.id).toBe('a')
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })

  test('latest observation wins on re-save', async () => {
    const topo = await svc.create({ name: 'm3' })
    const manualId = await svc.ensureManualSource(topo.id)
    await svc.writeManualGraph(topo.id, manualId, g('first'))
    await svc.writeManualGraph(topo.id, manualId, g('second'))
    expect(svc.readManualGraph(topo.id, manualId)?.nodes?.[0]?.id).toBe('second')
  })
})
