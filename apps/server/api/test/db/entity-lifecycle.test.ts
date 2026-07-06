// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Phase 4 (entity registry): entity lifecycle — retirement, orphan
 * reassignment / discard, and full registry reset.
 *
 * Covers:
 *   - retire after N consecutive syncs of a source that returned data
 *   - a failed-fetch sync does NOT retire (source outage ≠ absence)
 *   - a retired entity re-observed → active again, SAME id
 *   - last_seen_at advances on the no-change re-scan path
 *   - orphan reassign moves the row and it projects onto the new element
 *   - reassign validates the target (kind + presence)
 *   - discard removes the orphan row
 *   - registry reset clears the tables and a subsequent resolve re-mints
 *
 * Run with: cd apps/server/api && bun test test/db/entity-lifecycle.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { RETIRE_THRESHOLD_SYNCS } from '../../src/services/entity-registry.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { attachSource, getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let svc: TopologyService
let obs: ObservationsService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
  obs = new ObservationsService()
})
afterAll(() => db_.teardown())

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A one-node graph keyed by a stable sysName identity. */
function nodeGraph(sysName: string, extra: NetworkGraph['nodes'] = []): NetworkGraph {
  return {
    version: '1',
    name: 't',
    nodes: [{ id: sysName, label: sysName, shape: 'rect', identity: { sysName } }, ...extra],
    links: [],
  } as NetworkGraph
}

function entityStatus(entityId: string): { status: string; retired_at: number | null } | null {
  return getDatabase()
    .query('SELECT status, retired_at FROM entity_registry WHERE id = ?')
    .get(entityId) as { status: string; retired_at: number | null } | null
}

function nodeEntityId(topologyId: string, sysName: string): string | undefined {
  const row = getDatabase()
    .query(
      `SELECT er.id AS id FROM entity_registry er
       JOIN entity_identity_key k ON k.entity_id = er.id
       WHERE er.topology_id = ? AND k.key = 'sysName' AND k.value = ?`,
    )
    .get(topologyId, sysName.toLowerCase()) as { id: string } | undefined
  return row?.id
}

/** Record an observed sync for a source (mirrors a scan landing). */
async function sync(
  topologyId: string,
  sourceId: string,
  capturedAt: number,
  graph: NetworkGraph | null,
  status: 'ok' | 'failed' | 'partial' = 'ok',
): Promise<void> {
  await obs.record({ topologyId, sourceId, capturedAt, status, graph })
}

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

