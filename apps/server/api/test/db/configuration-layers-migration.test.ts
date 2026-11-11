// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Migration 035: contributions stored with a design layer (ports, products, plugs, cables, via
 * and terminations beside the configuration) are lifted into the configuration's shape, and
 * what nothing reads any more (coordinates, port placements, group directions, membership
 * rules, `fieldSources`) is dropped. Rows are written here in the pre-035 layout by hand, as
 * the old codec wrote them.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  migrateContributionsToConfiguration,
  migrateObservationsToConfiguration,
} from '../../src/db/migrations/035_configuration_layers.ts'
import { migrateContributionsToDeviceAttributes } from '../../src/db/migrations/036_device_attributes.ts'
import { buildNetwork } from '../../src/services/contribution-store.ts'
import { getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
  insertDataSource('manual', 'src')
})
afterAll(() => db_.teardown())

const PORT_SEP = '\u001f'

/** Write one contribution in the layered layout the store had before 035. */
function seedLayeredContribution(topologyId: string, sourceId: string): void {
  const db = getDatabase()
  db.query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)').run(
    topologyId,
    topologyId,
  )
  db.query(
    `INSERT INTO contribution_source (topology_id, source_id, attachment_id, last_status, last_ok_at, graph_payload_json, content_hash)
     VALUES (?, ?, NULL, 'ok', 1, ?, 'stale')`,
  ).run(
    topologyId,
    sourceId,
    JSON.stringify({
      network: { name: 'old' },
      drawing: { settings: { theme: 'dark' }, order: { '': ['b', 'a'] } },
    }),
  )
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
  const identity = (eid: number, type: string, value: string) =>
    db
      .query(
        'INSERT INTO contribution_identity (element_id, topology_id, source_id, key_type, key_value) VALUES (?, ?, ?, ?, ?)',
      )
      .run(eid, topologyId, sourceId, type, value)

  element('g', 'subgraph', null, {
    config: { label: 'Group' },
    observation: { membership: [{ attr: 'subnet', value: '10.0.0.0/24' }] },
    drawing: { direction: 'TB', style: { fill: '#fff' } },
  })
  const a = element('a', 'node', 'g', {
    config: { label: 'A', type: 'switch' },
    observation: { metadata: { rack: '1' }, fieldSources: { label: 'intrinsic' } },
    design: {
      productId: 'lib-1',
      spec: { kind: 'compute', platform: 'esxi' },
      termination: { role: 'bend' },
    },
    drawing: { shape: 'rect', position: { x: 1, y: 2 }, size: { width: 3, height: 4 } },
  })
  identity(a, 'mgmtIp', '10.0.0.1')
  const aPort = element(`a${PORT_SEP}eth0`, 'port', 'a', {
    observation: {},
    design: { label: 'eth0', interfaceName: 'Ethernet0', connectors: [], disabled: true },
    drawing: { placement: { side: 'top', order: 1 } },
  })
  identity(aPort, 'ifName', 'eth0')
  const b = element('b', 'node', null, { config: { label: 'B' } })
  identity(b, 'mgmtIp', '10.0.0.2')
  const bPort = element(`b${PORT_SEP}eth1`, 'port', 'b', {})
  identity(bPort, 'ifName', 'eth1')
  element('out-1', 'termination', null, {
    label: 'Outlet',
    role: 'outlet',
    position: { x: 5, y: 6 },
    metadata: { autoFor: 'l1:eps-1' },
  })
  const link = Number(
    db
      .query(
        `INSERT INTO contribution_link
           (topology_id, source_id, local_id, from_node_local_id, from_port_local_id, to_node_local_id, to_port_local_id, presence, payload_json)
         VALUES (?, ?, 'l1', 'a', ?, 'b', ?, 'present', ?)`,
      )
      .run(
        topologyId,
        sourceId,
        `a${PORT_SEP}eth0`,
        `b${PORT_SEP}eth1`,
        JSON.stringify({
          config: { speed: '10G', cable: 'om4' },
          design: {
            ends: [{ plug: { cage: 'sfp+', module: { standard: '10GBASE-SR' } } }, {}],
            cable: { medium: 'fiber-mm', category: 'om4', productId: 'cab-1' },
            bends: [{ id: 'bd', x: 1, y: 2, afterIndex: -1 }],
          },
          drawing: { label: 'trunk' },
        }),
      ).lastInsertRowid,
  )
  db.query(
    'INSERT INTO contribution_link_via (link_id, topology_id, source_id, seq, termination_local_id) VALUES (?, ?, ?, 0, ?)',
  ).run(link, topologyId, sourceId, 'out-1')
}

