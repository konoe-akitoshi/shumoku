// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Migration 036: contributions stored with a node's and a port's identity in the observation
 * (`contribution_identity` rows of `mgmtIp` / `chassisId` / `sysName` / `mac` / `vendorId:*` on a
 * node, `ifName` / `ifIndex` / `mac` on a port) are rewritten with the device attributes on the
 * configuration node and port, a source's own ids under `vendorIds`, and `ifIndex` as the port's
 * observation. Rows are written here in the pre-036 layout by hand, as the old codec wrote them.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  addResolvedRecordColumn,
  liftIdentityIntoConfiguration,
  migrateContributionsToDeviceAttributes,
  migrateObservationsToDeviceAttributes,
} from '../../src/db/migrations/036_device_attributes.ts'
import { buildNetwork } from '../../src/services/contribution-store.ts'
import { getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
  insertDataSource('manual', 'src')
})
afterAll(() => db_.teardown())

const PORT_SEP = '\u001f'

/** Write one contribution in the layout the store had before 036. */
function seedIdentityContribution(topologyId: string, sourceId: string): void {
  const db = getDatabase()
  db.query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)').run(
    topologyId,
    topologyId,
  )
  db.query(
    `INSERT INTO contribution_source (topology_id, source_id, attachment_id, last_status, last_ok_at, graph_payload_json, content_hash)
     VALUES (?, ?, NULL, 'ok', 1, ?, 'stale')`,
  ).run(topologyId, sourceId, JSON.stringify({ network: { name: 'old' } }))
  const element = (
    localId: string,
    kind: string,
    parent: string | null,
    payload: Record<string, unknown>,
  ): number =>
    Number(
      db
        .query(
          `INSERT INTO contribution_element (topology_id, source_id, local_id, kind, parent_local_id, presence, payload_json)
           VALUES (?, ?, ?, ?, ?, 'present', ?)`,
        )
        .run(topologyId, sourceId, localId, kind, parent, JSON.stringify(payload)).lastInsertRowid,
    )
  const key = (eid: number, type: string, value: string) =>
    db
      .query(
        'INSERT INTO contribution_identity (element_id, topology_id, source_id, key_type, key_value) VALUES (?, ?, ?, ?, ?)',
      )
      .run(eid, topologyId, sourceId, type, value)

  const a = element('a', 'node', null, {
    config: { label: 'A', type: 'switch', ports: [{ name: 'p1', speed: '1G' }] },
    observation: { metadata: { rack: '1' } },
  })
  key(a, 'mgmtIp', '10.0.0.1')
  key(a, 'chassisId', 'aa:bb:cc:dd:ee:01')
  key(a, 'sysName', 'sw-a')
  key(a, 'mac', 'aa:bb:cc:dd:ee:01')
  key(a, 'vendorId:netbox-device-id', '42')
  // A port named by a vendor id whose interface name differs: it is renamed to the interface name.
  const p1 = element(`a${PORT_SEP}p1`, 'port', 'a', { config: { speed: '1G' } })
  key(p1, 'ifName', 'Gi0/1')
  key(p1, 'ifIndex', '10001')
  key(p1, 'mac', 'aa:bb:cc:dd:ee:11')
  const p2 = element(`a${PORT_SEP}Gi0/2`, 'port', 'a', {})
  key(p2, 'ifName', 'Gi0/2')
  const b = element('b', 'node', null, { config: { label: 'B' } })
  key(b, 'mgmtIp', '10.0.0.2')
  const bPort = element(`b${PORT_SEP}eth0`, 'port', 'b', {})
  key(bPort, 'ifName', 'eth0')
  db.query(
    `INSERT INTO contribution_link
       (topology_id, source_id, local_id, from_node_local_id, from_port_local_id, to_node_local_id, to_port_local_id, presence, payload_json)
     VALUES (?, ?, 'l1', 'a', ?, 'b', ?, 'present', ?)`,
  ).run(topologyId, sourceId, `a${PORT_SEP}p1`, `b${PORT_SEP}eth0`, JSON.stringify({ config: {} }))
  const hide = element('__exclusion_0', 'node', null, {})
  db.query('UPDATE contribution_element SET presence = ? WHERE id = ?').run('hide', hide)
  key(hide, 'mgmtIp', '10.9.9.9')
}

