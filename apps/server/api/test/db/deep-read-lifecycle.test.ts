// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A device's reading lives only as long as the device can be read: excluding it, taking its
 * credential away or unlinking the credential from the topology takes the reading out.
 *
 * Run with: cd apps/server/api && bun test test/db/deep-read-lifecycle.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SourceNetwork } from '@shumoku/core'
import { getDatabase, timestamp } from '../../src/db/index.ts'
import {
  clearReadings,
  DEEP_READ_SOURCE_ID,
  keepReadable,
  readableOf,
  withdrawUnreadable,
} from '../../src/services/deep-read-service.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { attachSource, insertDataSource, setupTempDb } from './helper.ts'

const A = 'deep-read:node:10.0.0.1'
const B = 'deep-read:node:10.0.0.2'
const PEER = 'deep-read:node:lldp:aa:aa:aa:aa:aa:aa'

/** Two switches read over SNMP, each with an LLDP neighbour: A sees the peer, B sees A. */
const reading: SourceNetwork = {
  network: {
    nodes: [
      { id: A, address: '10.0.0.1', chassisId: '00:00:00:00:00:0a' },
      { id: B, address: '10.0.0.2', chassisId: '00:00:00:00:00:0b' },
      { id: PEER, chassisId: 'aa:aa:aa:aa:aa:aa' },
    ],
    links: [
      { id: 'a-peer', endpoints: [{ node: A, port: 'e1' }, { node: PEER }] },
      {
        id: 'b-a',
        endpoints: [
          { node: B, port: 'e1' },
          { node: A, port: 'e2' },
        ],
      },
    ],
  },
  observation: {
    nodes: {
      [A]: { metadata: { readVia: 'snmp' } },
      [B]: { metadata: { readVia: 'snmp' } },
      [PEER]: { metadata: { syncState: 'notice' } },
    },
    links: {},
  },
}

