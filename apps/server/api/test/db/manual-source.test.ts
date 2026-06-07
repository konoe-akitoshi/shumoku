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
    name: 'intrinsic',
    nodes: [{ id: nodeId, label: nodeId, shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }],
    links: [],
  }) as NetworkGraph

describe('intrinsic graph (the project own contribution — no Manual data source)', () => {
  test('writeIntrinsicGraph stores the intrinsic contribution; readIntrinsicGraph + resolve see it', async () => {
    const topo = await svc.create({ name: 'm2' })
    svc.writeIntrinsicGraph(topo.id, g('a'))

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

    expect(svc.readIntrinsicGraph(topo.id)?.nodes?.[0]?.id).toBe('a')
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })

  test('reads null until anything is authored', async () => {
    const topo = await svc.create({ name: 'm1' })
    expect(svc.readIntrinsicGraph(topo.id)).toBeNull()
  })

  test('latest write wins on re-save (intrinsic is replaced)', async () => {
    const topo = await svc.create({ name: 'm3' })
    svc.writeIntrinsicGraph(topo.id, g('first'))
    svc.writeIntrinsicGraph(topo.id, g('second'))
    expect(svc.readIntrinsicGraph(topo.id)?.nodes?.[0]?.id).toBe('second')
  })
})

describe('retireManualSources — one-shot legacy Manual → intrinsic migration', () => {
  test('salvages + merges legacy Manual snapshots into the intrinsic, then drops Manual rows', async () => {
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

    svc.retireManualSources()

    // Both Manual nodes merged into the intrinsic, no UNIQUE clash, dedups preserved.
    const merged = svc.readIntrinsicGraph(topo.id)
    expect(merged?.nodes?.map((n) => n.id).sort()).toEqual(['na', 'nb'])
    expect(merged?.links).toHaveLength(1) // 'shared' deduped
    expect(merged?.attachments).toHaveLength(1) // one slot per key
    expect(merged?.description).toBe('kept') // graph-level fields preserved
    expect((merged?.settings as { paperSize?: string })?.paperSize).toBe('A4')

    // The Manual data sources are gone.
    const manualCount = (
      db.query("SELECT COUNT(*) AS c FROM data_sources WHERE type = 'manual'").get() as {
        c: number
      }
    ).c
    expect(manualCount).toBe(0)
  })

  test('does not clobber an already-populated intrinsic', async () => {
    const topo = await svc.create({ name: 'keep-intrinsic' })
    svc.writeIntrinsicGraph(topo.id, g('authored-real'))
    // A stray legacy Manual snapshot exists too, but the intrinsic is already set.
    insertDataSource('manual', 'man-stray')
    attachSource(topo.id, 'man-stray', 'topology')
    getDatabase()
      .query(
        `INSERT INTO topology_observations (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
         VALUES ('obs-stray', ?, 'man-stray', 1, 'ok', ?, 0, 0, 0, 1)`,
      )
      .run(topo.id, JSON.stringify(g('stale-ghost')))

    svc.retireManualSources()

    // The real authored node survives; the stray legacy snapshot is NOT salvaged over it.
    expect(svc.readIntrinsicGraph(topo.id)?.nodes?.[0]?.id).toBe('authored-real')
  })
})