describe('migration 036 — the device attributes move into the configuration', () => {
  test('lifts node and port identity onto the configuration and keeps the source’s own', () => {
    seedIdentityContribution('t_036', 'src')
    addResolvedRecordColumn(getDatabase())
    migrateContributionsToDeviceAttributes(getDatabase())

    const built = buildNetwork('t_036', 'src')
    expect(built?.network.nodes).toEqual([
      {
        id: 'a',
        label: 'A',
        type: 'switch',
        address: '10.0.0.1',
        chassisId: 'aa:bb:cc:dd:ee:01',
        sysName: 'sw-a',
        mac: 'aa:bb:cc:dd:ee:01',
        ports: [{ name: 'Gi0/1', speed: '1G', mac: 'aa:bb:cc:dd:ee:11' }],
      },
      { id: 'b', label: 'B', address: '10.0.0.2' },
    ])
    expect(built?.observation?.nodes?.['a']).toEqual({
      vendorIds: { 'netbox-device-id': '42' },
      metadata: { rack: '1' },
      ports: { 'Gi0/1': { ifIndex: 10001 }, 'Gi0/2': {} },
    })
    // The link end follows the renamed port.
    expect(built?.network.links[0]?.endpoints).toEqual([
      { node: 'a', port: 'Gi0/1' },
      { node: 'b', port: 'eth0' },
    ])
    expect(built?.observation?.exclusions).toEqual([{ mgmtIp: '10.9.9.9' }])
    expect(JSON.stringify(built)).not.toContain('identity')
    const row = getDatabase()
      .query('SELECT content_hash FROM contribution_source WHERE topology_id = ?')
      .get('t_036') as { content_hash: string | null }
    expect(row.content_hash).toBeNull()
  })

  test('is idempotent: rows already in today’s layout read the same', () => {
    const before = buildNetwork('t_036', 'src')
    migrateContributionsToDeviceAttributes(getDatabase())
    expect(buildNetwork('t_036', 'src')).toEqual(before)
  })

  test('rewrites the audit log', () => {
    const db = getDatabase()
    db.query(
      `INSERT INTO topology_observations (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
       VALUES ('obs-036', 't_036', 'src', 1, 'ok', ?, 1, 0, 1, 1)`,
    ).run(
      JSON.stringify({
        network: { nodes: [{ id: 'n' }], links: [] },
        observation: {
          nodes: {
            n: {
              identity: { mgmtIp: '10.0.0.5', vendorIds: { 'zabbix-hostid': '7' } },
              ports: { p: { identity: { ifName: 'ge-0', ifIndex: 3, mac: 'aa:bb:cc:dd:ee:ff' } } },
            },
          },
        },
      }),
    )
    migrateObservationsToDeviceAttributes(db)
    const row = db
      .query('SELECT graph_json FROM topology_observations WHERE id = ?')
      .get('obs-036') as { graph_json: string }
    expect(JSON.parse(row.graph_json)).toEqual({
      network: {
        nodes: [
          { id: 'n', address: '10.0.0.5', ports: [{ name: 'ge-0', mac: 'aa:bb:cc:dd:ee:ff' }] },
        ],
        links: [],
      },
      observation: {
        nodes: { n: { vendorIds: { 'zabbix-hostid': '7' }, ports: { 'ge-0': { ifIndex: 3 } } } },
      },
    })
  })

  test('the lift leaves a contribution of today’s shape as it is', () => {
    const today = {
      network: {
        nodes: [{ id: 'n', address: '10.0.0.1', ports: [{ name: 'p', mac: 'aa' }] }],
        links: [],
      },
      observation: { nodes: { n: { vendorIds: { x: '1' }, ports: { p: { ifIndex: 2 } } } } },
    }
    expect(liftIdentityIntoConfiguration(today)).toEqual(today)
  })

  test('the baked artifact has a column for the record', () => {
    const columns = getDatabase().query('PRAGMA table_info(topology_resolved_graph)').all() as {
      name: string
    }[]
    expect(columns.some((c) => c.name === 'record_json')).toBe(true)
  })
})