describe('entity retirement', () => {
  test(`an entity missed by ${RETIRE_THRESHOLD_SYNCS} good syncs is retired (source reporting OK)`, async () => {
    const topo = await svc.create({ name: 'retire-basic' })
    const src = insertDataSource('zabbix', 'zbx_retire_basic')
    attachSource(topo.id, src, 'topology')

    // First sync sees A + B.
    await sync(topo.id, src, 1000, {
      version: '1',
      name: 't',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', identity: { sysName: 'A' } },
        { id: 'B', label: 'B', shape: 'rect', identity: { sysName: 'B' } },
      ],
      links: [],
    } as NetworkGraph)

    const bId = nodeEntityId(topo.id, 'B')
    expect(bId).toBeTruthy()
    expect(entityStatus(bId ?? '')?.status).toBe('active')

    // Subsequent good syncs see ONLY A — B is absent but the source reported.
    for (let i = 1; i <= RETIRE_THRESHOLD_SYNCS; i++) {
      await sync(topo.id, src, 1000 + i * 1000, nodeGraph('A'))
    }

    // A stays active; B crossed the miss threshold → retired (id preserved).
    expect(entityStatus(nodeEntityId(topo.id, 'A') ?? '')?.status).toBe('active')
    expect(entityStatus(bId ?? '')?.status).toBe('retired')
  })

  test('a FAILED-fetch sync does NOT retire (an outage is not absence)', async () => {
    const topo = await svc.create({ name: 'retire-failure' })
    const src = insertDataSource('zabbix', 'zbx_retire_failure')
    attachSource(topo.id, src, 'topology')

    await sync(topo.id, src, 1000, {
      version: '1',
      name: 't',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', identity: { sysName: 'A' } },
        { id: 'B', label: 'B', shape: 'rect', identity: { sysName: 'B' } },
      ],
      links: [],
    } as NetworkGraph)
    const bId = nodeEntityId(topo.id, 'B')

    // Many FAILED fetches (source is down): the retire pass must not run at all,
    // so B's miss counter never advances (an outage is not an absence).
    for (let i = 1; i <= RETIRE_THRESHOLD_SYNCS + 2; i++) {
      await sync(topo.id, src, 1000 + i * 1000, null, 'failed')
    }

    // B stays active regardless of how many fetches failed.
    expect(entityStatus(bId ?? '')?.status).toBe('active')
    // The initial good sync seeded a miss=0 counter row for B; failed syncs
    // never incremented it (they short-circuit before the retire pass).
    const bMiss = getDatabase()
      .query(
        'SELECT miss_count AS m FROM entity_retire_counter WHERE topology_id = ? AND entity_id = ?',
      )
      .get(topo.id, bId ?? '') as { m: number } | null
    expect(bMiss?.m ?? 0).toBe(0)
  })

  // -- Fix 2 (#547): partial scans must NOT run the retire pass. --

  test('a PARTIAL scan ingests data but does NOT increment retire counters (Fix 2 — #547)', async () => {
    const topo = await svc.create({ name: 'retire-partial' })
    const src = insertDataSource('zabbix', 'zbx_retire_partial')
    attachSource(topo.id, src, 'topology')

    // First sync sees A + B (full scan).
    await sync(topo.id, src, 1000, {
      version: '1',
      name: 't',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', identity: { sysName: 'A' } },
        { id: 'B', label: 'B', shape: 'rect', identity: { sysName: 'B' } },
      ],
      links: [],
    } as NetworkGraph)
    const bId = nodeEntityId(topo.id, 'B')
    expect(bId).toBeTruthy()

    const missCountOf = (): number => {
      const row = getDatabase()
        .query(
          'SELECT miss_count AS m FROM entity_retire_counter WHERE topology_id = ? AND entity_id = ?',
        )
        .get(topo.id, bId ?? '') as { m: number } | null
      return row?.m ?? 0
    }

    // PARTIAL scans that only report node A (B is absent in this partial result):
    // must ingest A's data but must NOT bump B's miss counter.
    for (let i = 1; i <= RETIRE_THRESHOLD_SYNCS + 2; i++) {
      await sync(topo.id, src, 1000 + i * 1000, nodeGraph('A'), 'partial')
    }

    // B stays active — 3 consecutive partials must not retire live entities.
    expect(entityStatus(bId ?? '')?.status).toBe('active')
    // The miss counter never advanced: a partial enumeration proves nothing about absence.
    expect(missCountOf()).toBe(0)
  })

  test('3 partials retire nothing; a subsequent ok scan missing the entity resumes counting (Fix 2 — #547)', async () => {
    const topo = await svc.create({ name: 'retire-partial-ok' })
    const src = insertDataSource('zabbix', 'zbx_retire_partial_ok')
    attachSource(topo.id, src, 'topology')

    await sync(topo.id, src, 1000, {
      version: '1',
      name: 't',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', identity: { sysName: 'A' } },
        { id: 'B', label: 'B', shape: 'rect', identity: { sysName: 'B' } },
      ],
      links: [],
    } as NetworkGraph)
    const bId = nodeEntityId(topo.id, 'B')

    // Three partial scans seeing only A — retire must not run.
    for (let i = 1; i <= 3; i++) {
      await sync(topo.id, src, 1000 + i * 1000, nodeGraph('A'), 'partial')
    }
    expect(entityStatus(bId ?? '')?.status).toBe('active')

    // Now a full 'ok' scan that ALSO misses B — this SHOULD count misses.
    for (let i = 4; i <= 3 + RETIRE_THRESHOLD_SYNCS; i++) {
      await sync(topo.id, src, 1000 + i * 1000, nodeGraph('A'))
    }
    // After exactly RETIRE_THRESHOLD_SYNCS consecutive 'ok' misses, B is retired.
    expect(entityStatus(bId ?? '')?.status).toBe('retired')
  })

  test('a retired entity re-observed becomes active again with the SAME id', async () => {
    const topo = await svc.create({ name: 'retire-unretire' })
    const src = insertDataSource('zabbix', 'zbx_retire_unretire')
    attachSource(topo.id, src, 'topology')

    await sync(topo.id, src, 1000, {
      version: '1',
      name: 't',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', identity: { sysName: 'A' } },
        { id: 'B', label: 'B', shape: 'rect', identity: { sysName: 'B' } },
      ],
      links: [],
    } as NetworkGraph)
    const bId = nodeEntityId(topo.id, 'B')
    expect(bId).toBeTruthy()

    // Retire B by missing it N times.
    for (let i = 1; i <= RETIRE_THRESHOLD_SYNCS; i++) {
      await sync(topo.id, src, 1000 + i * 1000, nodeGraph('A'))
    }
    expect(entityStatus(bId ?? '')?.status).toBe('retired')

    // B returns — same identity → adopt re-uses the id and clears retirement.
    await sync(topo.id, src, 100_000, {
      version: '1',
      name: 't',
      nodes: [
        { id: 'A', label: 'A', shape: 'rect', identity: { sysName: 'A' } },
        { id: 'B', label: 'B', shape: 'rect', identity: { sysName: 'B' } },
      ],
      links: [],
    } as NetworkGraph)

    expect(nodeEntityId(topo.id, 'B')).toBe(bId)
    const st = entityStatus(bId ?? '')
    expect(st?.status).toBe('active')
    expect(st?.retired_at).toBeNull()
  })

  test('last_seen_at advances on the no-change re-scan path', async () => {
    const topo = await svc.create({ name: 'retire-lastseen' })
    const src = insertDataSource('zabbix', 'zbx_retire_lastseen')
    attachSource(topo.id, src, 'topology')

    const graph = nodeGraph('LS')
    await sync(topo.id, src, 1000, graph)
    const id = nodeEntityId(topo.id, 'LS')
    expect(id).toBeTruthy()
    const before = getDatabase()
      .query('SELECT last_seen_at AS t FROM entity_registry WHERE id = ?')
      .get(id ?? '') as { t: number }

    // Byte-identical re-scan → the no-change gate hits, but adopt still refreshes.
    const second = await obs.record({
      topologyId: topo.id,
      sourceId: src,
      capturedAt: 5000,
      status: 'ok',
      graph,
    })
    expect(second.contributionChanged).toBe(false)

    const after = getDatabase()
      .query('SELECT last_seen_at AS t FROM entity_registry WHERE id = ?')
      .get(id ?? '') as { t: number }
    expect(after.t).toBeGreaterThan(before.t)
  })
})

