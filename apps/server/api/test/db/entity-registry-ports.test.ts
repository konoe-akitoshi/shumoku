// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Port matching in the entity registry: which observed ports are one port.
 *
 * Run with: cd apps/server/api && bun test test/db/entity-registry-ports.test.ts
 */

import type { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { getDatabase, timestamp } from '../../src/db/index.ts'
import { ingestNetwork } from '../../src/services/contribution-store.ts'
import { adoptOrMintForGraph } from '../../src/services/entity-registry.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { attachSource, graphToSource, insertDataSource, setupTempDb } from './helper.ts'

// What an Arista DCS-7050SX3 reports: many interfaces answer with the chassis MAC.
const BASE_MAC = '2c:dd:e9:28:05:43'
const CHASSIS = { chassisId: BASE_MAC, mgmtIp: '172.19.20.1' }

interface PortSpec {
  id: string
  ifName?: string
  mac?: string
  ifIndex?: number
}

function switchGraph(ports: PortSpec[], links: NetworkGraph['links'] = []): NetworkGraph {
  return {
    name: 'g',
    nodes: [
      {
        id: 'sw',
        label: 'sw',
        identity: CHASSIS,
        ports: ports.map((p) => ({
          id: p.id,
          label: p.id,
          connectors: [],
          identity: {
            ifName: p.ifName ?? p.id,
            ...(p.mac ? { mac: p.mac } : {}),
            ...(p.ifIndex !== undefined ? { ifIndex: p.ifIndex } : {}),
          },
        })),
      },
    ],
    links,
  }
}

describe('entity registry: port matching', () => {
  let teardown: () => void
  let db: Database

  beforeAll(() => {
    const tmp = setupTempDb()
    teardown = tmp.teardown
    db = getDatabase()
  })
  afterAll(() => teardown())

  function topology(): string {
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

  function source(topologyId: string, name: string): string {
    const id = insertDataSource(name)
    attachSource(topologyId, id, 'topology')
    return id
  }

  function ingest(
    topologyId: string,
    sourceId: string,
    graph: NetworkGraph,
    options?: { complete?: boolean },
  ): void {
    const attach = db
      .query<{ id: string }, [string, string]>(
        `SELECT id FROM topology_data_sources
         WHERE topology_id = ? AND data_source_id = ? AND purpose = 'topology'`,
      )
      .get(topologyId, sourceId)
    ingestNetwork(
      topologyId,
      sourceId,
      graphToSource(graph),
      { attachmentId: attach?.id ?? null },
      db,
    )
    adoptOrMintForGraph(topologyId, sourceId, db, timestamp(), options)
  }

  function portEntity(topologyId: string, sourceId: string, port: string): string | undefined {
    return db
      .query<{ entity_id: string }, [string, string, string]>(
        `SELECT entity_id FROM entity_element
         WHERE topology_id = ? AND source_id = ? AND kind = 'port' AND local_id = ?`,
      )
      .get(topologyId, sourceId, `sw:${port}`)?.entity_id
  }

  function count(topologyId: string, kind: string): number {
    return (
      db
        .query<{ n: number }, [string, string]>(
          'SELECT COUNT(*) AS n FROM entity_registry WHERE topology_id = ? AND kind = ?',
        )
        .get(topologyId, kind)?.n ?? 0
    )
  }

  function keysOf(entityId: string | undefined, key: string): string[] {
    return db
      .query<{ value: string }, [string, string]>(
        'SELECT value FROM entity_identity_key WHERE entity_id = ? AND key = ? ORDER BY value',
      )
      .all(entityId ?? '', key)
      .map((r) => r.value)
  }

  test('ports that answer with the chassis MAC stay separate ports', () => {
    const t = topology()
    const s = source(t, 'deep-read')
    const graph = switchGraph([
      { id: 'Ethernet3', mac: '2c:dd:e9:28:05:46' },
      { id: 'Ethernet7', mac: BASE_MAC },
      { id: 'Ethernet8', mac: BASE_MAC },
      { id: 'Ethernet49/1', mac: BASE_MAC },
      { id: 'Vlan19', mac: BASE_MAC },
    ])

    ingest(t, s, graph)
    expect(count(t, 'port')).toBe(5)
    expect(new Set(graph.nodes[0]?.ports?.map((p) => portEntity(t, s, p.id))).size).toBe(5)

    const before = portEntity(t, s, 'Ethernet8')
    ingest(t, s, graph)
    expect(count(t, 'port')).toBe(5)
    expect(portEntity(t, s, 'Ethernet8')).toBe(before)
  })

  test('a renamed port keeps its entity through its own MAC', () => {
    const t = topology()
    const s = source(t, 'rename')
    ingest(t, s, switchGraph([{ id: 'Eth1', mac: 'aa:aa:aa:aa:aa:03' }]))
    const entity = portEntity(t, s, 'Eth1')

    ingest(t, s, switchGraph([{ id: 'Ethernet1', mac: 'aa:aa:aa:aa:aa:03' }]))

    expect(portEntity(t, s, 'Ethernet1')).toBe(entity)
    expect(count(t, 'port')).toBe(1)
  })

  test('two sources that name a port differently meet on its unique MAC', () => {
    const t = topology()
    const a = source(t, 'a')
    const b = source(t, 'b')
    ingest(t, a, switchGraph([{ id: 'xe-0/0/1', mac: 'aa:aa:aa:aa:aa:04' }]))
    ingest(t, b, switchGraph([{ id: 'Ethernet1', mac: 'aa:aa:aa:aa:aa:04' }]))

    expect(portEntity(t, b, 'Ethernet1')).toBe(portEntity(t, a, 'xe-0/0/1'))
  })

  function nodeGraph(identity: NonNullable<NetworkGraph['nodes'][number]['identity']>) {
    return { name: 'g', nodes: [{ id: 'n', label: 'n', identity }], links: [] } as NetworkGraph
  }

  function nodeEntity(topologyId: string, sourceId: string): string | undefined {
    return db
      .query<{ entity_id: string }, [string, string]>(
        `SELECT entity_id FROM entity_element
         WHERE topology_id = ? AND source_id = ? AND kind = 'node' AND local_id = 'n'`,
      )
      .get(topologyId, sourceId)?.entity_id
  }

  test('a key a source stopped reporting is dropped by a complete observation', () => {
    const t = topology()
    const s = source(t, 'stale')
    const identity = { mgmtIp: '10.0.0.9', vendorIds: { z: '1' } }
    ingest(t, s, nodeGraph({ ...identity, sysName: 'operator display name' }))
    expect(keysOf(nodeEntity(t, s), 'sysName')).toEqual(['operator display name'])

    ingest(t, s, nodeGraph(identity), { complete: true })

    expect(keysOf(nodeEntity(t, s), 'sysName')).toEqual([])
  })

  test('a partial observation drops nothing', () => {
    const t = topology()
    const s = source(t, 'partial')
    const identity = { mgmtIp: '10.0.0.10', vendorIds: { z: '2' } }
    ingest(t, s, nodeGraph({ ...identity, sysName: 'kept' }))

    ingest(t, s, nodeGraph(identity), { complete: false })

    expect(keysOf(nodeEntity(t, s), 'sysName')).toEqual(['kept'])
  })

  test('dropping a stale key leaves what other sources reported', () => {
    const t = topology()
    const a = source(t, 'a')
    const b = source(t, 'b')
    const identity = { mgmtIp: '10.0.0.11' }
    ingest(t, a, nodeGraph({ ...identity, sysName: 'real-name' }))
    ingest(t, b, nodeGraph({ ...identity, sysName: 'real-name' }))

    ingest(t, a, nodeGraph(identity), { complete: true })

    expect(keysOf(nodeEntity(t, b), 'sysName')).toEqual(['real-name'])
  })

  test('observations are complete only when the scan status is ok', async () => {
    const t = topology()
    const s = source(t, 'status')
    const obs = new ObservationsService()
    const identity = { mgmtIp: '10.0.0.13', vendorIds: { z: '4' } }
    const record = (status: 'ok' | 'partial', graph: NetworkGraph) =>
      obs.record({
        topologyId: t,
        sourceId: s,
        capturedAt: Date.now(),
        status,
        source: graphToSource(graph),
      })
    await record('ok', nodeGraph({ ...identity, sysName: 'gone-later' }))

    await record('partial', nodeGraph(identity))
    expect(keysOf(nodeEntity(t, s), 'sysName')).toEqual(['gone-later'])

    await record('ok', nodeGraph(identity))
    expect(keysOf(nodeEntity(t, s), 'sysName')).toEqual([])
  })
})
