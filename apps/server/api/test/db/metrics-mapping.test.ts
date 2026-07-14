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
  linkKey: string
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
  // Phase 3: the resolved link id IS the entity id now — the element-keyed wire
  // shape keys on it, so derive the key from the (flipped) resolved graph rather
  // than assuming the authored 'L1'.
  const linkKey = parsed?.graph.links[0]?.id ?? 'link-0'
  return { topoId: topo.id, nodeAId, linkKey, metricsId }
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
    const { topoId, nodeAId, linkKey } = await fixture('mm-roundtrip')
    await svc.updateMapping(topoId, {
      nodes: { [nodeAId]: { hostId: '42', hostName: 'hostA' } },
      links: { [linkKey]: { monitoredNodeId: nodeAId, interface: 'Gi0/1', bandwidth: 1000 } },
    })

    // Stored as entity-keyed rows (not binding attachments).
    expect(rowCount(topoId, 'node')).toBe(1)
    expect(rowCount(topoId, 'link')).toBe(1)

    // Projected back to element ids on read.
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeAId]).toEqual({ hostId: '42', hostName: 'hostA' })
    expect(m?.links?.[linkKey]?.monitoredNodeId).toBe(nodeAId)
    expect(m?.links?.[linkKey]?.interface).toBe('Gi0/1')
    expect(m?.links?.[linkKey]?.bandwidth).toBe(1000)

    // Clearing deletes the rows.
    await svc.updateMapping(topoId, { nodes: {}, links: {} })
    expect(rowCount(topoId)).toBe(0)
    const cleared = (await svc.getParsed(topoId))?.mapping
    expect(cleared?.nodes?.[nodeAId]).toBeUndefined()
    expect(cleared?.links?.[linkKey]).toBeUndefined()
  })

  test('link row survives the Phase 3 id flip via the persisted entity id', async () => {
    const { topoId, nodeAId, linkKey } = await fixture('mm-flip-link')
    await svc.updateMapping(topoId, {
      nodes: { [nodeAId]: { hostId: '42', hostName: 'hostA' } },
      links: { [linkKey]: { monitoredNodeId: nodeAId, interface: 'Gi0/1', bandwidth: 1000 } },
    })
    // The persisted payload references the monitored node by ENTITY id, not the
    // (flip-unstable) element id — the poller looks the projected id up in
    // mapping.nodes, so it must be a current node id.
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.links?.[linkKey]?.monitoredNodeId).toBe(nodeAId)
    expect(Object.keys(m?.nodes ?? {})).toContain(m?.links?.[linkKey]?.monitoredNodeId)
  })

  test('legacy pre-flip link row self-heals: stale monitoredNodeId → current id via interface', async () => {
    const { topoId, nodeAId, linkKey, metricsId } = await fixture('mm-legacy')
    const parsed = await svc.getParsed(topoId)
    const entityId = parsed?.graph.links.find((l) => (l.id ?? '') === linkKey)?.entityId ?? ''
    // Simulate a row written BEFORE Phase 3: payload carries a now-stale element
    // id and NO monitoredNodeEntityId; the interface names the monitored port
    // (node 'a' has port ifName Gi0/1).
    getDatabase()
      .query(
        `INSERT OR REPLACE INTO metrics_mapping
           (topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at)
         VALUES (?, ?, 'link', ?, ?, 0, 0)`,
      )
      .run(
        topoId,
        entityId,
        metricsId,
        JSON.stringify({ monitoredNodeId: 'discovered:STALE', interface: 'Gi0/1', bandwidth: 500 }),
      )
    svc.clearCacheEntry(topoId)

    const emitted = (await svc.getParsed(topoId))?.mapping?.links?.[linkKey]?.monitoredNodeId
    // Recovered to the CURRENT monitored node id, never the stale reference.
    expect(emitted).not.toBe('discovered:STALE')
    expect(emitted).toBe(nodeAId)
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
    // Phase 3: node.id IS the entity id, so after the merge the node is keyed by
    // the SURVIVOR id. The mapping row still stores the pre-merge id, but
    // alias-following surfaces it under the node's current (survivor) id.
    expect(restamped?.graph.nodes[0]?.id).toBe(survivorId)
    expect(restamped?.mapping?.nodes?.[survivorId]?.hostId).toBe('5')
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

    // And they derive back element-keyed, identically. The link key is the
    // flipped resolved link id (the entity id), not the authored 'L1'.
    const parsedAfter = await svc.getParsed(topo.id)
    const linkKey = parsedAfter?.graph.links[0]?.id ?? 'link-0'
    const m = parsedAfter?.mapping
    expect(m?.nodes?.[nodeAId as string]).toEqual({ hostId: '42', hostName: 'hostA' })
    expect(m?.links?.[linkKey]?.interface).toBe('Gi0/1')
    expect(m?.links?.[linkKey]?.bandwidth).toBe(1000)

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

// ---------------------------------------------------------------------------
// Fix 1 (#547): two metrics sources, same entity — both rows must persist and
// source-priority precedence must govern the projected mapping.
// ---------------------------------------------------------------------------

describe('multi-source metrics mapping (Fix 1 — #547)', () => {
  test('two sources map the same entity: both rows persist independently', async () => {
    const { topoId, nodeAId } = await fixture('ms-two-sources-persist')
    // Add a second metrics source with lower priority (higher number → lower precedence).
    const metricsId2 = insertDataSource('prometheus', 'prom_two_persist')
    const db = getDatabase()
    const now = Date.now()
    db.query(
      `INSERT INTO topology_data_sources (id, topology_id, data_source_id, purpose, sync_mode, priority, created_at, updated_at)
       VALUES (?, ?, ?, 'metrics', 'manual', 10, ?, ?)`,
    ).run(`tds_${topoId}_${metricsId2}_metrics`, topoId, metricsId2, now, now)

    // Write node mapping from source 1 (priority 0 by default from fixture).
    await svc.updateMapping(topoId, { nodes: { [nodeAId]: { hostId: 'src1-host' } }, links: {} })
    const rowCountBefore = rowCount(topoId, 'node')
    expect(rowCountBefore).toBe(1)

    // Write node mapping from source 2 directly (updateMapping uses the first source;
    // insert the second source's row manually to simulate its write path).
    const entityId = (
      db
        .query("SELECT entity_id FROM metrics_mapping WHERE topology_id = ? AND kind = 'node'")
        .get(topoId) as { entity_id: string }
    ).entity_id
    db.query(
      `INSERT INTO metrics_mapping (topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at)
       VALUES (?, ?, 'node', ?, ?, ?, ?)`,
    ).run(topoId, entityId, metricsId2, JSON.stringify({ hostId: 'src2-host' }), now, now)
    svc.clearCacheEntry(topoId)

    // Both rows must coexist — the new PK prevents the second write from destroying the first.
    expect(rowCount(topoId, 'node')).toBe(2)
  })

  test('projection prefers the higher-priority source (lower priority number)', async () => {
    const { topoId, nodeAId, metricsId } = await fixture('ms-priority')
    const db = getDatabase()
    const now = Date.now()
    const metricsId2 = insertDataSource('prometheus', 'prom_priority')
    // priority=10 → lower precedence than the fixture's default priority=0.
    db.query(
      `INSERT INTO topology_data_sources (id, topology_id, data_source_id, purpose, sync_mode, priority, created_at, updated_at)
       VALUES (?, ?, ?, 'metrics', 'manual', 10, ?, ?)`,
    ).run(`tds_${topoId}_${metricsId2}_metrics`, topoId, metricsId2, now, now)

    // Write mapping from the default (priority=0) source → hostId='winner'.
    await svc.updateMapping(topoId, { nodes: { [nodeAId]: { hostId: 'winner' } }, links: {} })
    const entityId = (
      db
        .query("SELECT entity_id FROM metrics_mapping WHERE topology_id = ? AND kind = 'node'")
        .get(topoId) as { entity_id: string }
    ).entity_id
    // Write mapping from source 2 (priority=10) for the same entity → hostId='loser'.
    db.query(
      `INSERT INTO metrics_mapping (topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at)
       VALUES (?, ?, 'node', ?, ?, ?, ?)`,
    ).run(topoId, entityId, metricsId2, JSON.stringify({ hostId: 'loser' }), now, now)
    svc.clearCacheEntry(topoId)

    // The higher-priority source (priority=0) must win in the projected mapping.
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeAId]?.hostId).toBe('winner')

    // The poller consumes the lossless per-source view, so each plugin receives
    // the host-id namespace it owns even though the compatibility projection
    // above exposes only the priority winner.
    const parsed = await svc.getParsed(topoId)
    expect(parsed).not.toBeNull()
    if (!parsed) return
    const bySource = svc.buildMappingsBySource(topoId, parsed.graph)
    expect(bySource.get(metricsId)?.nodes[nodeAId]?.hostId).toBe('winner')
    expect(bySource.get(metricsId2)?.nodes[nodeAId]?.hostId).toBe('loser')
  })

  test('deleting one source mapping leaves the other intact', async () => {
    const { topoId, nodeAId } = await fixture('ms-delete-one')
    const db = getDatabase()
    const now = Date.now()
    const metricsId2 = insertDataSource('prometheus', 'prom_delete_one')
    db.query(
      `INSERT INTO topology_data_sources (id, topology_id, data_source_id, purpose, sync_mode, priority, created_at, updated_at)
       VALUES (?, ?, ?, 'metrics', 'manual', 10, ?, ?)`,
    ).run(`tds_${topoId}_${metricsId2}_metrics`, topoId, metricsId2, now, now)

    // Write mapping from the default source.
    await svc.updateMapping(topoId, { nodes: { [nodeAId]: { hostId: 'src1' } }, links: {} })
    const entityId = (
      db
        .query("SELECT entity_id FROM metrics_mapping WHERE topology_id = ? AND kind = 'node'")
        .get(topoId) as { entity_id: string }
    ).entity_id
    // Write mapping from source 2.
    const src2Row = JSON.stringify({ hostId: 'src2' })
    db.query(
      `INSERT INTO metrics_mapping (topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at)
       VALUES (?, ?, 'node', ?, ?, ?, ?)`,
    ).run(topoId, entityId, metricsId2, src2Row, now, now)
    expect(rowCount(topoId, 'node')).toBe(2)

    // Delete the DEFAULT (high-priority) source's row by calling updateMapping with an empty mapping.
    // updateMapping uses the first (highest-priority) metrics source — that clears source 1's row.
    await svc.updateMapping(topoId, { nodes: {}, links: {} })

    // Source 2's row must still exist.
    expect(rowCount(topoId, 'node')).toBe(1)
    const remaining = db
      .query("SELECT source_id FROM metrics_mapping WHERE topology_id = ? AND kind = 'node'")
      .get(topoId) as { source_id: string } | null
    expect(remaining?.source_id).toBe(metricsId2)
    // And source 2 now wins the projection (it's the only active mapping).
    svc.clearCacheEntry(topoId)
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[nodeAId]?.hostId).toBe('src2')
  })
})

