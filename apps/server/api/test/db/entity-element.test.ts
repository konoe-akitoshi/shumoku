// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tests for entity_element persistence (migration 030) and the
 * registry-driven fold input that readObservedSnapshots produces.
 *
 * Run with: cd apps/server/api && bun test test/db/entity-element.test.ts
 */

import type { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { getDatabase, timestamp } from '../../src/db/index.ts'
import { ingestGraph } from '../../src/services/contribution-store.ts'
import { adoptOrMintForGraph } from '../../src/services/entity-registry.ts'
import { attachSource, insertDataSource, setupTempDb } from './helper.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTopology(db: Database): string {
  const id = `topo-${Math.random().toString(36).slice(2)}`
  const now = timestamp()
  db.query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    id,
    id,
    now,
    now,
  )
  return id
}

function ingestAndRegister(
  db: Database,
  topologyId: string,
  sourceId: string,
  graph: NetworkGraph,
): void {
  const attach = db
    .query<{ id: string }, [string, string]>(
      `SELECT id FROM topology_data_sources
       WHERE topology_id = ? AND data_source_id = ? AND purpose = 'topology'`,
    )
    .get(topologyId, sourceId)
  ingestGraph(topologyId, sourceId, graph, { attachmentId: attach?.id ?? null }, db)
  adoptOrMintForGraph(topologyId, sourceId, db)
}

