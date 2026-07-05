// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tests for the entity registry (adopt-or-mint + stampEntityIds).
 *
 * Run with: cd apps/server/api && bun test test/db/entity-registry.test.ts
 */

import type { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { getDatabase, timestamp } from '../../src/db/index.ts'
import { adoptOrMintForGraph, stampEntityIds } from '../../src/services/entity-registry.ts'
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

function registryCount(
  db: Database,
  topologyId: string,
): { nodes: number; ports: number; links: number } {
  const countOf = (kind: string) =>
    (
      db
        .query<{ n: number }, [string, string]>(
          'SELECT COUNT(*) AS n FROM entity_registry WHERE topology_id = ? AND kind = ?',
        )
        .get(topologyId, kind) ?? { n: 0 }
    ).n
  return { nodes: countOf('node'), ports: countOf('port'), links: countOf('link') }
}

function entityIdOf(db: Database, topologyId: string, kind: string): string | undefined {
  return (
    db
      .query<{ id: string }, [string, string]>(
        'SELECT id FROM entity_registry WHERE topology_id = ? AND kind = ? LIMIT 1',
      )
      .get(topologyId, kind) ?? undefined
  )?.id
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GRAPH_SIMPLE: NetworkGraph = {
  name: 'simple',
  nodes: [
    {
      id: 'sw-1',
      label: 'sw-1',
      identity: { chassisId: 'aa:bb:cc:dd:ee:01', mgmtIp: '10.0.0.1' },
      ports: [
        {
          id: 'p1',
          label: 'Gi0/1',
          connectors: [],
          identity: { ifName: 'GigabitEthernet0/1', ifIndex: 1 },
        },
        {
          id: 'p2',
          label: 'Gi0/2',
          connectors: [],
          identity: { ifName: 'GigabitEthernet0/2', ifIndex: 2 },
        },
      ],
    },
    {
      id: 'sw-2',
      label: 'sw-2',
      identity: { chassisId: 'aa:bb:cc:dd:ee:02', mgmtIp: '10.0.0.2' },
      ports: [
        {
          id: 'p1',
          label: 'Gi0/1',
          connectors: [],
          identity: { ifName: 'GigabitEthernet0/1' },
        },
      ],
    },
  ],
  links: [
    {
      from: { node: 'sw-1', port: 'p1' },
      to: { node: 'sw-2', port: 'p1' },
    },
  ],
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('entity registry', () => {
  let teardown: () => void
  let db: Database

  beforeAll(() => {
    const tmp = setupTempDb()
    teardown = tmp.teardown
    db = getDatabase()
  })

  afterAll(() => teardown())

  describe('adopt (same graph twice)', () => {
    test('second ingest reuses entity ids', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)
      const after1 = registryCount(db, topologyId)
      const nodeId1 = entityIdOf(db, topologyId, 'node')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)
      const after2 = registryCount(db, topologyId)
      const nodeId2 = entityIdOf(db, topologyId, 'node')

      // Row counts must not grow on re-ingest
      expect(after2.nodes).toBe(after1.nodes)
      expect(after2.ports).toBe(after1.ports)
      expect(after2.links).toBe(after1.links)
      // Entity id must be stable
      expect(nodeId2).toBe(nodeId1)
    })
  })

  describe('cross-source adopt', () => {
    test('two sources with shared chassisId → same entity', () => {
      const topologyId = makeTopology(db)
      const src1 = insertDataSource('netbox')
      const src2 = insertDataSource('zabbix')
      attachSource(topologyId, src1, 'topology')
      attachSource(topologyId, src2, 'topology')

      const g1: NetworkGraph = {
        name: 'g1',
        nodes: [
          {
            id: 'n1',
            label: 'r1',
            identity: { chassisId: 'cc:dd:ee:ff:00:01', mgmtIp: '192.168.1.1' },
            ports: [],
          },
        ],
        links: [],
      }
      const g2: NetworkGraph = {
        name: 'g2',
        // Same chassisId, different sourceId/local-id — should adopt the same entity
        nodes: [
          { id: 'router-1', label: 'r1', identity: { chassisId: 'cc:dd:ee:ff:00:01' }, ports: [] },
        ],
        links: [],
      }

      adoptOrMintForGraph(topologyId, src1, g1, db)
      const id1 = entityIdOf(db, topologyId, 'node')
      adoptOrMintForGraph(topologyId, src2, g2, db)
      const id2 = entityIdOf(db, topologyId, 'node')

      // Should resolve to the same entity (not a second row)
      const counts = registryCount(db, topologyId)
      expect(counts.nodes).toBe(1)
      expect(id2).toBe(id1)
    })
  })

  describe('evidence accretion', () => {
    test('new keys accumulate on same entity', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('snmp')
      attachSource(topologyId, src, 'topology')

      const g1: NetworkGraph = {
        name: 'g1',
        nodes: [{ id: 'n1', label: 'n1', identity: { chassisId: 'ab:cd:ef:01:02:03' }, ports: [] }],
        links: [],
      }
      adoptOrMintForGraph(topologyId, src, g1, db)
      const id1 = entityIdOf(db, topologyId, 'node')

      // Second scan adds sysName (new key)
      const g2: NetworkGraph = {
        name: 'g2',
        nodes: [
          {
            id: 'n1',
            label: 'n1',
            identity: { chassisId: 'ab:cd:ef:01:02:03', sysName: 'core-sw-1' },
            ports: [],
          },
        ],
        links: [],
      }
      adoptOrMintForGraph(topologyId, src, g2, db)
      const id2 = entityIdOf(db, topologyId, 'node')

      // Still the same entity
      expect(id2).toBe(id1)

      // sysName key now registered
      const keyCount = (
        db
          .query<{ n: number }, string[]>(
            'SELECT COUNT(*) AS n FROM entity_identity_key WHERE entity_id = ? AND key = ?',
          )
          .get(id1 ?? '', 'sysName') ?? { n: 0 }
      ).n
      expect(keyCount).toBe(1)
    })
  })

  describe('merge', () => {
    test('two entities that acquire a shared key merge into one', () => {
      const topologyId = makeTopology(db)
      const src1 = insertDataSource('lldp')
      const src2 = insertDataSource('netbox')
      attachSource(topologyId, src1, 'topology')
      attachSource(topologyId, src2, 'topology')

      // Mint via sysName only
      adoptOrMintForGraph(
        topologyId,
        src1,
        {
          name: 'g1',
          nodes: [{ id: 'a', label: 'a', identity: { sysName: 'spine-1' }, ports: [] }],
          links: [],
        },
        db,
      )

      // Mint via chassisId only
      adoptOrMintForGraph(
        topologyId,
        src2,
        {
          name: 'g2',
          nodes: [{ id: 'b', label: 'b', identity: { chassisId: 'ff:ee:dd:cc:bb:aa' }, ports: [] }],
          links: [],
        },
        db,
      )

      // Two entities exist
      const before = registryCount(db, topologyId)
      expect(before.nodes).toBe(2)

      // Now ingest with BOTH keys → merge
      adoptOrMintForGraph(
        topologyId,
        src1,
        {
          name: 'g3',
          nodes: [
            {
              id: 'c',
              label: 'c',
              identity: { sysName: 'spine-1', chassisId: 'ff:ee:dd:cc:bb:aa' },
              ports: [],
            },
          ],
          links: [],
        },
        db,
      )

      // Should have collapsed to 1 entity (+ 1 alias)
      const after = registryCount(db, topologyId)
      expect(after.nodes).toBe(2) // registry row count doesn't change (alias still points to retired id)
      const aliasCount = (
        db
          .query<{ n: number }, string>(
            'SELECT COUNT(*) AS n FROM entity_alias WHERE new_id IN (SELECT id FROM entity_registry WHERE topology_id = ?)',
          )
          .get(topologyId) ?? { n: 0 }
      ).n
      expect(aliasCount).toBe(1)
    })
  })

  describe('port parent scoping', () => {
    test('ports with same ifName on different nodes get different entities', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('snmp')
      attachSource(topologyId, src, 'topology')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)

      const portRows = db
        .query<{ id: string; parent_id: string }, string>(
          'SELECT id, parent_id FROM entity_registry WHERE topology_id = ? AND kind = ?',
        )
        .all(topologyId, 'port')

      // sw-1 has 2 ports (p1, p2), sw-2 has 1 port → 3 port entities
      expect(portRows.length).toBe(3)
      // All port entities should have a non-null parent_id
      for (const row of portRows) {
        expect(row.parent_id).toBeTruthy()
      }
    })
  })

  describe('link entity', () => {
    test('link entity is created keyed by sorted endpoint port ids', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('lldp')
      attachSource(topologyId, src, 'topology')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)

      const counts = registryCount(db, topologyId)
      expect(counts.links).toBe(1)
    })

    test('link entity is stable across re-ingests (same port pair)', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('lldp')
      attachSource(topologyId, src, 'topology')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)
      const linkId1 = entityIdOf(db, topologyId, 'link')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)
      const linkId2 = entityIdOf(db, topologyId, 'link')

      expect(linkId2).toBe(linkId1)
    })
  })

  describe('stampEntityIds', () => {
    test('adds entityId to nodes with known identity', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)

      const stamped = stampEntityIds(topologyId, GRAPH_SIMPLE, db)

      // Nodes with network identity should have entityId
      for (const node of stamped.nodes) {
        if (node.identity?.chassisId ?? node.identity?.mgmtIp) {
          expect(node.entityId).toBeTruthy()
        }
      }
    })

    test('adds entityId to ports and links', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      adoptOrMintForGraph(topologyId, src, GRAPH_SIMPLE, db)

      const stamped = stampEntityIds(topologyId, GRAPH_SIMPLE, db)

      const sw1 = stamped.nodes.find((n) => n.id === 'sw-1')
      expect(sw1?.entityId).toBeTruthy()
      // Ports with ifName should have entityId
      const p1 = sw1?.ports?.find((p) => p.id === 'p1')
      expect(p1?.entityId).toBeTruthy()

      // Links with resolved endpoints should have entityId
      const link = stamped.links[0]
      expect(link?.entityId).toBeTruthy()
    })

    test('nodes without network identity get no entityId (manual fallback requires source)', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      const graphWithManual: NetworkGraph = {
        name: 'manual',
        nodes: [{ id: 'n1', label: 'unnamed', ports: [] }], // no identity
        links: [],
      }

      // stampEntityIds should NOT find an entity (manual key is source-scoped, stripped by stamp)
      const stamped = stampEntityIds(topologyId, graphWithManual, db)
      expect(stamped.nodes[0]?.entityId).toBeUndefined()
    })
  })
})
