// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Golden round-trip test for the contribution-store codec:
 * `buildNetwork(ingestNetwork(x)) ≡ x` for a `SourceNetwork` under normalized equality.
 * See the equivalences at the top of src/db/contribution-codec.ts and
 * apps/server/docs/design/db-native-persistence.md § Round-trip codec.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SourceNetwork } from '@shumoku/core'
import { buildNetwork, ingestNetwork } from '../../src/services/contribution-store.ts'
import { getDatabase, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
beforeAll(() => {
  db_ = setupTempDb()
  // metrics-binding.target_source_id FKs data_sources — seed the source the fixtures bind to.
  insertDataSource('zabbix', 'zbx')
})
afterAll(() => db_.teardown())

/**
 * Normalize for the round-trip contract: sort object keys (key order is irrelevant), keep array
 * order, treat **empty collection ≡ absent**, and drop the derived `provenance` (stamped by
 * resolve, never stored) — the documented codec equivalences.
 */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      if (k === 'provenance') continue
      const cv = canon((v as Record<string, unknown>)[k])
      if (Array.isArray(cv) && cv.length === 0) continue // empty ≡ absent
      if (cv && typeof cv === 'object' && !Array.isArray(cv) && Object.keys(cv).length === 0)
        continue
      out[k] = cv
    }
    return out
  }
  return v
}

let seq = 0
function roundTrip(source: SourceNetwork): SourceNetwork {
  const id = `t_rt_${seq++}`
  getDatabase()
    .query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run(id, id)
  ingestNetwork(id, 'c', source)
  const out = buildNetwork(id, 'c')
  if (!out) throw new Error('buildNetwork returned null')
  return out
}

const expectLossless = (s: SourceNetwork) => expect(canon(roundTrip(s))).toEqual(canon(s))