describe('deep-read readings follow device access', () => {
  let teardown: () => void
  let observations: ObservationsService

  beforeAll(() => {
    teardown = setupTempDb().teardown
    observations = new ObservationsService()
  })
  afterAll(() => teardown())

  /** A topology holding the reading, with one linked credential reading both switches. */
  async function topology(tag: string) {
    const db = getDatabase()
    const id = `topo-${tag}`
    const now = timestamp()
    db.query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      id,
      id,
      now,
      now,
    )
    if (!db.query('SELECT 1 FROM data_sources WHERE id = ?').get(DEEP_READ_SOURCE_ID)) {
      insertDataSource(DEEP_READ_SOURCE_ID, DEEP_READ_SOURCE_ID)
    }
    attachSource(id, DEEP_READ_SOURCE_ID, 'topology')
    await observations.record({
      topologyId: id,
      sourceId: DEEP_READ_SOURCE_ID,
      capturedAt: Date.now(),
      status: 'ok',
      source: reading,
    })
    const credential = `cred-${tag}`
    db.query(
      `INSERT INTO credential
         (id, name, method, params_json, secret_json, secret_changed_at, created_at, updated_at)
       VALUES (?, ?, 'snmp', '{}', '{}', 0, 0, 0)`,
    ).run(credential, credential)
    db.query(
      'INSERT INTO topology_credential (topology_id, credential_id, added_at) VALUES (?, ?, 0)',
    ).run(id, credential)
    const entityOf = (local: string) =>
      (
        db
          .query<{ entity_id: string }, [string, string, string]>(
            `SELECT entity_id FROM entity_element
              WHERE topology_id = ? AND source_id = ? AND kind = 'node' AND local_id = ?`,
          )
          .get(id, DEEP_READ_SOURCE_ID, local) ?? { entity_id: '' }
      ).entity_id
    for (const local of [A, B]) {
      db.query(
        `INSERT INTO device_access (entity_id, topology_id, credential_id, enabled, last_status, updated_at)
         VALUES (?, ?, ?, 1, 'ok', 0)`,
      ).run(entityOf(local), id, credential)
    }
    const nodes = () =>
      (observations.getContribution(id, DEEP_READ_SOURCE_ID)?.network.nodes ?? []).map((n) => n.id)
    const links = () =>
      (observations.getContribution(id, DEEP_READ_SOURCE_ID)?.network.links ?? []).map((l) => l.id)
    return { id, credential, entityOf, nodes, links }
  }

  test('keeps every reading while the devices can be read', async () => {
    const t = await topology('readable')
    expect(await withdrawUnreadable(t.id, observations)).toBe(false)
    expect(t.nodes().sort()).toEqual([A, B, PEER].sort())
  })

  test('an excluded device takes out its reading, its links and the neighbour only it saw', async () => {
    const t = await topology('excluded')
    getDatabase()
      .query('UPDATE device_access SET enabled = 0 WHERE entity_id = ?')
      .run(t.entityOf(A))
    expect(await withdrawUnreadable(t.id, observations)).toBe(true)
    expect(t.nodes()).toEqual([B])
    expect(t.links()).toEqual([])
  })

  test('a row left on an entity merged away does not keep the device readable', async () => {
    const t = await topology('merged')
    const db = getDatabase()
    // an inventory's entity for A, merged into A's, still holds an enabled row with the credential
    db.query(
      `INSERT INTO entity_registry (id, topology_id, kind, parent_id, status, first_seen_at, last_seen_at)
       VALUES ('absorbed-merged', ?, 'node', NULL, 'active', 0, 0)`,
    ).run(t.id)
    db.query("INSERT INTO entity_alias (old_id, new_id) VALUES ('absorbed-merged', ?)").run(
      t.entityOf(A),
    )
    db.query(
      `INSERT INTO device_access (entity_id, topology_id, credential_id, enabled, updated_at)
       VALUES ('absorbed-merged', ?, ?, 1, 0)`,
    ).run(t.id, t.credential)
    db.query('UPDATE device_access SET enabled = 0 WHERE entity_id = ?').run(t.entityOf(A))
    expect(await withdrawUnreadable(t.id, observations)).toBe(true)
    expect(t.nodes()).toEqual([B])
  })

  test('a device turned off while it was being read stays out when the read lands', async () => {
    const t = await topology('racing')
    const a = t.entityOf(A)
    getDatabase().query('UPDATE device_access SET enabled = 0 WHERE entity_id = ?').run(a)
    expect(await withdrawUnreadable(t.id, observations)).toBe(true)
    // the read that was running brings A back; the registry no longer knows its node
    const landed = keepReadable(reading, readableOf(t.id, new Map([[A, a]])))
    expect(landed.network.nodes.map((n) => n.id)).toEqual([B])
  })

  test('a device that only failed to answer keeps its reading', async () => {
    const t = await topology('lost')
    getDatabase()
      .query("UPDATE device_access SET last_status = 'failed' WHERE entity_id = ?")
      .run(t.entityOf(A))
    expect(await withdrawUnreadable(t.id, observations)).toBe(false)
    expect(t.nodes().sort()).toEqual([A, B, PEER].sort())
  })

  test('unlinking the credential from the topology takes every reading out', async () => {
    const t = await topology('unlinked')
    getDatabase()
      .query('DELETE FROM topology_credential WHERE topology_id = ? AND credential_id = ?')
      .run(t.id, t.credential)
    expect(await withdrawUnreadable(t.id, observations)).toBe(true)
    expect(t.nodes()).toEqual([])
  })

  test('deleting the credential takes every reading out', async () => {
    const t = await topology('deleted')
    getDatabase().query('DELETE FROM credential WHERE id = ?').run(t.credential)
    expect(await withdrawUnreadable(t.id, observations)).toBe(true)
    expect(t.nodes()).toEqual([])
  })

  test('clearing takes the readings out and keeps the credentials', async () => {
    const t = await topology('cleared')
    expect(clearReadings(t.id, observations)).toBeGreaterThan(0)
    expect(t.nodes()).toEqual([])
    const rows = getDatabase()
      .query<{ credential_id: string; last_status: string | null }, [string]>(
        'SELECT credential_id, last_status FROM device_access WHERE topology_id = ?',
      )
      .all(t.id)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.credential_id === t.credential && r.last_status === null)).toBe(true)
  })
})