const expectedNetwork = {
  name: 'old',
  groups: [{ id: 'g', label: 'Group' }],
  nodes: [
    {
      id: 'a',
      label: 'A',
      type: 'switch',
      address: '10.0.0.1',
      group: 'g',
      productId: 'lib-1',
      platform: 'esxi',
      ports: [{ name: 'eth0', interfaceName: 'Ethernet0' }],
    },
    { id: 'b', label: 'B', address: '10.0.0.2' },
  ],
  links: [
    {
      id: 'l1',
      speed: '10G',
      cable: { type: 'om4', productId: 'cab-1' },
      endpoints: [
        { node: 'a', port: 'eth0', plug: { cage: 'sfp+', module: { standard: '10GBASE-SR' } } },
        { node: 'b', port: 'eth1' },
      ],
      via: ['out-1'],
    },
  ],
  terminations: [{ id: 'out-1', label: 'Outlet', role: 'outlet', autoFor: 'l1:eps-1' }],
}

describe('migration 035 — the design layer folds into the configuration', () => {
  // 036 follows 035 in every upgrade: the identity 035 keeps in the observation moves into the
  // configuration there, so the result is read in today's shape after both.
  test('lifts a layered contribution, drops what nothing reads, and clears the content hash', () => {
    seedLayeredContribution('t_035', 'src')
    migrateContributionsToConfiguration(getDatabase())
    migrateContributionsToDeviceAttributes(getDatabase())

    const built = buildNetwork('t_035', 'src')
    expect(built?.network).toEqual(expectedNetwork)
    expect(built?.observation?.nodes?.['a']).toEqual({
      metadata: { rack: '1' },
      ports: { eth0: {} },
    })
    expect(built?.observation?.groups).toBeUndefined()
    expect(built?.drawing).toEqual({
      nodes: { a: { shape: 'rect' } },
      links: { l1: { label: 'trunk' } },
      groups: { g: { style: { fill: '#fff' } } },
      settings: { theme: 'dark' },
      order: { '': ['b', 'a'] },
    })
    const text = JSON.stringify(built)
    for (const gone of [
      'design',
      'position',
      'size',
      'placement',
      'direction',
      'membership',
      'fieldSources',
      'bends',
      'disabled',
      'termination"',
    ])
      expect(text).not.toContain(gone)
    const row = getDatabase()
      .query('SELECT content_hash FROM contribution_source WHERE topology_id = ?')
      .get('t_035') as { content_hash: string | null }
    expect(row.content_hash).toBeNull()
  })

  test('is idempotent: rows already in the configuration layout read the same', () => {
    const before = buildNetwork('t_035', 'src')
    migrateContributionsToConfiguration(getDatabase())
    migrateContributionsToDeviceAttributes(getDatabase())
    expect(buildNetwork('t_035', 'src')).toEqual(before)
  })

  test('rewrites the audit log in the configuration layout', () => {
    const db = getDatabase()
    db.query(
      `INSERT INTO topology_observations (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
       VALUES ('obs-old', 't_035', 'src', 1, 'ok', ?, 1, 0, 1, 1)`,
    ).run(
      JSON.stringify({
        network: { nodes: [{ id: 'n' }], links: [] },
        design: { nodes: { n: { ports: { p: { label: 'p', connectors: ['rj45'], poe: true } } } } },
      }),
    )
    migrateObservationsToConfiguration(db)
    const row = db
      .query('SELECT graph_json FROM topology_observations WHERE id = ?')
      .get('obs-old') as { graph_json: string }
    expect(JSON.parse(row.graph_json)).toEqual({
      network: {
        nodes: [{ id: 'n', ports: [{ name: 'p', connectors: ['rj45'], poe: true }] }],
        links: [],
      },
    })
  })
})
