// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Phase 2 (entity registry): the metrics mapping is stored as entity-keyed
 * `metrics_mapping` rows, translated to/from the element-keyed HTTP wire shape
 * at the boundary. These tests cover the row round-trip, alias-following across a
 * merge, orphan surfacing, the one-shot binding→rows backfill, honest skipped
 * counts, the poller view on artifact hydrate, and no-change-path registration.
 *
 * Run with: cd apps/server/api && bun test test/db/metrics-mapping.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Attachment, NetworkGraph } from '@shumoku/core'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { attachSource, getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let svc: TopologyService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => db_.teardown())

/** Topology with a 2-node + link overlay (port identities) and a metrics source. */
async function fixture(name: string): Promise<{
  topoId: string
  nodeAId: string
  metricsId: string
}> {
  const topo = await svc.create({ name })
  const graph: NetworkGraph = {
    version: '1',
    name,
    nodes: [
      {
        id: 'a',
        label: 'A',
        shape: 'rect',
        identity: { mgmtIp: '10.0.0.1' },
        ports: [{ id: 'pa', label: 'Gi0/1', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } }],
      },
      {
        id: 'b',
        label: 'B',
        shape: 'rect',
        identity: { mgmtIp: '10.0.0.2' },
        ports: [{ id: 'pb', label: 'Gi0/2', connectors: ['rj45'], identity: { ifName: 'Gi0/2' } }],
      },
    ],
    links: [{ id: 'L1', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } }],
  } as NetworkGraph
  await svc.writeProjectOverlay(topo.id, graph)
  const metricsId = insertDataSource('zabbix', `zbx_${name}`)
  attachSource(topo.id, metricsId, 'metrics')
  const parsed = await svc.getParsed(topo.id)
  const nodeAId = parsed?.graph.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.1')?.id ?? ''
  return { topoId: topo.id, nodeAId, metricsId }
}

const rowCount = (topoId: string, kind?: string): number =>
  (
    getDatabase()
      .query(
        kind
          ? 'SELECT COUNT(*) AS n FROM metrics_mapping WHERE topology_id = ? AND kind = ?'
          : 'SELECT COUNT(*) AS n FROM metrics_mapping WHERE topology_id = ?',
      )
      .get(...(kind ? [topoId, kind] : [topoId])) as { n: number }
  ).n

