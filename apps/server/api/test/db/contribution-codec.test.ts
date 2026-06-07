// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Golden round-trip test for the contribution-store codec (stage 1b):
 * `buildGraph(ingestGraph(g)) ≡ g` under normalized equality. See
 * apps/server/docs/design/db-native-persistence.md § Round-trip codec.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { buildGraph, ingestGraph } from '../../src/services/contribution-store.ts'
import { getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
  // metrics-binding.target_source_id FKs data_sources — seed the source the fixtures bind to.
  insertDataSource('zabbix', 'zbx')
})
afterAll(() => db_.teardown())

/**
 * Normalize for the round-trip contract: sort object keys (key order is irrelevant),
 * keep array order, and treat **empty collection ≡ absent** + drop `Subgraph.children`
 * (a derived field, never stored) — both are documented codec equivalences.
 */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      if (k === 'children') continue // derived from parent edges, not round-tripped
      const cv = (v as Record<string, unknown>)[k]
      if (Array.isArray(cv) && cv.length === 0) continue // empty ≡ absent
      out[k] = canon(cv)
    }
    return out
  }
  return v
}

let seq = 0
function roundTrip(graph: NetworkGraph): NetworkGraph {
  const id = `t_rt_${seq++}`
  getDatabase()
    .query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run(id, id)
  ingestGraph(id, 'c', graph)
  const out = buildGraph(id, 'c')
  if (!out) throw new Error('buildGraph returned null')
  return out
}

const expectLossless = (g: NetworkGraph) => expect(canon(roundTrip(g))).toEqual(canon(g))

describe('contribution codec — round-trip', () => {
  test('minimal graph', () => {
    expectLossless({ version: '1', name: 'min', nodes: [], links: [] })
  })

  test('nodes with identity, spec, style, ports, attachments, suppressions', () => {
    expectLossless({
      version: '1',
      name: 'rich',
      description: 'desc',
      nodes: [
        {
          id: 'sw1',
          label: 'Switch 1',
          shape: 'rect',
          spec: { kind: 'hardware', type: 'switch', vendor: 'cisco', model: 'c9300' },
          style: { fill: '#eee', strokeWidth: 2 },
          metadata: { rack: '3' },
          identity: {
            mgmtIp: '10.0.0.1',
            chassisId: 'aa:bb',
            vendorIds: { 'netbox-device-id': '42' },
          },
          attachments: [
            { kind: 'access', protocol: 'snmp', community: 'public', version: '2c' },
            { kind: 'policy', mode: 'auto', intervalMs: 60000 },
          ],
          suppressedAttachments: ['access:ssh'],
          ports: [
            {
              id: 'sw1-p1',
              label: 'Gi1/0/1',
              interfaceName: 'GigabitEthernet1/0/1',
              role: 'uplink',
              identity: { ifName: 'GigabitEthernet1/0/1', ifIndex: 10001 },
              attachments: [
                {
                  kind: 'metrics-binding',
                  sourceId: 'zbx',
                  interfaceName: 'Gi1/0/1',
                  bandwidth: 1000000000,
                },
              ],
            },
          ],
        },
        {
          id: 'host1',
          label: '',
          identity: { mgmtIp: '10.0.0.2' },
          attachments: [
            { kind: 'metrics-binding', sourceId: 'zbx', hostId: 'h-1', hostName: 'host1' },
          ],
        },
      ],
      links: [],
    })
  })

  test('links with ports, plug/ip/pin, via, and a link without id', () => {
    expectLossless({
      version: '1',
      name: 'links',
      nodes: [
        { id: 'a', label: 'A', ports: [{ id: 'a-1', label: 'p' }] },
        { id: 'b', label: 'B', ports: [{ id: 'b-1', label: 'p' }] },
      ],
      terminations: [{ id: 'eps1', label: 'EPS', role: 'eps', position: { x: 1, y: 2 } }],
      links: [
        {
          id: 'l1',
          from: { node: 'a', port: 'a-1', ip: '10.0.0.1/30' },
          to: { node: 'b', port: 'b-1' },
          via: ['eps1'],
          label: 'trunk',
          type: 'ethernet',
        },
        // a link with no id
        { from: { node: 'a', port: 'a-1' }, to: { node: 'b', port: 'b-1' } },
      ],
    } as NetworkGraph)
  })

  test('empty collections ≡ absent; Subgraph.children is derived (not round-tripped)', () => {
    // The input carries empty `ports`/`attachments` and a `children[]`; canon treats
    // empty ≡ absent and drops children, so the round-trip is equal under the contract.
    expectLossless({
      version: '1',
      name: 'edges',
      nodes: [{ id: 'n1', label: 'N', parent: 'sg', ports: [], attachments: [] }],
      links: [],
      subgraphs: [{ id: 'sg', label: 'G', children: ['n1'] }],
    } as NetworkGraph)
  })

  test('subgraphs (nesting + attachments), exclusions, topology-default attachments', () => {
    expectLossless({
      version: '1',
      name: 'groups',
      nodes: [{ id: 'n1', label: 'N', parent: 'sgChild' }],
      links: [],
      subgraphs: [
        { id: 'sgRoot', label: 'Root', direction: 'TB' },
        {
          id: 'sgChild',
          label: 'Child',
          parent: 'sgRoot',
          attachments: [{ kind: 'policy', mode: 'disabled' }],
        },
      ],
      exclusions: [{ mgmtIp: '10.9.9.9' }, { chassisId: 'dead:beef', sysName: 'old' }],
      attachments: [{ kind: 'access', protocol: 'snmp', community: 'topo-default' }],
    } as NetworkGraph)
  })
})