// ---------------------------------------------------------------------------
// Fix 3 (#547): link entry whose monitoredNodeId has no entityId → skipped.links
// incremented, no row written.
// ---------------------------------------------------------------------------

describe('link writeMappingRows with unresolvable monitored node (Fix 3 — #547)', () => {
  test('link entry with monitoredNodeId that has no entityId → skipped.links++, no row', async () => {
    const topo = await svc.create({ name: 'fix3-link-skip' })
    // Two nodes, both with identities so the graph resolves cleanly. Node B
    // will be used as the link's entityId anchor; node A's resolved id will be
    // used as the `monitoredNodeId` in the link mapping entry. After getParsed,
    // we manually clear node A's entityId in the resolved graph to simulate the
    // "monitored node has no entityId" scenario at write time.
    //
    // Simpler: use a graph where both endpoints have stable entities, then pass
    // a monitoredNodeId that doesn't exist in the resolved graph at all — the
    // nodeById.get() returns undefined, which means entityId is undefined.
    const graph: NetworkGraph = {
      version: '1',
      name: 'fix3-link-skip',
      nodes: [
        {
          id: 'a',
          label: 'A',
          shape: 'rect',
          identity: { mgmtIp: '10.7.0.1' },
          ports: [
            { id: 'pa', label: 'Gi0/1', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } },
          ],
        },
        {
          id: 'b',
          label: 'B',
          shape: 'rect',
          identity: { mgmtIp: '10.7.0.2' },
          ports: [
            { id: 'pb', label: 'Gi0/2', connectors: ['rj45'], identity: { ifName: 'Gi0/2' } },
          ],
        },
      ],
      links: [{ id: 'L1', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } }],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    attachSource(topo.id, insertDataSource('zabbix', 'zbx_fix3'), 'metrics')
    const parsed = await svc.getParsed(topo.id)
    const linkKey = parsed?.graph.links[0]?.id ?? 'link-0'
    const nodeAId = parsed?.graph.nodes.find((n) => n.identity?.mgmtIp === '10.7.0.1')?.id ?? 'a'

    // Pass a monitoredNodeId that does NOT exist in the resolved graph — nodeById.get()
    // returns undefined so entityId is undefined, which is exactly the scenario we guard.
    const GHOST_NODE_ID = 'ghost-node-never-in-graph'
    const { skipped } = await svc.updateMapping(topo.id, {
      nodes: {},
      links: { [linkKey]: { monitoredNodeId: GHOST_NODE_ID, interface: 'Gi0/1' } },
    })

    // The row must NOT be written (a doomed row would silently vanish post-flip).
    expect(rowCount(topo.id, 'link')).toBe(0)
    // The skip IS counted so the UI warning fires.
    expect(skipped.links).toBe(1)
    // Node A's identity is present so its mapping is unaffected.
    const { skipped: s2 } = await svc.updateMapping(topo.id, {
      nodes: { [nodeAId]: { hostId: '99' } },
      links: {},
    })
    expect(s2.nodes).toBe(0)
    expect(rowCount(topo.id, 'node')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Fix 4 (#547): ambiguous legacy interface fallback — if the stored interface
// matches BOTH endpoints, resolveMonitoredNodeId must return undefined so the
// row surfaces as an orphan rather than guessing the wrong endpoint.
// ---------------------------------------------------------------------------

describe('resolveMonitoredNodeId ambiguous fallback (Fix 4 — #547)', () => {
  test('legacy row whose interface matches both endpoints → projected mapping omits it and it appears in orphans', async () => {
    const topo = await svc.create({ name: 'fix4-ambiguous' })
    // Both endpoints carry ports with the SAME ifName 'Gi0/1', simulating a
    // LAG port or a naming collision that makes the interface name ambiguous.
    const graph: NetworkGraph = {
      version: '1',
      name: 'fix4-ambiguous',
      nodes: [
        {
          id: 'a',
          label: 'A',
          shape: 'rect',
          identity: { mgmtIp: '10.8.0.1' },
          ports: [{ id: 'pa', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } }],
        },
        {
          id: 'b',
          label: 'B',
          shape: 'rect',
          identity: { mgmtIp: '10.8.0.2' },
          ports: [
            // Same ifName on the OTHER end → ambiguous match.
            { id: 'pb', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } },
          ],
        },
      ],
      links: [{ id: 'L1', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } }],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    const metricsId = insertDataSource('zabbix', 'zbx_fix4')
    attachSource(topo.id, metricsId, 'metrics')
    const parsed = await svc.getParsed(topo.id)
    const linkEntityId =
      parsed?.graph.links.find((l) => l.from?.port === 'pa')?.entityId ??
      parsed?.graph.links[0]?.id ??
      ''

    // Inject a LEGACY row (no monitoredNodeEntityId): interface 'Gi0/1' matches both ports.
    getDatabase()
      .query(
        `INSERT INTO metrics_mapping
           (topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at)
         VALUES (?, ?, 'link', ?, ?, 0, 0)`,
      )
      .run(
        topo.id,
        linkEntityId,
        metricsId,
        JSON.stringify({ monitoredNodeId: 'stale-id', interface: 'Gi0/1', bandwidth: 500 }),
      )
    svc.clearCacheEntry(topo.id)

    // The projected mapping must NOT include a link entry (ambiguous → orphan).
    const m = (await svc.getParsed(topo.id))?.mapping
    const linkKey = parsed?.graph.links[0]?.id ?? 'link-0'
    expect(m?.links?.[linkKey]).toBeUndefined()

    // The row must surface as an orphan.
    const orphans = await svc.mappingOrphans(topo.id)
    expect(orphans.some((o) => o.kind === 'link')).toBe(true)
  })

  test('exactly-one interface match still resolves to the correct endpoint', async () => {
    const topo = await svc.create({ name: 'fix4-unambiguous' })
    const graph: NetworkGraph = {
      version: '1',
      name: 'fix4-unambiguous',
      nodes: [
        {
          id: 'a',
          label: 'A',
          shape: 'rect',
          identity: { mgmtIp: '10.9.0.1' },
          ports: [{ id: 'pa', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } }],
        },
        {
          id: 'b',
          label: 'B',
          shape: 'rect',
          identity: { mgmtIp: '10.9.0.2' },
          ports: [{ id: 'pb', connectors: ['rj45'], identity: { ifName: 'Gi0/2' } }],
        },
      ],
      links: [{ id: 'L1', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } }],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    const metricsId = insertDataSource('zabbix', 'zbx_fix4b')
    attachSource(topo.id, metricsId, 'metrics')
    const parsed = await svc.getParsed(topo.id)
    const linkKey = parsed?.graph.links[0]?.id ?? 'link-0'
    const linkEntityId = parsed?.graph.links[0]?.entityId ?? linkKey
    const nodeAId = parsed?.graph.nodes.find((n) => n.identity?.mgmtIp === '10.9.0.1')?.id ?? 'a'

    // Legacy row: interface 'Gi0/1' matches ONLY node A's port → unambiguous.
    getDatabase()
      .query(
        `INSERT INTO metrics_mapping
           (topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at)
         VALUES (?, ?, 'link', ?, ?, 0, 0)`,
      )
      .run(
        topo.id,
        linkEntityId,
        metricsId,
        JSON.stringify({ monitoredNodeId: 'stale-id', interface: 'Gi0/1', bandwidth: 1000 }),
      )
    svc.clearCacheEntry(topo.id)

    const emitted = (await svc.getParsed(topo.id))?.mapping?.links?.[linkKey]
    // Resolves to node A (the only endpoint with Gi0/1), never the stale id.
    expect(emitted?.monitoredNodeId).toBe(nodeAId)
    expect(emitted?.interface).toBe('Gi0/1')
  })
})

// ---------------------------------------------------------------------------
// Silent-drop hardening (found by live-testing the autosave flow): a write
// that cannot land must never return a clean success.
// ---------------------------------------------------------------------------

describe('mapping silent-drop hardening', () => {
  test('bandwidth-only link entry persists and round-trips (no monitored node)', async () => {
    const { topoId, linkKey } = await fixture('mm-bw-only')
    const result = await svc.updateMapping(topoId, {
      nodes: {},
      links: { [linkKey]: { bandwidth: 10_000_000_000 } },
    })
    expect(result.error).toBeUndefined()
    expect(result.skipped).toEqual({ nodes: 0, links: 0 })
    expect(rowCount(topoId, 'link')).toBe(1)

    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.links?.[linkKey]?.bandwidth).toBe(10_000_000_000)
    expect(m?.links?.[linkKey]?.monitoredNodeId).toBeUndefined()
  })

  test('interface-only link entry (partial edit) persists across reads', async () => {
    const { topoId, linkKey } = await fixture('mm-iface-only')
    await svc.updateMapping(topoId, {
      nodes: {},
      links: { [linkKey]: { interface: 'Gi0/1' } },
    })
    expect(rowCount(topoId, 'link')).toBe(1)
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.links?.[linkKey]?.interface).toBe('Gi0/1')
  })

  test('patchLinkMapping: bandwidth-only write → row; empty patch → row deleted', async () => {
    const { topoId, linkKey } = await fixture('mm-patch-bw')
    const patched = await svc.patchLinkMapping(topoId, linkKey, { bandwidth: 1_000_000_000 })
    expect(patched.error).toBeUndefined()
    expect(patched.linkMapping?.bandwidth).toBe(1_000_000_000)
    expect(rowCount(topoId, 'link')).toBe(1)

    const cleared = await svc.patchLinkMapping(topoId, linkKey, null)
    expect(cleared.linkMapping).toBeNull()
    expect(rowCount(topoId, 'link')).toBe(0)
  })

  test('no metrics source: non-empty PUT fails loudly; empty PUT stays a no-op success', async () => {
    // Same overlay as fixture() but WITHOUT attaching a metrics source.
    const topo = await svc.create({ name: 'mm-no-source' })
    const graph: NetworkGraph = {
      version: '1',
      name: 'mm-no-source',
      nodes: [
        {
          id: 'a',
          label: 'A',
          shape: 'rect',
          identity: { mgmtIp: '10.0.9.1' },
          ports: [
            { id: 'pa', label: 'Gi0/1', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } },
          ],
        },
        {
          id: 'b',
          label: 'B',
          shape: 'rect',
          identity: { mgmtIp: '10.0.9.2' },
          ports: [
            { id: 'pb', label: 'Gi0/2', connectors: ['rj45'], identity: { ifName: 'Gi0/2' } },
          ],
        },
      ],
      links: [{ id: 'L1', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } }],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    const parsed = await svc.getParsed(topo.id)
    const linkKey = parsed?.graph.links[0]?.id ?? 'link-0'
    const nodeAId = parsed?.graph.nodes[0]?.id ?? 'a'

    const put = await svc.updateMapping(topo.id, {
      nodes: { [nodeAId]: { hostId: '42' } },
      links: {},
    })
    expect(put.error).toBe('noMetricsSource')
    expect(rowCount(topo.id)).toBe(0)

    const patch = await svc.patchLinkMapping(topo.id, linkKey, { bandwidth: 1000 })
    expect(patch.error).toBe('noMetricsSource')
    expect(rowCount(topo.id)).toBe(0)

    // Clears remain no-op successes: nothing to delete, nothing to lose.
    const emptyPut = await svc.updateMapping(topo.id, { nodes: {}, links: {} })
    expect(emptyPut.error).toBeUndefined()
    const emptyPatch = await svc.patchLinkMapping(topo.id, linkKey, null)
    expect(emptyPatch.error).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Auto-map lazy interface fetch: hosts are only queried for links the planner
// will actually evaluate. Fully-mapped topology + overwrite:false → ZERO
// upstream calls (pressing Auto-map used to serially fetch every host's items
// just to answer "0 matched").
// ---------------------------------------------------------------------------

describe('autoMapLinks lazy interface fetch', () => {
  /** Counting getHostItems stub — autoMapLinks touches nothing else on the service. */
  function stubDataSources(): {
    ds: import('../../src/services/datasource.ts').DataSourceService
    calls: () => number
  } {
    let n = 0
    const ds = {
      getHostItems: async () => {
        n++
        return []
      },
    } as unknown as import('../../src/services/datasource.ts').DataSourceService
    return { ds, calls: () => n }
  }

  test('fully-mapped links + overwrite:false → no upstream calls', async () => {
    const { topoId, nodeAId, linkKey } = await fixture('mm-lazy-skip')
    await svc.updateMapping(topoId, {
      nodes: { [nodeAId]: { hostId: '42', hostName: 'hostA' } },
      links: { [linkKey]: { monitoredNodeId: nodeAId, interface: 'Gi0/1' } },
    })

    const { ds, calls } = stubDataSources()
    const result = await svc.autoMapLinks(topoId, ds, { overwrite: false })
    expect(result.matched).toBe(0)
    expect(result.skipped).toBe(1)
    expect(calls()).toBe(0)
  })

  test('unmapped link with a mapped endpoint → fetches that host once', async () => {
    const { topoId, nodeAId } = await fixture('mm-lazy-fetch')
    await svc.updateMapping(topoId, {
      nodes: { [nodeAId]: { hostId: '42', hostName: 'hostA' } },
      links: {},
    })

    const { ds, calls } = stubDataSources()
    await svc.autoMapLinks(topoId, ds, { overwrite: false })
    expect(calls()).toBe(1)
  })
})