describe('contribution codec — round-trip', () => {
  test('minimal network', () => {
    expectLossless({ network: { name: 'min', nodes: [], links: [] } })
  })

  test('nodes with config fields, observation identity/attachments/suppressions/metadata', () => {
    expectLossless({
      network: {
        name: 'rich',
        description: 'desc',
        nodes: [
          {
            id: 'sw1',
            label: 'Switch 1',
            type: 'switch',
            product: 'cisco/c9300',
            productId: 'prod-1',
            software: 'ios-xe',
            address: '10.0.0.1',
            asn: 65001,
            description: 'core',
            assumed: true,
          },
          { id: 'vm1', type: 'virtual-machine', platform: 'esxi', host: 'sw1' },
          { id: 'svc1', product: 'aws', service: 'lambda', resource: 'function' },
          { id: 'host1', host: 'sw1', members: ['u1', 'u2'] },
        ],
        links: [],
      },
      observation: {
        nodes: {
          sw1: {
            identity: {
              mgmtIp: '10.0.0.1',
              chassisId: 'aa:bb',
              sysName: 'sw1',
              vendorIds: { 'netbox-device-id': '42' },
            },
            attachments: [
              { kind: 'access', protocol: 'snmp', community: 'public', version: '2c' },
              { kind: 'policy', mode: 'auto', intervalMs: 60000 },
            ],
            suppressedAttachments: ['access:ssh'],
            metadata: { rack: '3', hostId: 'h-1' },
          },
          host1: {
            identity: { mgmtIp: '10.0.0.2' },
            attachments: [
              { kind: 'metrics-binding', sourceId: 'zbx', hostId: 'h-1', hostName: 'host1' },
            ],
          },
        },
      },
      drawing: {
        nodes: {
          sw1: {
            shape: 'rect',
            style: { fill: '#eee', strokeWidth: 2 },
            icon: 'https://example.com/sw.svg',
          },
        },
      },
    } as SourceNetwork)
  })

  test('ports written on the node and seen in the observation', () => {
    // Every port carries a port-identity key so the round-trip stays strictly lossless (an
    // identity-less port gains `identity.ifName` — covered by the dedicated test below).
    expectLossless({
      network: {
        nodes: [
          {
            id: 'sw1',
            ports: [
              {
                name: 'Gi1/0/1',
                interfaceName: 'GigabitEthernet1/0/1',
                role: 'uplink',
                speed: '1g',
                connectors: ['rj45'],
                poe: true,
                notes: 'to core',
              },
              { name: 'Gi1/0/3', label: 'Gi 3' },
            ],
          },
        ],
        links: [],
      },
      observation: {
        nodes: {
          sw1: {
            ports: {
              'Gi1/0/1': {
                identity: { ifName: 'Gi1/0/1', ifIndex: 10001 },
                attachments: [
                  {
                    kind: 'metrics-binding',
                    sourceId: 'zbx',
                    interfaceName: 'Gi1/0/1',
                    bandwidth: 1000000000,
                  },
                ],
                suppressedAttachments: ['access:snmp'],
              },
              'Gi1/0/2': { identity: { mac: '00:11:22:33:44:55' } },
              'Gi1/0/3': { identity: { ifName: 'Gi1/0/3' } },
            },
          },
        },
      },
    } as SourceNetwork)
  })

  test('groups nested, with observation and drawing', () => {
    expectLossless({
      network: {
        nodes: [
          { id: 'n1', group: 'child' },
          { id: 'n2', group: 'root' },
        ],
        links: [],
        groups: [
          { id: 'root', label: 'Root', groups: [{ id: 'child', label: 'Child' }] },
          { id: 'other', label: 'Other' },
        ],
      },
      observation: {
        groups: {
          child: { attachments: [{ kind: 'policy', mode: 'disabled' }] },
          root: {
            identity: { name: 'backbone', keys: { 'zabbix-hostgroup': '98' } },
          },
        },
      },
      drawing: {
        groups: {
          root: { style: { fill: '#fafafa' } },
          child: { spec: { kind: 'hardware', type: 'switch' } },
        },
      },
    } as SourceNetwork)
  })

  test('links between nodes with plugs, cable, via, observation and drawing', () => {
    expectLossless({
      network: {
        nodes: [{ id: 'a' }, { id: 'b' }],
        links: [
          {
            id: 'l1',
            endpoints: [
              { node: 'a', port: 'a-1', plug: { cage: 'lc', module: { standard: '10GBASE-SR' } } },
              { node: 'b', port: 'b-1' },
            ],
            speed: '10G',
            bandwidth: '1G',
            cable: { type: 'om4', productId: 'cab-1' },
            length: '3m',
            via: ['eps1', 'out1'],
            description: 'trunk',
            connection: 'c1',
            segments: ['vlan10'],
            virtual: true,
          },
          // a link with no id carries no layers
          { endpoints: [{ node: 'a', port: 'a-2' }, { node: 'b' }], cable: 'cat6' },
        ],
        segments: [{ id: 'vlan10', vlan: 10 }],
        connections: [{ id: 'c1', label: 'VPN' }],
        terminations: [
          { id: 'eps1', label: 'EPS', role: 'eps' },
          { id: 'out1', role: 'outlet', autoFor: 'l1:eps1' },
        ],
      },
      observation: {
        nodes: {
          a: {
            ports: {
              'a-1': { identity: { ifName: 'a-1' } },
              'a-2': { identity: { ifName: 'a-2' } },
            },
          },
          b: { ports: { 'b-1': { identity: { ifName: 'b-1' } } } },
        },
        links: { l1: { presence: 'anchor', metadata: { found: 'lldp' } } },
      },
      drawing: { links: { l1: { label: 'trunk', type: 'dashed' } } },
    } as SourceNetwork)
  })

  test('a link to a segment stays in the document with its layers', () => {
    expectLossless({
      network: {
        nodes: [{ id: 'a' }],
        links: [{ id: 'l-seg', endpoints: [{ node: 'a' }, { segment: 'vlan10' }], speed: '1G' }],
        segments: [
          {
            id: 'vlan10',
            label: 'Users',
            vlan: 10,
            prefix: ['10.0.10.0/24'],
            routingDomain: 'vpc',
            addresses: { a: '10.0.10.2' },
          },
        ],
        routingDomains: [{ id: 'vpc', label: 'VPC', prefix: '10.0.0.0/16' }],
      },
      observation: { links: { 'l-seg': { metadata: { src: 'x' } } } },
      drawing: { links: { 'l-seg': { label: 'users' } } },
    } as SourceNetwork)
  })

  test('segments, routing domains, connections and redundancy sets', () => {
    expectLossless({
      network: {
        name: 'doc',
        nodes: [{ id: 'a' }, { id: 'b' }],
        links: [{ endpoints: [{ node: 'a' }, { routingDomain: 'vrf1' }] }],
        routingDomains: [{ id: 'vrf1', label: 'VRF 1' }],
        connections: [{ id: 'vpn', label: 'VPN' }],
        segments: [{ id: 's1', vlan: 20, addresses: { pair: '10.0.0.1' } }],
        redundancy: [{ id: 'pair', label: 'VRRP', nodes: ['a', 'b'], assumed: true }],
      },
    })
  })

  test('exclusions, topology-default attachments and settings', () => {
    expectLossless({
      network: { nodes: [], links: [] },
      observation: {
        exclusions: [{ mgmtIp: '10.9.9.9' }, { chassisId: 'dead:beef', sysName: 'old' }],
        attachments: [{ kind: 'access', protocol: 'snmp', community: 'topo-default' }],
      },
      drawing: { settings: { theme: 'dark', direction: 'LR' }, order: { '': ['b', 'a'] } },
    } as SourceNetwork)
  })

  test('presence anchor round-trips (NULL column); scoop default is absent', () => {
    expectLossless({
      network: { nodes: [{ id: 'a1' }, { id: 'n2', label: 'N2' }], links: [] },
      observation: {
        nodes: {
          // anchor: binding-only node, no presence claim.
          a1: {
            presence: 'anchor',
            identity: { mgmtIp: '10.0.0.1' },
            attachments: [{ kind: 'metrics-binding', sourceId: 'zbx', hostId: '7' }],
          },
          // scoop is the default → rebuilt WITHOUT a presence field.
          n2: { identity: { mgmtIp: '10.0.0.2' } },
        },
      },
    } as SourceNetwork)
  })

  test('node-scoped duplicate port names round-trip (two nodes both have "eth0")', () => {
    expectLossless({
      network: {
        nodes: [{ id: 'sw-a' }, { id: 'sw-b' }],
        links: [
          {
            id: 'l',
            endpoints: [
              { node: 'sw-a', port: 'eth0' },
              { node: 'sw-b', port: 'eth0' },
            ],
          },
        ],
      },
      observation: {
        nodes: {
          'sw-a': { ports: { eth0: { identity: { ifName: 'eth0' } } } },
          'sw-b': { ports: { eth0: { identity: { ifName: 'eth0' } } } },
        },
      },
    })
  })

  test('empty collections ≡ absent', () => {
    const out = roundTrip({
      network: {
        nodes: [{ id: 'n1', group: 'sg' }],
        links: [],
        groups: [{ id: 'sg', label: 'G', groups: [] }],
        segments: [],
      },
      observation: { nodes: { n1: { attachments: [], ports: {} } }, exclusions: [] },
    })
    expect(canon(out)).toEqual(
      canon({
        network: {
          nodes: [{ id: 'n1', group: 'sg' }],
          links: [],
          groups: [{ id: 'sg', label: 'G' }],
        },
      }),
    )
  })

  test('provenance is derived, not stored', () => {
    const out = roundTrip({
      network: {
        nodes: [{ id: 'n1' }],
        links: [{ id: 'l', endpoints: [{ node: 'n1' }, { node: 'n1' }] }],
      },
      observation: {
        nodes: {
          n1: {
            identity: { sysName: 'n1' },
            provenance: { source: 's', observedAt: 1 },
          },
        },
        links: { l: { provenance: { source: 's', observedAt: 1 } } },
      },
    } as SourceNetwork)
    expect(out.observation?.nodes?.['n1']?.identity).toEqual({ sysName: 'n1' })
    expect(JSON.stringify(out)).not.toContain('provenance')
  })
})