describe('metrics_mapping rows (Phase 2)', () => {
  test('PUT → entity rows → GET round-trip (element-keyed in and out)', async () => {
    const { topoId, nodeAId } = await fixture('mm-roundtrip')
    await svc.updateMapping(topoId, {
      nodes: { [nodeAId]: { hostId: '42', hostName: 'hostA' } },
      links: { L1: { monitoredNodeId: nodeAId, interface: 'Gi0/1', bandwidth: 1000 } },
    })

    // Stored as entity-keyed rows (not binding attachments).
    expect(rowCount(topoId, 'node')).toBe(1)
    expect(rowCount(topoId, 'link')).toBe(1)

    // Projected back to element ids on read.
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeAId]).toEqual({ hostId: '42', hostName: 'hostA' })
    expect(m?.links?.['L1']?.monitoredNodeId).toBe(nodeAId)
    expect(m?.links?.['L1']?.interface).toBe('Gi0/1')
    expect(m?.links?.['L1']?.bandwidth).toBe(1000)

    // Clearing deletes the rows.
    await svc.updateMapping(topoId, { nodes: {}, links: {} })
    expect(rowCount(topoId)).toBe(0)
    const cleared = (await svc.getParsed(topoId))?.mapping
    expect(cleared?.nodes?.[nodeAId]).toBeUndefined()
    expect(cleared?.links?.['L1']).toBeUndefined()
  })

  test('skipped counts stay honest (element with no stable entity id)', async () => {
    const topo = await svc.create({ name: 'mm-skip' })
    // A node with NO identity gets no entityId, so its mapping can't be keyed.
    const graph: NetworkGraph = {
      version: '1',
      name: 'mm-skip',
      nodes: [{ id: 'n1', label: 'n1', shape: 'rect' }],
      links: [],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    attachSource(topo.id, insertDataSource('zabbix', 'zbx_skip'), 'metrics')
    const nodeId = (await svc.getParsed(topo.id))?.graph.nodes[0]?.id ?? 'n1'

    const { skipped } = await svc.updateMapping(topo.id, {
      nodes: { [nodeId]: { hostId: '1' } },
      links: {},
    })
    expect(skipped.nodes).toBe(1)
    expect(rowCount(topo.id)).toBe(0)
  })

  test('a row from a detached metrics source stops driving the mapping', async () => {
    const { topoId, nodeAId, metricsId } = await fixture('mm-detach')
    await svc.updateMapping(topoId, { nodes: { [nodeAId]: { hostId: '7' } }, links: {} })
    expect((await svc.getParsed(topoId))?.mapping?.nodes?.[nodeAId]?.hostId).toBe('7')

    getDatabase()
      .query("DELETE FROM topology_data_sources WHERE data_source_id = ? AND purpose = 'metrics'")
      .run(metricsId)
    svc.clearCacheEntry(topoId)
    // The row still exists, but an inactive source no longer surfaces it.
    expect(rowCount(topoId)).toBe(1)
    expect((await svc.getParsed(topoId))?.mapping?.nodes?.[nodeAId]).toBeUndefined()
  })

  test('alias-following: a row keyed by a pre-merge id resolves to the survivor', async () => {
    const topo = await svc.create({ name: 'mm-alias' })
    const graph: NetworkGraph = {
      version: '1',
      name: 'mm-alias',
      nodes: [{ id: 'a', label: 'A', shape: 'rect', identity: { chassisId: 'AA:BB:CC:00:00:01' } }],
      links: [],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    attachSource(topo.id, insertDataSource('zabbix', 'zbx_alias'), 'metrics')
    const nodeAId = (await svc.getParsed(topo.id))?.graph.nodes[0]?.id ?? 'a'

    await svc.updateMapping(topo.id, { nodes: { [nodeAId]: { hostId: '5' } }, links: {} })
    const preMergeId = (
      getDatabase()
        .query("SELECT entity_id FROM metrics_mapping WHERE topology_id = ? AND kind = 'node'")
        .get(topo.id) as { entity_id: string }
    ).entity_id

    // Simulate a merge: a survivor entity absorbs the mapped one (old_id → new_id).
    const survivorId = 'SURVIVOR0000000000000000001'
    const db = getDatabase()
    db.query(
      `INSERT INTO entity_registry (id, topology_id, kind, status, first_seen_at, last_seen_at)
       VALUES (?, ?, 'node', 'active', 0, 0)`,
    ).run(survivorId, topo.id)
    db.query('INSERT INTO entity_alias (old_id, new_id) VALUES (?, ?)').run(preMergeId, survivorId)

    // Re-stamp: the node now resolves (via alias) to the survivor id.
    svc.clearCacheEntry(topo.id)
    const restamped = await svc.getParsed(topo.id)
    expect(restamped?.graph.nodes[0]?.entityId).toBe(survivorId)
    // The mapping row still keys the pre-merge id, but alias-following surfaces it.
    expect(restamped?.mapping?.nodes?.[nodeAId]?.hostId).toBe('5')
  })

  test('orphan surfacing when the mapped entity disappears from the graph', async () => {
    const { topoId, nodeAId } = await fixture('mm-orphan')
    await svc.updateMapping(topoId, { nodes: { [nodeAId]: { hostId: '9' } }, links: {} })
    expect(await svc.mappingOrphans(topoId)).toHaveLength(0)

    // Rewrite the overlay without node A → its entity is no longer in the graph.
    await svc.writeProjectOverlay(topoId, {
      version: '1',
      name: 'mm-orphan',
      nodes: [{ id: 'b', label: 'B', shape: 'rect', identity: { mgmtIp: '10.0.0.2' } }],
      links: [],
    } as NetworkGraph)

    // The row is still present but no longer drives the mapping...
    expect(rowCount(topoId)).toBe(1)
    expect((await svc.getParsed(topoId))?.mapping?.nodes?.[nodeAId]).toBeUndefined()
    // ...and it is surfaced as an orphan.
    const orphans = await svc.mappingOrphans(topoId)
    expect(orphans).toHaveLength(1)
    expect(orphans[0]?.kind).toBe('node')
    expect(orphans[0]?.payload).toEqual({ hostId: '9' })
  })

  test('poller view (ParsedTopology.mapping) is rebuilt from rows on artifact hydrate', async () => {
    const { topoId, nodeAId } = await fixture('mm-hydrate')
    await svc.updateMapping(topoId, { nodes: { [nodeAId]: { hostId: '11' } }, links: {} })
    // First service bakes + persists the artifact.
    expect((await svc.getParsed(topoId))?.mapping?.nodes?.[nodeAId]?.hostId).toBe('11')

    // A fresh service shares the DB but has an empty RAM cache, so getParsed must
    // hydrate the persisted artifact and rebuild the mapping from the rows.
    const svc2 = new TopologyService()
    const m = (await svc2.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeAId]?.hostId).toBe('11')
  })
})