function getEntityElements(
  db: Database,
  topologyId: string,
  sourceId: string,
): { kind: string; local_id: string; entity_id: string }[] {
  return db
    .query<{ kind: string; local_id: string; entity_id: string }, [string, string]>(
      'SELECT kind, local_id, entity_id FROM entity_element WHERE topology_id = ? AND source_id = ? ORDER BY kind, local_id',
    )
    .all(topologyId, sourceId)
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let db: Database
let teardown: () => void

beforeAll(() => {
  const temp = setupTempDb()
  teardown = temp.teardown
  db = getDatabase()
})

afterAll(() => {
  teardown()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('entity_element persistence', () => {
  test('adoptOrMintForGraph writes node rows to entity_element', () => {
    const topologyId = makeTopology(db)
    const dsId = insertDataSource('test')
    attachSource(topologyId, dsId, 'topology')

    const graph: NetworkGraph = {
      version: '1',
      nodes: [
        { id: 'n1', label: 'Router A', identity: { mgmtIp: '10.0.0.1' } },
        { id: 'n2', label: 'Router B', identity: { mgmtIp: '10.0.0.2' } },
      ],
      links: [],
    }
    ingestAndRegister(db, topologyId, dsId, graph)

    const rows = getEntityElements(db, topologyId, dsId)
    // Should have one 'node' row per node
    const nodeRows = rows.filter((r) => r.kind === 'node')
    expect(nodeRows).toHaveLength(2)
    // local_ids should match the node ids
    const localIds = nodeRows.map((r) => r.local_id).sort()
    expect(localIds).toEqual(['n1', 'n2'])
    // all entity_ids should be non-empty ULIDs
    for (const row of nodeRows) {
      expect(row.entity_id.length).toBeGreaterThan(0)
    }
  })

  test('adoptOrMintForGraph writes port rows to entity_element', () => {
    const topologyId = makeTopology(db)
    const dsId = insertDataSource('test-ports')
    attachSource(topologyId, dsId, 'topology')

    const graph: NetworkGraph = {
      version: '1',
      nodes: [
        {
          id: 'n1',
          label: 'Router',
          identity: { mgmtIp: '10.1.0.1' },
          ports: [
            { id: 'p0', label: 'Gi0/0', connectors: [], identity: { ifName: 'Gi0/0' } },
            { id: 'p1', label: 'Gi0/1', connectors: [], identity: { ifName: 'Gi0/1' } },
          ],
        },
      ],
      links: [],
    }
    ingestAndRegister(db, topologyId, dsId, graph)

    const rows = getEntityElements(db, topologyId, dsId)
    const portRows = rows.filter((r) => r.kind === 'port')
    // composite keys are `${nodeLocalId}:${portLocalId}`
    const portKeys = portRows.map((r) => r.local_id).sort()
    expect(portKeys).toEqual(['n1:p0', 'n1:p1'])
  })

  test('re-ingest replaces entity_element rows (no accumulation)', () => {
    const topologyId = makeTopology(db)
    const dsId = insertDataSource('test-replace')
    attachSource(topologyId, dsId, 'topology')

    const graph1: NetworkGraph = {
      version: '1',
      nodes: [
        { id: 'n1', label: 'A', identity: { mgmtIp: '10.2.0.1' } },
        { id: 'n2', label: 'B', identity: { mgmtIp: '10.2.0.2' } },
      ],
      links: [],
    }
    ingestAndRegister(db, topologyId, dsId, graph1)
    expect(getEntityElements(db, topologyId, dsId).filter((r) => r.kind === 'node')).toHaveLength(2)

    // Second ingest: only one node this time
    const graph2: NetworkGraph = {
      version: '1',
      nodes: [{ id: 'n1', label: 'A', identity: { mgmtIp: '10.2.0.1' } }],
      links: [],
    }
    ingestAndRegister(db, topologyId, dsId, graph2)

    // Must replace, not accumulate — only 1 row now
    const nodeRows = getEntityElements(db, topologyId, dsId).filter((r) => r.kind === 'node')
    expect(nodeRows).toHaveLength(1)
    expect(nodeRows[0]?.local_id).toBe('n1')
  })

  test('two distinct sources get separate entity_element rows', () => {
    const topologyId = makeTopology(db)
    const ds1 = insertDataSource('src-a')
    const ds2 = insertDataSource('src-b')
    attachSource(topologyId, ds1, 'topology')
    attachSource(topologyId, ds2, 'topology')

    const graphA: NetworkGraph = {
      version: '1',
      nodes: [{ id: 'na', label: 'NodeA', identity: { mgmtIp: '10.3.0.1' } }],
      links: [],
    }
    const graphB: NetworkGraph = {
      version: '1',
      nodes: [{ id: 'nb', label: 'NodeB', identity: { mgmtIp: '10.3.0.2' } }],
      links: [],
    }
    ingestAndRegister(db, topologyId, ds1, graphA)
    ingestAndRegister(db, topologyId, ds2, graphB)

    const rowsA = getEntityElements(db, topologyId, ds1).filter((r) => r.kind === 'node')
    const rowsB = getEntityElements(db, topologyId, ds2).filter((r) => r.kind === 'node')
    expect(rowsA).toHaveLength(1)
    expect(rowsB).toHaveLength(1)
    expect(rowsA[0]?.local_id).toBe('na')
    expect(rowsB[0]?.local_id).toBe('nb')
  })

  test('entity ids are stable across re-ingest (same entity adopted)', () => {
    const topologyId = makeTopology(db)
    const dsId = insertDataSource('test-stable')
    attachSource(topologyId, dsId, 'topology')

    const graph: NetworkGraph = {
      version: '1',
      nodes: [{ id: 'n1', label: 'Stable', identity: { mgmtIp: '10.4.0.1' } }],
      links: [],
    }
    ingestAndRegister(db, topologyId, dsId, graph)
    const first = getEntityElements(db, topologyId, dsId).find(
      (r) => r.kind === 'node' && r.local_id === 'n1',
    )?.entity_id

    // Re-ingest same node — must get the same entity id (adopt, not mint again)
    ingestAndRegister(db, topologyId, dsId, graph)
    const second = getEntityElements(db, topologyId, dsId).find(
      (r) => r.kind === 'node' && r.local_id === 'n1',
    )?.entity_id

    expect(first).toBeDefined()
    expect(first).toBe(second)
  })
})