describe('contribution codec — port identity', () => {
  test('identity-less ports gain ifName=<name>; ports with a port key keep it (no dup)', () => {
    const out = roundTrip({
      network: { nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], links: [] },
      observation: {
        nodes: {
          // Port with NO identity → stamped with ifName=<name>.
          a: { ports: { 'ge-0/0/1': {} } },
          // Port already carrying ifName (e.g. Zabbix) → untouched, no duplication.
          b: { ports: { p2: { identity: { ifName: 'Gi0/2', ifIndex: 3 } } } },
          // Port carrying only a mac (a port key, but no ifName) → NOT stamped.
          c: { ports: { p3: { identity: { mac: '00:11:22:33:44:55' } } } },
        },
      },
    })
    const portOf = (id: string, name: string) => out.observation?.nodes?.[id]?.ports?.[name]
    expect(portOf('a', 'ge-0/0/1')?.identity?.ifName).toBe('ge-0/0/1')
    expect(portOf('b', 'p2')?.identity).toEqual({ ifName: 'Gi0/2', ifIndex: 3 })
    expect(portOf('c', 'p3')?.identity).toEqual({ mac: '00:11:22:33:44:55' })
  })

  test('a port only the configuration describes is stored, with ifName stamped', () => {
    const out = roundTrip({
      network: { nodes: [{ id: 'a', ports: [{ name: 'eth0', speed: '1G' }] }], links: [] },
    })
    expect(out.network.nodes[0]?.ports).toEqual([{ name: 'eth0', speed: '1G' }])
    expect(out.observation?.nodes?.['a']?.ports?.['eth0']?.identity?.ifName).toBe('eth0')
  })

  test('ingest tolerates undeclared ports and dangling-node links', () => {
    // A source (e.g. TTDB) may emit links that reference ports no layer enumerated, or a node
    // that doesn't exist. resolve() tolerates both; ingest must too (not abort on a FK).
    const out = roundTrip({
      network: {
        nodes: [{ id: 'a' }, { id: 'b' }], // no ports declared
        links: [
          { endpoints: [{ node: 'a', port: 'ge-0/0/1' }, { node: 'b' }] },
          { endpoints: [{ node: 'a' }, { node: 'ghost' }] }, // dangling: kept in the document
        ],
      },
    })
    const toStub = out.network.links.find(
      (l) => 'node' in l.endpoints[0] && l.endpoints[0].port === 'ge-0/0/1',
    )
    expect(toStub?.endpoints[1]).toEqual({ node: 'b' })
    // The undeclared port is stored as an empty port carrying its name as ifName — a metrics
    // binding needs this to anchor (issue #548).
    expect(out.observation?.nodes?.['a']?.ports?.['ge-0/0/1']?.identity?.ifName).toBe('ge-0/0/1')
  })
})
