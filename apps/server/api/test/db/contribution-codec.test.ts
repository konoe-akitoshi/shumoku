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
    // Ports carry a port-identity key so the round-trip stays strictly lossless
    // (an identity-less port would gain `identity.ifName = <id>` on ingest — that
    // enrichment path is covered by the dedicated tests below).
    expectLossless({
      version: '1',
      name: 'links',
      nodes: [
        { id: 'a', label: 'A', ports: [{ id: 'a-1', label: 'p', identity: { ifName: 'a-1' } }] },
        { id: 'b', label: 'B', ports: [{ id: 'b-1', label: 'p', identity: { ifName: 'b-1' } }] },
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

  test('ingest tolerates undeclared/empty ports and dangling-node links', () => {
    // A source (e.g. TTDB) may emit links that reference ports the node never
    // enumerated, empty-string ports, or a node that doesn't exist. resolve()
    // tolerates all three; ingest must too (not abort the whole source on a FK).
    const out = roundTrip({
      version: '1',
      name: 'robust',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ], // no ports declared
      links: [
        { from: { node: 'a', port: 'ge-0/0/1' }, to: { node: 'b', port: '' } },
        { from: { node: 'a' }, to: { node: 'ghost' } }, // dangling → dropped
      ],
    } as NetworkGraph)
    // dangling-node link dropped
    expect(out.links).toHaveLength(1)
    // undeclared port synthesized as a stub on 'a'; empty port ≡ no port on 'b'
    expect(out.links[0]?.from.port).toBe('ge-0/0/1')
    expect(out.links[0]?.to.port).toBeUndefined()
    const stub = out.nodes.find((n) => n.id === 'a')?.ports?.find((p) => p.id === 'ge-0/0/1')
    expect(stub).toBeDefined()
    // The stub carries no source identity, so its id (an interface name) is
    // stamped as ifName — a metrics binding needs this to anchor (issue #548).
    expect(stub?.identity?.ifName).toBe('ge-0/0/1')
  })

  test('identity-less ports gain ifName=<id>; ports with a port key keep it (no dup)', () => {
    const out = roundTrip({
      version: '1',
      name: 'port-identity-stamp',
      nodes: [
        // Plugin-enumerated port with NO identity → stamped with ifName=<id>.
        { id: 'a', label: 'A', ports: [{ id: 'ge-0/0/1', label: 'p' }] },
        // Port already carrying ifName (e.g. Zabbix) → untouched, no duplication.
        {
          id: 'b',
          label: 'B',
          ports: [{ id: 'p2', label: 'p', identity: { ifName: 'Gi0/2', ifIndex: 3 } }],
        },
        // Port carrying only a mac (a port key, but no ifName) → NOT stamped.
        {
          id: 'c',
          label: 'C',
          ports: [{ id: 'p3', label: 'p', identity: { mac: '00:11:22:33:44:55' } }],
        },
      ],
      links: [],
    } as NetworkGraph)
    const portOf = (nodeId: string) => out.nodes.find((n) => n.id === nodeId)?.ports?.[0]
    // (a) identity-less enumerated port → ifName defaulted to its id.
    expect(portOf('a')?.identity?.ifName).toBe('ge-0/0/1')
    // (b) existing port identity preserved exactly (plugin identity takes precedence).
    expect(portOf('b')?.identity).toEqual({ ifName: 'Gi0/2', ifIndex: 3 })
    // (c) a port with a non-ifName port key is not given a spurious ifName.
    expect(portOf('c')?.identity).toEqual({ mac: '00:11:22:33:44:55' })
  })

  test('node-scoped duplicate port ids round-trip (two nodes both have "eth0")', () => {
    expectLossless({
      version: '1',
      name: 'dup-ports',
      nodes: [
        {
          id: 'sw-a',
          label: 'A',
          ports: [{ id: 'eth0', label: 'eth0', identity: { ifName: 'eth0' } }],
        },
        {
          id: 'sw-b',
          label: 'B',
          ports: [{ id: 'eth0', label: 'eth0', identity: { ifName: 'eth0' } }],
        },
      ],
      links: [
        { id: 'l', from: { node: 'sw-a', port: 'eth0' }, to: { node: 'sw-b', port: 'eth0' } },
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

  test('region subgraph identity + membership round-trip (via payload)', () => {
    expectLossless({
      version: '1',
      name: 'regions',
      nodes: [{ id: 'n1', label: 'N', parent: 'dc' }],
      links: [],
      subgraphs: [
        {
          id: 'dc',
          label: 'DC',
          identity: { name: 'backbone', keys: { 'zabbix-hostgroup': '98' } },
          membership: [
            { attr: 'subnet', value: '10.0.0.0/24' },
            { attr: 'metadata', key: 'site', value: 'tokyo' },
          ],
        },
      ],
    } as NetworkGraph)
  })

  test('presence anchor round-trips (NULL column); scoop default is absent', () => {
    expectLossless({
      version: '1',
      name: 'presence',
      nodes: [
        // anchor: binding-only node, no presence claim. Round-trips via NULL column.
        {
          id: 'a1',
          label: '',
          presence: 'anchor',
          identity: { mgmtIp: '10.0.0.1' },
          attachments: [{ kind: 'metrics-binding', sourceId: 'zbx', hostId: '7' }],
        },
        // scoop is the default → stored as 'present', rebuilt WITHOUT a presence
        // field (canon: a node that never carried `presence` stays that way).
        { id: 'n2', label: 'N2', identity: { mgmtIp: '10.0.0.2' } },
      ],
      links: [],
    } as NetworkGraph)
  })
})
