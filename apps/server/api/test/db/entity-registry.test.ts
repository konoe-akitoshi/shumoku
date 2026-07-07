// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tests for the entity registry (adopt-or-mint + stampEntityIds).
 *
 * Run with: cd apps/server/api && bun test test/db/entity-registry.test.ts
 */

import type { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { getDatabase, timestamp } from '../../src/db/index.ts'
import { ingestGraph } from '../../src/services/contribution-store.ts'
import {
  adoptOrMintForGraph,
  generateUlid,
  stampEntityIds,
} from '../../src/services/entity-registry.ts'
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

/**
 * Mirror the production order: ingest into the contribution store first, then
 * register.  adoptOrMintForGraph reads the post-ingest rows back itself — the
 * raw graph is never handed to the registry (link-endpoint ports only exist
 * after ingest synthesizes them).
 */
function ingestAndRegister(
  db: Database,
  topologyId: string,
  sourceId: string,
  graph: NetworkGraph,
): void {
  // Own the contribution via the attach row, like materializeContribution does —
  // a NULL attachment_id means "intrinsic" and is unique per topology.
  const attach = db
    .query<{ id: string }, [string, string]>(
      `SELECT id FROM topology_data_sources
       WHERE topology_id = ? AND data_source_id = ? AND purpose = 'topology'`,
    )
    .get(topologyId, sourceId)
  ingestGraph(topologyId, sourceId, graph, { attachmentId: attach?.id ?? null }, db)
  adoptOrMintForGraph(topologyId, sourceId, db)
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

function entityIdsOf(db: Database, topologyId: string, kind: string): string[] {
  return db
    .query<{ id: string }, [string, string]>(
      'SELECT id FROM entity_registry WHERE topology_id = ? AND kind = ? ORDER BY id',
    )
    .all(topologyId, kind)
    .map((r) => r.id)
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

// NetBox-shaped: nodes enumerate NO ports[] — ports exist only as link-endpoint
// strings, exactly what the NetBox plugin emits. ingestGraph synthesizes stub
// port elements (with identity.ifName, Phase 0) for these; the registry must
// register from that post-ingest state, not from this raw graph.
const GRAPH_NETBOX_SHAPE: NetworkGraph = {
  name: 'netbox-shape',
  nodes: [
    { id: 'rtr-1', label: 'rtr-1', identity: { mgmtIp: '10.9.0.1' } },
    { id: 'sw-9', label: 'sw-9', identity: { mgmtIp: '10.9.0.2' } },
  ],
  links: [
    {
      from: { node: 'rtr-1', port: 'ge-0/0/0' },
      to: { node: 'sw-9', port: 'GigabitEthernet1/0/1' },
    },
    {
      from: { node: 'rtr-1', port: 'ge-0/0/1' },
      to: { node: 'sw-9', port: 'GigabitEthernet1/0/2' },
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

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)
      const after1 = registryCount(db, topologyId)
      const nodeId1 = entityIdOf(db, topologyId, 'node')

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)
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

      ingestAndRegister(db, topologyId, src1, g1)
      const id1 = entityIdOf(db, topologyId, 'node')
      ingestAndRegister(db, topologyId, src2, g2)
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
      ingestAndRegister(db, topologyId, src, g1)
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
      ingestAndRegister(db, topologyId, src, g2)
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
    test('staged lookup adopts the strong-key entity; sysName-only entity stays separate', () => {
      const topologyId = makeTopology(db)
      const src1 = insertDataSource('lldp')
      const src2 = insertDataSource('netbox')
      attachSource(topologyId, src1, 'topology')
      attachSource(topologyId, src2, 'topology')

      // Mint via sysName only (MUTABLE class)
      ingestAndRegister(db, topologyId, src1, {
        name: 'g1',
        nodes: [{ id: 'a', label: 'a', identity: { sysName: 'spine-1' }, ports: [] }],
        links: [],
      })

      // Mint via chassisId only (STRONG class)
      ingestAndRegister(db, topologyId, src2, {
        name: 'g2',
        nodes: [{ id: 'b', label: 'b', identity: { chassisId: 'ff:ee:dd:cc:bb:aa' }, ports: [] }],
        links: [],
      })

      // Two entities exist
      const before = registryCount(db, topologyId)
      expect(before.nodes).toBe(2)

      // Ingest with BOTH keys: staged lookup finds entity B via STRONG class (chassisId),
      // returns it as the sole candidate — no cross-class merge with sysName-only entity A.
      ingestAndRegister(db, topologyId, src1, {
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
      })

      // Entity B adopted; entity A stays separate. No alias created.
      const after = registryCount(db, topologyId)
      expect(after.nodes).toBe(2)
      const aliasCount = (
        db
          .query<{ n: number }, string>(
            'SELECT COUNT(*) AS n FROM entity_alias WHERE new_id IN (SELECT id FROM entity_registry WHERE topology_id = ?)',
          )
          .get(topologyId) ?? { n: 0 }
      ).n
      expect(aliasCount).toBe(0)
    })
  })

  describe('port parent scoping', () => {
    test('ports with same ifName on different nodes get different entities', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('snmp')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)

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

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)

      const counts = registryCount(db, topologyId)
      expect(counts.links).toBe(1)
    })

    test('link entity is stable across re-ingests (same port pair)', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('lldp')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)
      const linkId1 = entityIdOf(db, topologyId, 'link')

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)
      const linkId2 = entityIdOf(db, topologyId, 'link')

      expect(linkId2).toBe(linkId1)
    })
  })

  describe('NetBox-shaped ingest (no ports[] arrays)', () => {
    test('link-endpoint ports yield port entities and link entities', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, GRAPH_NETBOX_SHAPE)

      const counts = registryCount(db, topologyId)
      expect(counts.nodes).toBe(2)
      // Every port referenced by a link endpoint (synthesized at ingest) gets an entity
      expect(counts.ports).toBe(4)
      expect(counts.links).toBe(2)
    })

    test('port and link entity ids are stable across re-ingest', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, GRAPH_NETBOX_SHAPE)
      const ports1 = entityIdsOf(db, topologyId, 'port')
      const links1 = entityIdsOf(db, topologyId, 'link')

      // Blank + rebuild: ingest fully replaces the contribution rows, then registers again
      ingestAndRegister(db, topologyId, src, GRAPH_NETBOX_SHAPE)
      const ports2 = entityIdsOf(db, topologyId, 'port')
      const links2 = entityIdsOf(db, topologyId, 'link')

      expect(ports2).toEqual(ports1)
      expect(links2).toEqual(links1)
    })

    test('stampEntityIds stamps ports and links on the resolved shape', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, GRAPH_NETBOX_SHAPE)

      // The RESOLVED graph (unlike the raw NetBox graph) carries materialized
      // ports[] with identity.ifName — stamping must find the ingest-minted entities.
      const resolvedShape: NetworkGraph = {
        name: 'resolved',
        nodes: [
          {
            id: 'rtr-1',
            label: 'rtr-1',
            identity: { mgmtIp: '10.9.0.1' },
            ports: [
              { id: 'ge-0/0/0', connectors: [], identity: { ifName: 'ge-0/0/0' } },
              { id: 'ge-0/0/1', connectors: [], identity: { ifName: 'ge-0/0/1' } },
            ],
          },
          {
            id: 'sw-9',
            label: 'sw-9',
            identity: { mgmtIp: '10.9.0.2' },
            ports: [
              {
                id: 'GigabitEthernet1/0/1',
                connectors: [],
                identity: { ifName: 'GigabitEthernet1/0/1' },
              },
              {
                id: 'GigabitEthernet1/0/2',
                connectors: [],
                identity: { ifName: 'GigabitEthernet1/0/2' },
              },
            ],
          },
        ],
        links: GRAPH_NETBOX_SHAPE.links,
      }

      const stamped = stampEntityIds(topologyId, resolvedShape, db)

      for (const node of stamped.nodes) {
        expect(node.entityId).toBeTruthy()
        expect(node.ports?.length).toBeGreaterThan(0)
        for (const port of node.ports ?? []) {
          expect(port.entityId).toBeTruthy()
        }
      }
      expect(stamped.links.length).toBe(2)
      for (const link of stamped.links) {
        expect(link.entityId).toBeTruthy()
      }
    })
  })

  describe('stampEntityIds', () => {
    test('adds entityId to nodes with known identity', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('netbox')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)

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

      ingestAndRegister(db, topologyId, src, GRAPH_SIMPLE)

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

  // -------------------------------------------------------------------------
  // @570: IP reuse - mutual-consistency rule
  // -------------------------------------------------------------------------

  describe('IP reuse (mutual-consistency rule)', () => {
    test('observation with conflicting sysName mints new entity even if IP matches', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('snmp-ipreuse')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, {
        name: 'g1',
        nodes: [
          { id: 'a', label: 'a', identity: { sysName: 'router-X', mgmtIp: '10.1.1.1' }, ports: [] },
        ],
        links: [],
      })
      expect(registryCount(db, topologyId).nodes).toBe(1)

      // conflicting sysName => MUTABLE mutual-consistency rejects candidate => MINT new
      ingestAndRegister(db, topologyId, src, {
        name: 'g2',
        nodes: [
          { id: 'b', label: 'b', identity: { sysName: 'router-Y', mgmtIp: '10.1.1.1' }, ports: [] },
        ],
        links: [],
      })

      expect(registryCount(db, topologyId).nodes).toBe(2)
      const aliases = (
        db
          .query<{ n: number }, string>(
            'SELECT COUNT(*) AS n FROM entity_alias WHERE new_id IN (SELECT id FROM entity_registry WHERE topology_id = ?)',
          )
          .get(topologyId) ?? { n: 0 }
      ).n
      expect(aliases).toBe(0)

      // Magnet kill: the minted entity claims mgmtIp=10.1.1.1 from this source;
      // the old (dead) entity must no longer hold it — otherwise a later
      // mgmtIp-only observation would still adopt the wrong device.
      const ipOwners = db
        .query<{ entity_id: string; value: string }, [string, string]>(
          `SELECT eik.entity_id, eik.value FROM entity_identity_key eik
           JOIN entity_registry er ON er.id = eik.entity_id
           WHERE er.topology_id = ? AND eik.key = 'mgmtIp' AND eik.value = ?`,
        )
        .all(topologyId, '10.1.1.1')
      expect(ipOwners.length).toBe(1)
      const newEntityId = db
        .query<{ entity_id: string }, [string, string]>(
          `SELECT eik.entity_id FROM entity_identity_key eik
           JOIN entity_registry er ON er.id = eik.entity_id
           WHERE er.topology_id = ? AND eik.key = 'sysName' AND eik.value = ?`,
        )
        .get(topologyId, 'router-y')?.entity_id
      expect(ipOwners[0]?.entity_id).toBe(newEntityId ?? '')
    })
  })

  // -------------------------------------------------------------------------
  // @570: IP swap - adopt B (sysName match), replace stale IP, no merge
  // -------------------------------------------------------------------------

  describe('IP swap', () => {
    test('entity B adopted; stale IP replaced; entity A rejected by sysName conflict; no alias', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('snmp-ipswap')
      attachSource(topologyId, src, 'topology')

      // Entity A (dead): sysName=dead-device, mgmtIp=10.2.2.1
      ingestAndRegister(db, topologyId, src, {
        name: 'g-A',
        nodes: [
          {
            id: 'a',
            label: 'a',
            identity: { sysName: 'dead-device', mgmtIp: '10.2.2.1' },
            ports: [],
          },
        ],
        links: [],
      })
      // Entity B (live): sysName=live-device, mgmtIp=10.2.2.2
      ingestAndRegister(db, topologyId, src, {
        name: 'g-B',
        nodes: [
          {
            id: 'b',
            label: 'b',
            identity: { sysName: 'live-device', mgmtIp: '10.2.2.2' },
            ports: [],
          },
        ],
        links: [],
      })
      expect(registryCount(db, topologyId).nodes).toBe(2)

      const entityBId = db
        .query<{ id: string }, [string, string]>(
          'SELECT er.id FROM entity_registry er JOIN entity_identity_key eik ON eik.entity_id = er.id WHERE er.topology_id = ? AND eik.key = "sysName" AND eik.value = ?',
        )
        .get(topologyId, 'live-device')?.id
      expect(entityBId).toBeTruthy()

      // Observation: sysName=live-device (matches B), mgmtIp=10.2.2.1 (was A's stale IP).
      // A is vetoed by mutual-consistency (sysName=dead-device conflicts); B is the sole
      // candidate → clean single-candidate adoption, no warn emitted.
      ingestAndRegister(db, topologyId, src, {
        name: 'g-obs',
        nodes: [
          {
            id: 'c',
            label: 'c',
            identity: { sysName: 'live-device', mgmtIp: '10.2.2.1' },
            ports: [],
          },
        ],
        links: [],
      })

      // Still 2 entities (no mint, no merge)
      expect(registryCount(db, topologyId).nodes).toBe(2)

      // No alias (no merge)
      const aliases = (
        db
          .query<{ n: number }, string>(
            'SELECT COUNT(*) AS n FROM entity_alias WHERE new_id IN (SELECT id FROM entity_registry WHERE topology_id = ?)',
          )
          .get(topologyId) ?? { n: 0 }
      ).n
      expect(aliases).toBe(0)

      // B's mgmtIp replaced to 10.2.2.1 from this source (singleton replacement)
      const bMgmtIp = db
        .query<{ value: string }, [string, string]>(
          'SELECT value FROM entity_identity_key WHERE entity_id = ? AND key = "mgmtIp" AND source_id = ?',
        )
        .get(entityBId ?? '', src)?.value
      expect(bMgmtIp).toBe('10.2.2.1')

      // Magnet kill: dead entity A released mgmtIp=10.2.2.1 — B is now the only owner.
      const ipOwners = db
        .query<{ entity_id: string }, [string, string]>(
          `SELECT eik.entity_id FROM entity_identity_key eik
           JOIN entity_registry er ON er.id = eik.entity_id
           WHERE er.topology_id = ? AND eik.key = 'mgmtIp' AND eik.value = ?`,
        )
        .all(topologyId, '10.2.2.1')
      expect(ipOwners.length).toBe(1)
      expect(ipOwners[0]?.entity_id).toBe(entityBId ?? '')
    })
  })

  // -------------------------------------------------------------------------
  // @570: Strong veto - vendor key conflict prevents adoption
  // -------------------------------------------------------------------------

  describe('strong veto (vendor key conflict)', () => {
    test('candidate with different vendor:* key is vetoed even if mgmtIp matches', () => {
      const topologyId = makeTopology(db)
      const src1 = insertDataSource('netbox-veto')
      const src2 = insertDataSource('zabbix-veto')
      attachSource(topologyId, src1, 'topology')
      attachSource(topologyId, src2, 'topology')

      ingestAndRegister(db, topologyId, src1, {
        name: 'g1',
        nodes: [
          {
            id: 'n1',
            label: 'n1',
            identity: { vendorIds: { 'netbox-device-id': '42' }, mgmtIp: '10.3.3.1' },
            ports: [],
          },
        ],
        links: [],
      })
      expect(registryCount(db, topologyId).nodes).toBe(1)

      // Different netbox-device-id => STRONG veto => mint new entity
      ingestAndRegister(db, topologyId, src2, {
        name: 'g2',
        nodes: [
          {
            id: 'n2',
            label: 'n2',
            identity: { vendorIds: { 'netbox-device-id': '43' }, mgmtIp: '10.3.3.1' },
            ports: [],
          },
        ],
        links: [],
      })

      expect(registryCount(db, topologyId).nodes).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // @570: Legit merge - all candidates share strong key with observation
  // -------------------------------------------------------------------------

  describe('legit merge - all candidates share strong key', () => {
    test('entities sharing chassisId are adopted (single match) then merged (multi-match both sharing chassisId)', () => {
      const topologyId = makeTopology(db)
      const src1 = insertDataSource('lldp-merge')
      const src2 = insertDataSource('snmp-merge')
      attachSource(topologyId, src1, 'topology')
      attachSource(topologyId, src2, 'topology')

      // Entity A: chassisId=AA + sysName
      ingestAndRegister(db, topologyId, src1, {
        name: 'g1',
        nodes: [
          {
            id: 'a',
            label: 'a',
            identity: { chassisId: 'aa:aa:aa:aa:aa:aa', sysName: 'spine-merge' },
            ports: [],
          },
        ],
        links: [],
      })

      // Same chassisId => adopts entity A (single candidate, no merge)
      ingestAndRegister(db, topologyId, src2, {
        name: 'g2',
        nodes: [
          {
            id: 'b',
            label: 'b',
            identity: { chassisId: 'aa:aa:aa:aa:aa:aa', mgmtIp: '10.4.4.1' },
            ports: [],
          },
        ],
        links: [],
      })

      // 1 entity after strong-key adoption
      expect(registryCount(db, topologyId).nodes).toBe(1)
    })

    test('multi-candidate merge: each candidate shares a STRONG key with the observation', () => {
      const topologyId = makeTopology(db)
      const src1 = insertDataSource('lldp-mc')
      const src2 = insertDataSource('zabbix-mc')
      attachSource(topologyId, src1, 'topology')
      attachSource(topologyId, src2, 'topology')

      // Entity A: chassisId only (STRONG)
      ingestAndRegister(db, topologyId, src1, {
        name: 'gA',
        nodes: [{ id: 'a', label: 'a', identity: { chassisId: 'bb:bb:bb:bb:bb:01' }, ports: [] }],
        links: [],
      })
      // Entity B: vendor id only (STRONG, different namespace — no chassisId, so no adopt)
      ingestAndRegister(db, topologyId, src2, {
        name: 'gB',
        nodes: [
          { id: 'b', label: 'b', identity: { vendorIds: { 'zabbix-host-id': '77' } }, ports: [] },
        ],
        links: [],
      })
      const before = entityIdsOf(db, topologyId, 'node')
      expect(before.length).toBe(2)

      // Observation carries BOTH strong keys → both candidates found at STRONG
      // stage, each shares a STRONG key with the observation → legit auto-merge.
      ingestAndRegister(db, topologyId, src1, {
        name: 'gObs',
        nodes: [
          {
            id: 'c',
            label: 'c',
            identity: { chassisId: 'bb:bb:bb:bb:bb:01', vendorIds: { 'zabbix-host-id': '77' } },
            ports: [],
          },
        ],
        links: [],
      })

      const aliasRows = db
        .query<{ old_id: string; new_id: string }, string>(
          'SELECT old_id, new_id FROM entity_alias WHERE new_id IN (SELECT id FROM entity_registry WHERE topology_id = ?)',
        )
        .all(topologyId)
      expect(aliasRows.length).toBe(1)
      // The alias connects exactly the two pre-existing entities (direction = tie
      // on first_seen_at is broken by id, so assert the set, not the order).
      const pair = [aliasRows[0]?.old_id, aliasRows[0]?.new_id].sort()
      expect(pair).toEqual([...before].sort())

      // Re-ingesting either source's original view now resolves to the survivor.
      ingestAndRegister(db, topologyId, src2, {
        name: 'gB2',
        nodes: [
          { id: 'b', label: 'b', identity: { vendorIds: { 'zabbix-host-id': '77' } }, ports: [] },
        ],
        links: [],
      })
      const after = entityIdsOf(db, topologyId, 'node')
      expect(after.length).toBe(2) // absorbed row remains; no third entity minted
    })
  })

  // -------------------------------------------------------------------------
  // @570: Ambiguous weak multi-match - adopt best, no merge, warn
  // -------------------------------------------------------------------------

  describe('ambiguous weak multi-match', () => {
    test('adopts a single candidate, creates no alias, and warns', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('snmp-ambiguous')
      attachSource(topologyId, src, 'topology')

      // Entity A: mgmtIp only. Entity B: sysName only. Both MUTABLE-class.
      ingestAndRegister(db, topologyId, src, {
        name: 'gA',
        nodes: [{ id: 'a', label: 'a', identity: { mgmtIp: '10.5.5.1' }, ports: [] }],
        links: [],
      })
      ingestAndRegister(db, topologyId, src, {
        name: 'gB',
        nodes: [{ id: 'b', label: 'b', identity: { sysName: 'amb-dev' }, ports: [] }],
        links: [],
      })
      expect(registryCount(db, topologyId).nodes).toBe(2)

      // Observation matches A on mgmtIp and B on sysName — one MUTABLE key each,
      // no strong key, only 1 shared class per candidate → merge guard refuses.
      const warnSpy = spyOn(console, 'warn')
      try {
        ingestAndRegister(db, topologyId, src, {
          name: 'gObs',
          nodes: [
            {
              id: 'c',
              label: 'c',
              identity: { mgmtIp: '10.5.5.1', sysName: 'amb-dev' },
              ports: [],
            },
          ],
          links: [],
        })
        const ambiguousWarns = warnSpy.mock.calls.filter((call) =>
          String(call[0]).includes('[Registry] ambiguous match'),
        )
        expect(ambiguousWarns.length).toBe(1)
      } finally {
        warnSpy.mockRestore()
      }

      // No merge: still two registry rows, zero alias rows.
      expect(registryCount(db, topologyId).nodes).toBe(2)
      const aliases = (
        db
          .query<{ n: number }, string>(
            'SELECT COUNT(*) AS n FROM entity_alias WHERE new_id IN (SELECT id FROM entity_registry WHERE topology_id = ?)',
          )
          .get(topologyId) ?? { n: 0 }
      ).n
      expect(aliases).toBe(0)

      // Exactly ONE entity was adopted: it now owns both keys (singleton
      // replacement moved the other's key over); the loser holds no keys.
      // Tie on first_seen_at makes the winner direction-nondeterministic,
      // so assert the shape, not the specific id.
      const keyRows = db
        .query<{ entity_id: string; key: string }, string>(
          `SELECT eik.entity_id, eik.key FROM entity_identity_key eik
           JOIN entity_registry er ON er.id = eik.entity_id
           WHERE er.topology_id = ? AND eik.kind = 'node'`,
        )
        .all(topologyId)
      const byEntity = new Map<string, string[]>()
      for (const row of keyRows) {
        byEntity.set(row.entity_id, [...(byEntity.get(row.entity_id) ?? []), row.key])
      }
      expect(byEntity.size).toBe(1)
      const winnerKeys = [...byEntity.values()][0]?.sort()
      expect(winnerKeys).toEqual(['mgmtIp', 'sysName'])
    })
  })

  // -------------------------------------------------------------------------
  // @570: Per-source singleton-key replacement
  // -------------------------------------------------------------------------

  describe('per-source singleton-key replacement', () => {
    test('source A updates its own mgmtIp; source B row is unaffected', () => {
      const topologyId = makeTopology(db)
      const srcA = insertDataSource('src-a-singleton')
      const srcB = insertDataSource('src-b-singleton')
      attachSource(topologyId, srcA, 'topology')
      attachSource(topologyId, srcB, 'topology')

      // Both sources see same chassisId => same entity
      ingestAndRegister(db, topologyId, srcA, {
        name: 'ga',
        nodes: [
          {
            id: 'n',
            label: 'n',
            identity: { chassisId: 'ee:ee:ee:ee:ee:ee', mgmtIp: '10.6.6.1' },
            ports: [],
          },
        ],
        links: [],
      })
      ingestAndRegister(db, topologyId, srcB, {
        name: 'gb',
        nodes: [
          {
            id: 'n',
            label: 'n',
            identity: { chassisId: 'ee:ee:ee:ee:ee:ee', mgmtIp: '10.6.6.100' },
            ports: [],
          },
        ],
        links: [],
      })

      expect(registryCount(db, topologyId).nodes).toBe(1)
      const entityId = entityIdOf(db, topologyId, 'node')
      expect(entityId).toBeTruthy()

      const getIp = (eid: string, sid: string) =>
        db
          .query<{ value: string }, [string, string]>(
            'SELECT value FROM entity_identity_key WHERE entity_id = ? AND key = "mgmtIp" AND source_id = ?',
          )
          .get(eid, sid)?.value

      expect(getIp(entityId ?? '', srcA)).toBe('10.6.6.1')
      expect(getIp(entityId ?? '', srcB)).toBe('10.6.6.100')

      // Source A reports new IP
      ingestAndRegister(db, topologyId, srcA, {
        name: 'ga2',
        nodes: [
          {
            id: 'n',
            label: 'n',
            identity: { chassisId: 'ee:ee:ee:ee:ee:ee', mgmtIp: '10.6.6.99' },
            ports: [],
          },
        ],
        links: [],
      })

      // A updated, B unchanged
      expect(getIp(entityId ?? '', srcA)).toBe('10.6.6.99')
      expect(getIp(entityId ?? '', srcB)).toBe('10.6.6.100')
      expect(registryCount(db, topologyId).nodes).toBe(1)
    })

    test('two sources can assert the SAME value independently (per-source unique)', () => {
      const topologyId = makeTopology(db)
      const srcA = insertDataSource('src-a-dual')
      const srcB = insertDataSource('src-b-dual')
      attachSource(topologyId, srcA, 'topology')
      attachSource(topologyId, srcB, 'topology')

      const graph = (name: string): NetworkGraph => ({
        name,
        nodes: [
          {
            id: 'n',
            label: 'n',
            identity: { chassisId: 'dd:dd:dd:dd:dd:dd', mgmtIp: '10.7.7.1' },
            ports: [],
          },
        ],
        links: [],
      })
      ingestAndRegister(db, topologyId, srcA, graph('ga'))
      ingestAndRegister(db, topologyId, srcB, graph('gb'))

      expect(registryCount(db, topologyId).nodes).toBe(1)
      const entityId = entityIdOf(db, topologyId, 'node')

      // Migration 029 must have REBUILT the table: the original inline UNIQUE
      // (without source_id) is an undroppable autoindex, and would silently
      // swallow srcB's row here.
      const rows = db
        .query<{ source_id: string }, [string, string]>(
          'SELECT source_id FROM entity_identity_key WHERE entity_id = ? AND key = "mgmtIp" AND value = ? ORDER BY source_id',
        )
        .all(entityId ?? '', '10.7.7.1')
      expect(rows.map((r) => r.source_id).sort()).toEqual([srcA, srcB].sort())
    })

    test('legacy source_id="" row is replaced when a real source reports a new value', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('src-legacy')
      attachSource(topologyId, src, 'topology')

      ingestAndRegister(db, topologyId, src, {
        name: 'g1',
        nodes: [
          {
            id: 'n',
            label: 'n',
            identity: { chassisId: 'cc:cc:cc:cc:cc:cc', mgmtIp: '10.8.8.1' },
            ports: [],
          },
        ],
        links: [],
      })
      const entityId = entityIdOf(db, topologyId, 'node')

      // Simulate a pre-migration-029 row: unknown provenance.
      db.query(
        'UPDATE entity_identity_key SET source_id = ? WHERE entity_id = ? AND key = "mgmtIp"',
      ).run('', entityId ?? '')

      // Source reports a NEW IP → the legacy row must be replaced, not accreted.
      ingestAndRegister(db, topologyId, src, {
        name: 'g2',
        nodes: [
          {
            id: 'n',
            label: 'n',
            identity: { chassisId: 'cc:cc:cc:cc:cc:cc', mgmtIp: '10.8.8.2' },
            ports: [],
          },
        ],
        links: [],
      })

      const ips = db
        .query<{ value: string; source_id: string }, [string]>(
          'SELECT value, source_id FROM entity_identity_key WHERE entity_id = ? AND key = "mgmtIp"',
        )
        .all(entityId ?? '')
      expect(ips.length).toBe(1)
      expect(ips[0]?.value).toBe('10.8.8.2')
      expect(ips[0]?.source_id).toBe(src)
    })
  })

  // -------------------------------------------------------------------------
  // @570: identity-less ports stay stable across re-ingests
  // -------------------------------------------------------------------------

  describe('identity-less port stability', () => {
    test('a port declared without identity keeps its entity across re-ingests', () => {
      const topologyId = makeTopology(db)
      const src = insertDataSource('manual-port')
      attachSource(topologyId, src, 'topology')

      const graph: NetworkGraph = {
        name: 'manual-port',
        nodes: [
          {
            id: 'sw',
            label: 'sw',
            identity: { chassisId: 'ab:ab:ab:ab:ab:01' },
            // No identity on the port. ingestGraph stamps identity.ifName = <port id>
            // (port ids ARE interface names), so the registry adopts via ifName;
            // the staged port lookup additionally covers a raw manual:<src> key
            // defensively should a caller ever bypass that ingest stamp.
            ports: [{ id: 'p-noident', label: 'p', connectors: [] }],
          },
        ],
        links: [],
      }

      ingestAndRegister(db, topologyId, src, graph)
      const ports1 = entityIdsOf(db, topologyId, 'port')
      expect(ports1.length).toBe(1)

      ingestAndRegister(db, topologyId, src, graph)
      const ports2 = entityIdsOf(db, topologyId, 'port')

      // Staged lookup must re-find the same port entity — never mint-per-sync.
      expect(ports2).toEqual(ports1)
    })
  })

  // -------------------------------------------------------------------------
  // @570: ULID unit tests
  // -------------------------------------------------------------------------

  describe('generateUlid', () => {
    test('produces 26-char strings', () => {
      expect(generateUlid()).toHaveLength(26)
    })

    test('uses Crockford base32 alphabet (no I, L, O, U)', () => {
      const CROCKFORD = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/
      for (let i = 0; i < 50; i++) {
        const id = generateUlid()
        expect(CROCKFORD.test(id)).toBe(true)
        expect(id).not.toMatch(/[ILOU]/)
      }
    })

    test('lexicographic order follows Date.now() order across >=2ms-separated calls', async () => {
      const id1 = generateUlid()
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
      const id2 = generateUlid()
      expect(id1 < id2).toBe(true)
    })

    test('1000 generated ids are all unique', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        ids.add(generateUlid())
      }
      expect(ids.size).toBe(1000)
    })
  })
})