// ---------------------------------------------------------------------------
// Orphan reassignment / discard (via TopologyService)
// ---------------------------------------------------------------------------

/**
 * A topology with two identity-bearing nodes + a metrics source, and a node
 * mapping on A. Rewriting the overlay to drop A orphans that mapping.
 */
async function orphanFixture(name: string): Promise<{
  topoId: string
  metricsId: string
  aEntityId: string
  bEntityId: string
}> {
  const topo = await svc.create({ name })
  const graph: NetworkGraph = {
    version: '1',
    name,
    nodes: [
      { id: 'a', label: 'A', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } },
      { id: 'b', label: 'B', shape: 'rect', identity: { mgmtIp: '10.0.0.2' } },
    ],
    links: [],
  } as NetworkGraph
  await svc.writeProjectOverlay(topo.id, graph)
  const metricsId = insertDataSource('zabbix', `zbx_${name}`)
  attachSource(topo.id, metricsId, 'metrics')
  const parsed = await svc.getParsed(topo.id)
  const aEntityId = parsed?.graph.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.1')?.id ?? ''
  const bEntityId = parsed?.graph.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.2')?.id ?? ''
  await svc.updateMapping(topo.id, { nodes: { [aEntityId]: { hostId: '9' } }, links: {} })
  return { topoId: topo.id, metricsId, aEntityId, bEntityId }
}

/** Drop node A from the overlay so its mapping row orphans. B survives. */
async function dropNodeA(topoId: string, name: string): Promise<void> {
  await svc.writeProjectOverlay(topoId, {
    version: '1',
    name,
    nodes: [{ id: 'b', label: 'B', shape: 'rect', identity: { mgmtIp: '10.0.0.2' } }],
    links: [],
  } as NetworkGraph)
}

