// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A Manual source's node can be pointed at an entity another source already minted, by
 * adding the key `manual:<manualSourceId> = <nodeId>` to that entity. The Manual source's own
 * adopt (what `ObservationsService.record()` runs) then lands on the same entity instead of
 * minting a second one. This is what lets a rename or a hide reach a device that has no
 * management address.
 *
 * Run with: cd apps/server/api && bun test test/db/manual-claim.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  claimNodeForSource,
  findNodeEntities,
  findNodeEntityById,
} from '../../src/services/entity-registry.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import {
  attachSource,
  getDatabase,
  insertDataSource,
  setupTempDb,
  type TempDb,
  timestamp,
} from './helper.ts'

let tmp: TempDb
beforeAll(() => {
  tmp = setupTempDb()
})
afterAll(() => tmp.teardown())

function topology(): string {
  const db = getDatabase()
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

function nodeEntities(topologyId: string): string[] {
  return getDatabase()
    .query<{ id: string }, [string]>(
      "SELECT id FROM entity_registry WHERE topology_id = ? AND kind = 'node' ORDER BY id",
    )
    .all(topologyId)
    .map((r) => r.id)
}

const observe = (topologyId: string, sourceId: string, nodes: object[]) =>
  new ObservationsService().record({
    topologyId,
    sourceId,
    capturedAt: Date.now(),
    status: 'ok',
    source: {
      network: { nodes: nodes as never, links: [] },
      observation: {
        nodes: Object.fromEntries(
          nodes.flatMap((n) => {
            const { identity, id } = n as { id: string; identity?: object }
            return identity ? [[id, { identity }]] : []
          }),
        ),
      },
    },
  })

describe('claiming an existing entity for a Manual source node', () => {
  test('a Manual node lands on an entity that has only a chassisId, via a manual: key', async () => {
    const topologyId = topology()
    // A scanned device with a strong key (chassisId) and no management address.
    const scan = insertDataSource('lldp')
    attachSource(topologyId, scan, 'topology')
    await observe(topologyId, scan, [
      { id: 'dev', identity: { chassisId: 'aa:bb:cc:00:00:01', sysName: 'dev-1' } },
    ])
    const [entity, ...rest] = nodeEntities(topologyId)
    expect(rest).toEqual([])
    if (!entity) throw new Error('no entity minted')

    // The identity finds it the way an adopt would, ahead of any Manual source existing.
    const found = findNodeEntities(topologyId, { chassisId: 'aa:bb:cc:00:00:01' }, getDatabase())
    expect(found).toEqual([entity as never])
    expect(findNodeEntityById(topologyId, entity, getDatabase())).toBe(entity as never)

    // The Manual source is attached, the key is added, THEN its network is recorded.
    const manual = insertDataSource('manual')
    attachSource(topologyId, manual, 'topology')
    expect(claimNodeForSource(topologyId, entity as never, manual, 'renamed', getDatabase())).toBe(
      true,
    )
    await observe(topologyId, manual, [{ id: 'renamed', label: 'Renamed' }])

    // No second entity: the Manual node adopted the existing one.
    expect(nodeEntities(topologyId)).toEqual([entity])
    const element = getDatabase()
      .query<{ entity_id: string }, [string, string]>(
        "SELECT entity_id FROM entity_element WHERE topology_id = ? AND source_id = ? AND kind = 'node' AND local_id = 'renamed'",
      )
      .get(topologyId, manual)
    expect(element?.entity_id).toBe(entity as never)
    // The scanning source's strong key is untouched.
    const chassis = getDatabase()
      .query<{ value: string }, [string, string]>(
        "SELECT value FROM entity_identity_key WHERE topology_id = ? AND entity_id = ? AND key = 'chassisId'",
      )
      .all(topologyId, entity)
    expect(chassis.map((r) => r.value)).toEqual(['aa:bb:cc:00:00:01'])
  })

  test('without the claim, the same Manual node mints a separate entity', async () => {
    const topologyId = topology()
    const scan = insertDataSource('lldp')
    attachSource(topologyId, scan, 'topology')
    await observe(topologyId, scan, [{ id: 'dev', identity: { chassisId: 'aa:bb:cc:00:00:02' } }])
    const manual = insertDataSource('manual')
    attachSource(topologyId, manual, 'topology')
    await observe(topologyId, manual, [{ id: 'renamed', label: 'Renamed' }])
    expect(nodeEntities(topologyId)).toHaveLength(2)
  })

  test('a key held by another entity is refused rather than stolen', async () => {
    const topologyId = topology()
    const scan = insertDataSource('lldp')
    attachSource(topologyId, scan, 'topology')
    await observe(topologyId, scan, [
      { id: 'a', identity: { chassisId: 'aa:bb:cc:00:00:03' } },
      { id: 'b', identity: { chassisId: 'aa:bb:cc:00:00:04' } },
    ])
    const [a, b] = nodeEntities(topologyId)
    if (!a || !b) throw new Error('entities missing')
    const manual = insertDataSource('manual')
    attachSource(topologyId, manual, 'topology')
    expect(claimNodeForSource(topologyId, a as never, manual, 'x', getDatabase())).toBe(true)
    expect(claimNodeForSource(topologyId, b as never, manual, 'x', getDatabase())).toBe(false)
    // And it can run twice for the same entity.
    expect(claimNodeForSource(topologyId, a as never, manual, 'x', getDatabase())).toBe(true)
  })

  test('TopologyService is importable alongside (guards circular imports)', () => {
    expect(typeof TopologyService).toBe('function')
  })
})
