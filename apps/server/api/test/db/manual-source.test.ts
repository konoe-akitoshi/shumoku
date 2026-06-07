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

  test('multiple legacy Manual sources merge into one intrinsic on backfill (no data loss, no UNIQUE clash)', async () => {
    // A pre-cutover topology with TWO Manual sources, each a legacy observation that
    // overlaps (same link id, same topology-default attachment key, distinct nodes).
    const topo = await svc.create({ name: 'mm' })
    const db = getDatabase()
    const recordManual = (sid: string, graph: NetworkGraph) => {
      insertDataSource('manual', sid)
      attachSource(topo.id, sid, 'topology')
      db.query(
        `INSERT INTO topology_observations (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
         VALUES (?, ?, ?, ?, 'ok', ?, 0, 0, 0, ?)`,
      ).run(`obs_${sid}`, topo.id, sid, 1, JSON.stringify(graph), 1)
    }
    recordManual('man-a', {
      version: '1',
      name: 'A',
      description: 'kept',
      settings: { paperSize: 'A4' },
      nodes: [{ id: 'na', label: 'NA', ports: [{ id: 'p', label: 'p' }] }],
      links: [{ id: 'shared', from: { node: 'na', port: 'p' }, to: { node: 'na', port: 'p' } }],
      attachments: [{ kind: 'access', protocol: 'snmp', community: 'x' }],
    } as NetworkGraph)
    recordManual('man-b', {
      version: '1',
      name: 'B',
      nodes: [{ id: 'nb', label: 'NB', ports: [{ id: 'p', label: 'p' }] }],
      // SAME link id + SAME topology-default key as A — must be deduped, not double-inserted.
      links: [{ id: 'shared', from: { node: 'nb', port: 'p' }, to: { node: 'nb', port: 'p' } }],
      attachments: [{ kind: 'access', protocol: 'snmp', community: 'y' }],
    } as NetworkGraph)

    // Backfill (lazy, on first read) must merge both without throwing and keep both nodes.
    const merged = svc.readManualGraph(topo.id)
    expect(merged?.nodes?.map((n) => n.id).sort()).toEqual(['na', 'nb'])
    expect(merged?.links).toHaveLength(1) // 'shared' deduped
    expect(merged?.attachments).toHaveLength(1) // one slot per key
    expect(merged?.description).toBe('kept') // graph-level fields preserved
    expect((merged?.settings as { paperSize?: string })?.paperSize).toBe('A4')

    // Idempotent: a second read comes from the intrinsic rows, still merged.
    expect(
      svc
        .readManualGraph(topo.id)
        ?.nodes?.map((n) => n.id)
        .sort(),
    ).toEqual(['na', 'nb'])
  })
})