describe('metrics binding → rows backfill (Phase 2 one-shot)', () => {
  test('migrates existing metrics-binding attachments to rows and strips them', async () => {
    const topo = await svc.create({ name: 'mm-backfill' })
    const metricsId = insertDataSource('zabbix', 'zbx_backfill')
    attachSource(topo.id, metricsId, 'metrics')

    // Overlay carrying the PRE-Phase-2 representation: metrics-binding attachments.
    const nodeBinding: Attachment = {
      kind: 'metrics-binding',
      sourceId: metricsId,
      hostId: '42',
      hostName: 'hostA',
    } as Attachment
    const portBinding: Attachment = {
      kind: 'metrics-binding',
      sourceId: metricsId,
      interfaceName: 'Gi0/1',
      bandwidth: 1000,
    } as Attachment
    const graph: NetworkGraph = {
      version: '1',
      name: 'mm-backfill',
      nodes: [
        {
          id: 'a',
          label: 'A',
          shape: 'rect',
          identity: { mgmtIp: '10.1.0.1' },
          attachments: [nodeBinding],
          ports: [
            {
              id: 'pa',
              label: 'Gi0/1',
              connectors: ['rj45'],
              identity: { ifName: 'Gi0/1' },
              attachments: [portBinding],
            },
          ],
        },
        {
          id: 'b',
          label: 'B',
          shape: 'rect',
          identity: { mgmtIp: '10.1.0.2' },
          ports: [
            { id: 'pb', label: 'Gi0/2', connectors: ['rj45'], identity: { ifName: 'Gi0/2' } },
          ],
        },
      ],
      links: [{ id: 'L1', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } }],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    const nodeAId = (await svc.getParsed(topo.id))?.graph.nodes.find(
      (n) => n.identity?.mgmtIp === '10.1.0.1',
    )?.id
    expect(nodeAId).toBeTruthy()

    // Nothing in the rows yet — the mapping still comes from the bindings.
    expect(rowCount(topo.id)).toBe(0)

    await svc.backfillMetricsMappingRows()

    // Bindings migrated to rows (1 node + 1 link).
    expect(rowCount(topo.id, 'node')).toBe(1)
    expect(rowCount(topo.id, 'link')).toBe(1)

    // And they derive back element-keyed, identically.
    const m = (await svc.getParsed(topo.id))?.mapping
    expect(m?.nodes?.[nodeAId as string]).toEqual({ hostId: '42', hostName: 'hostA' })
    expect(m?.links?.['L1']?.interface).toBe('Gi0/1')
    expect(m?.links?.['L1']?.bandwidth).toBe(1000)

    // The binding attachments are stripped from the overlay (no longer read).
    const overlay = svc.readProjectOverlay(topo.id)
    const stillHasBinding = (overlay?.nodes ?? []).some(
      (n) =>
        (n.attachments ?? []).some((att) => att.kind === 'metrics-binding') ||
        (n.ports ?? []).some((p) =>
          (p.attachments ?? []).some((att) => att.kind === 'metrics-binding'),
        ),
    )
    expect(stillHasBinding).toBe(false)
  })
})

describe('no-change-path entity registration', () => {
  test('adopt-or-mint re-runs on an identical (no-change) re-scan', async () => {
    const obs = new ObservationsService()
    const db = getDatabase()
    const topoId = 't_nochange_reg'
    db.query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)').run(
      topoId,
      topoId,
    )
    const src = insertDataSource('zabbix', 'ds_nochange_reg')
    attachSource(topoId, src, 'topology')

    const graph: NetworkGraph = {
      version: '1',
      name: 't',
      nodes: [{ id: 'n', label: 'n', shape: 'rect', identity: { sysName: 'core-1' } }],
      links: [],
    } as NetworkGraph

    const first = await obs.record({
      topologyId: topoId,
      sourceId: src,
      capturedAt: 1000,
      status: 'ok',
      graph,
    })
    expect(first.contributionChanged).toBe(true)
    const countOf = (): number =>
      (
        db.query('SELECT COUNT(*) AS n FROM entity_registry WHERE topology_id = ?').get(topoId) as {
          n: number
        }
      ).n
    expect(countOf()).toBeGreaterThan(0)

    // Simulate a lost / never-minted registry, then re-scan identical content.
    db.query(
      'DELETE FROM entity_alias WHERE old_id IN (SELECT id FROM entity_registry WHERE topology_id = ?)',
    ).run(topoId)
    db.query('DELETE FROM entity_identity_key WHERE topology_id = ?').run(topoId)
    db.query('DELETE FROM entity_registry WHERE topology_id = ?').run(topoId)
    expect(countOf()).toBe(0)

    const second = await obs.record({
      topologyId: topoId,
      sourceId: src,
      capturedAt: 2000,
      status: 'ok',
      graph,
    })
    // The content is unchanged (gate hits) BUT the entity is re-registered.
    expect(second.contributionChanged).toBe(false)
    expect(countOf()).toBeGreaterThan(0)
  })
})