describe('orphan reassignment / discard', () => {
  test('reassign moves the row to the target and it projects onto that element', async () => {
    const { topoId, aEntityId, bEntityId } = await orphanFixture('orphan-reassign')
    await dropNodeA(topoId, 'orphan-reassign')

    const orphans = await svc.mappingOrphans(topoId)
    expect(orphans).toHaveLength(1)
    expect(orphans[0]?.entityId).toBe(aEntityId)

    const result = await svc.reassignOrphan(topoId, aEntityId, bEntityId)
    expect(result.ok).toBe(true)

    // No more orphans, and B now carries the reassigned host binding.
    expect(await svc.mappingOrphans(topoId)).toHaveLength(0)
    const m = (await svc.getParsed(topoId))?.mapping
    expect(m?.nodes?.[bEntityId]?.hostId).toBe('9')
  })

  test('reassign refuses a target absent from the current graph', async () => {
    const { topoId, aEntityId } = await orphanFixture('orphan-reassign-bad')
    await dropNodeA(topoId, 'orphan-reassign-bad')

    const result = await svc.reassignOrphan(topoId, aEntityId, 'NO-SUCH-ENTITY-000000000000')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('target entity not in current graph')
    // The orphan is untouched.
    expect(await svc.mappingOrphans(topoId)).toHaveLength(1)
  })

  test('discard removes the orphan row', async () => {
    const { topoId, aEntityId } = await orphanFixture('orphan-discard')
    await dropNodeA(topoId, 'orphan-discard')
    expect(await svc.mappingOrphans(topoId)).toHaveLength(1)

    const removed = svc.discardOrphan(topoId, aEntityId)
    expect(removed).toBe(true)
    expect(await svc.mappingOrphans(topoId)).toHaveLength(0)

    const rows = getDatabase()
      .query('SELECT COUNT(*) AS n FROM metrics_mapping WHERE topology_id = ?')
      .get(topoId) as { n: number }
    expect(rows.n).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Registry reset
// ---------------------------------------------------------------------------

describe('registry reset', () => {
  test('reset clears the registry + mapping, and the next resolve re-mints', async () => {
    const topo = await svc.create({ name: 'reset' })
    const graph: NetworkGraph = {
      version: '1',
      name: 'reset',
      nodes: [{ id: 'a', label: 'A', shape: 'rect', identity: { mgmtIp: '10.5.0.1' } }],
      links: [],
    } as NetworkGraph
    await svc.writeProjectOverlay(topo.id, graph)
    attachSource(topo.id, insertDataSource('zabbix', 'zbx_reset'), 'metrics')
    const before = await svc.getParsed(topo.id)
    const oldId = before?.graph.nodes[0]?.id ?? ''
    await svc.updateMapping(topo.id, { nodes: { [oldId]: { hostId: '3' } }, links: {} })

    const db = getDatabase()
    const entityCount = (): number =>
      (
        db
          .query('SELECT COUNT(*) AS n FROM entity_registry WHERE topology_id = ?')
          .get(topo.id) as {
          n: number
        }
      ).n
    const mappingCount = (): number =>
      (
        db
          .query('SELECT COUNT(*) AS n FROM metrics_mapping WHERE topology_id = ?')
          .get(topo.id) as {
          n: number
        }
      ).n
    expect(entityCount()).toBeGreaterThan(0)
    expect(mappingCount()).toBe(1)

    svc.resetRegistry(topo.id)
    expect(entityCount()).toBe(0)
    expect(mappingCount()).toBe(0)
    // Identity keys + retire counters cascade away with the registry rows.
    const keyCount = (
      db
        .query('SELECT COUNT(*) AS n FROM entity_identity_key WHERE topology_id = ?')
        .get(topo.id) as {
        n: number
      }
    ).n
    expect(keyCount).toBe(0)

    // Re-ingesting the same content (what a Sync / Rebuild does after reset)
    // re-mints a FRESH entity for the same node — a new stable id, since the old
    // registry was wiped. This is the "complete re-initialization" contract.
    await svc.writeProjectOverlay(topo.id, graph)
    expect(entityCount()).toBeGreaterThan(0)
    const after = await svc.getParsed(topo.id)
    const newId = after?.graph.nodes[0]?.id ?? ''
    expect(newId).toBeTruthy()
    expect(newId).not.toBe(oldId)
  })
})
