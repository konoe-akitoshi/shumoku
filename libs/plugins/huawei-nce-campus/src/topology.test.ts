import { validateTopologyIdentityContract } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { buildTopology, mapDeviceType } from './topology.js'
import type { NceDevice, NceLldpNeighbor, NceTopoLink } from './types.js'

const CORE_SW: NceDevice = {
  id: 'dev-core',
  name: 'campus-core-01',
  esn: '2102351234567890',
  deviceModel: 'S5735-L24T4S-A1',
  neType: 'S5735-L24T4S-A1',
  deviceType: 'LSW',
  status: '0',
  siteId: 'site-1',
  siteName: 'HQ',
  mac: '00:11:22:33:44:55',
  ip: '10.0.0.2',
}

const AP: NceDevice = {
  id: 'dev-ap',
  name: 'f2-ap-01',
  esn: '2102351234567891',
  deviceType: 'AP',
  status: '0',
  siteId: 'site-1',
  siteName: 'HQ',
  mac: '66:77:88:99:aa:bb',
  ip: '10.0.0.30',
}

/** LLDP as seen from both ends of the same wire. */
const NEIGHBORS = new Map<string, NceLldpNeighbor[]>([
  [
    'dev-core',
    [
      {
        localIfName: 'GigabitEthernet0/0/1',
        remoteIfName: 'GigabitEthernet0/0/0',
        sysName: 'f2-ap-01',
        remoteMac: '66:77:88:99:AA:BB',
      },
    ],
  ],
  [
    'dev-ap',
    [
      {
        localIfName: 'GigabitEthernet0/0/0',
        remoteIfName: 'GigabitEthernet0/0/1',
        sysName: 'campus-core-01',
        remoteMac: '00:11:22:33:44:55',
      },
    ],
  ],
])

describe('mapDeviceType', () => {
  it('maps NCE device classes to core device types', () => {
    expect(mapDeviceType('AP')).toBe('access-point')
    expect(mapDeviceType('AR')).toBe('router')
    expect(mapDeviceType('FW')).toBe('firewall')
    expect(mapDeviceType('LSW')).toBe('l2-switch')
    expect(mapDeviceType(undefined)).toBe('l2-switch')
  })
})

/** The same wire as NEIGHBORS, but from the controller's topology linkData. */
const TOPO_LINKS: NceTopoLink[] = [
  {
    label: 'campus-core-01_GigabitEthernet0/0/1_f2-ap-01_GigabitEthernet0/0/0',
    leftFdn: 'dev-core',
    rightFdn: 'dev-ap',
    aPortName: 'GigabitEthernet0/0/1',
    zPortName: 'GigabitEthernet0/0/0',
    linkStatus: 0,
  },
]

describe('buildTopology', () => {
  it('emits device nodes with identity and a site subgraph', () => {
    const g = buildTopology([CORE_SW, AP], [], new Map())
    expect(g.nodes).toHaveLength(2)
    const sw = g.nodes.find((n) => n.spec?.type === 'l2-switch')
    expect(sw?.identity).toMatchObject({
      mgmtIp: '10.0.0.2',
      mac: '00:11:22:33:44:55',
      vendorIds: { 'nce-device-id': 'dev-core', 'nce-esn': '2102351234567890' },
    })
    expect(sw?.parent).toBe('nce-site:site-1')
    expect(g.subgraphs).toEqual([{ id: 'nce-site:site-1', label: 'HQ', identity: { name: 'HQ' } }])
  })

  it('collapses the bidirectional LLDP pair into one link with both ports', () => {
    const g = buildTopology([CORE_SW, AP], [], NEIGHBORS)
    expect(g.links).toHaveLength(1)
    const link = g.links[0]
    const ports = [link?.from.port, link?.to.port].sort()
    expect(ports).toEqual(['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1'])
    const ends = [link?.from.node, link?.to.node].sort()
    expect(ends).toEqual(['nce:dev-ap', 'nce:dev-core'])
  })

  it('matches peers by MAC case-insensitively even when sysName differs', () => {
    const renamed = { ...AP, name: 'operator renamed this' }
    const g = buildTopology([CORE_SW, renamed], [], NEIGHBORS)
    // dev-core's neighbor entry still finds the AP via remoteMac.
    expect(g.links).toHaveLength(1)
  })

  it('emits a node for an LLDP neighbor NCE does not manage', () => {
    // A WLAN-only tenant manages APs but not the switch they uplink into; that
    // AP↔switch edge is exactly what this source contributes.
    const foreign = new Map<string, NceLldpNeighbor[]>([
      [
        'dev-ap',
        [
          {
            localIfName: 'MultiGE0/0/0',
            remoteIfName: 'GE0/0/1',
            sysName: '23296727001065',
            sysDescription: 'Switch',
            remoteMac: 'CC:D8:1F:9F:D4:17',
          },
        ],
      ],
    ])
    const g = buildTopology([AP], [], foreign)
    const sw = g.nodes.find((n) => n.id.startsWith('nce-lldp:'))
    expect(sw).toMatchObject({
      label: ['23296727001065'],
      spec: { type: 'l2-switch' },
      identity: { chassisId: 'CC:D8:1F:9F:D4:17', sysName: '23296727001065' },
    })
    // Parented into the discovering AP's site: this source emits site regions,
    // so the resolver's closed-scope rule discards a node in none of them.
    expect(sw?.parent).toBe('nce-site:site-1')
    expect(g.links).toHaveLength(1)
    expect(g.links[0]?.to).toEqual({ node: sw?.id, port: 'GE0/0/1' })
  })

  it('collapses several APs uplinking into the same unmanaged switch', () => {
    const shared = (mac: string, port: string): NceLldpNeighbor => ({
      localIfName: 'MultiGE0/0/0',
      remoteIfName: port,
      sysName: 'sw-1',
      remoteMac: mac,
    })
    const g = buildTopology(
      [AP, { ...CORE_SW, id: 'dev-ap2', deviceType: 'AP', mac: 'aa:bb:cc:dd:ee:ff' }],
      [],
      new Map([
        ['dev-ap', [shared('CC:D8:1F:9F:D4:17', 'GE0/0/1')]],
        ['dev-ap2', [shared('cc-d8-1f-9f-d4-17', 'GE0/0/2')]],
      ]),
    )
    // One switch node (matched across the two MAC spellings), two links.
    expect(g.nodes.filter((n) => n.id.startsWith('nce-lldp:'))).toHaveLength(1)
    expect(g.links).toHaveLength(2)
  })

  it('matches a managed peer despite NCE mixing MAC separators', () => {
    // The device list returns 50-04-01-02-14-80; LLDP returns 50:04:01:02:14:80.
    const ap = { ...AP, mac: '50-04-01-02-14-80' }
    const neighbors = new Map<string, NceLldpNeighbor[]>([
      [
        'dev-core',
        [
          {
            localIfName: 'GigabitEthernet0/0/1',
            remoteIfName: 'MultiGE0/0/0',
            remoteMac: '50:04:01:02:14:80',
          },
        ],
      ],
    ])
    const g = buildTopology([CORE_SW, ap], [], neighbors)
    expect(g.nodes.filter((n) => n.id.startsWith('nce-lldp:'))).toHaveLength(0)
    expect(g.links[0]?.to.node).toBe('nce:dev-ap')
  })

  it('matches a managed peer when LLDP reports its ESN as the system name', () => {
    const neighbors = new Map<string, NceLldpNeighbor[]>([
      [
        'dev-core',
        [{ localIfName: 'GigabitEthernet0/0/1', remoteIfName: 'GE0/0/0', sysName: AP.esn }],
      ],
    ])
    const g = buildTopology([CORE_SW, AP], [], neighbors)
    expect(g.nodes.filter((n) => n.id.startsWith('nce-lldp:'))).toHaveLength(0)
    expect(g.links[0]?.to.node).toBe('nce:dev-ap')
  })

  it('drops a neighbor carrying no identifying key at all', () => {
    const anon = new Map<string, NceLldpNeighbor[]>([['dev-ap', [{ localIfName: 'GE0/0/1' }]]])
    const g = buildTopology([AP], [], anon)
    expect(g.links).toHaveLength(0)
    expect(g.nodes).toHaveLength(1)
  })

  it('satisfies the topology identity contract', () => {
    const g = buildTopology([CORE_SW, AP], [], NEIGHBORS)
    const result = validateTopologyIdentityContract(g)
    expect(result.nodesMissingIdentity).toEqual([])
    expect(result.portsMissingIfName).toEqual([])
  })

  it('builds links from the controller topology linkData (preferred path)', () => {
    const g = buildTopology([CORE_SW, AP], TOPO_LINKS, new Map())
    expect(g.links).toHaveLength(1)
    const link = g.links[0]
    expect(link?.from).toEqual({ node: 'nce:dev-core', port: 'GigabitEthernet0/0/1' })
    expect(link?.to).toEqual({ node: 'nce:dev-ap', port: 'GigabitEthernet0/0/0' })
  })

  it('prefers topo links over LLDP when both are supplied', () => {
    const g = buildTopology([CORE_SW, AP], TOPO_LINKS, NEIGHBORS)
    // The same wire must not be drawn twice (once per source).
    expect(g.links).toHaveLength(1)
    expect(g.links[0]?.from.port).toBe('GigabitEthernet0/0/1')
  })

  it('drops topo links whose ends are not both managed devices', () => {
    const siteLink: NceTopoLink[] = [
      { leftFdn: 'dev-core', rightFdn: 'site-1', aPortName: 'GE0/0/24', zPortName: '' },
    ]
    const g = buildTopology([CORE_SW, AP], siteLink, new Map())
    expect(g.links).toHaveLength(0)
  })

  it('collapses duplicate topo link records for the same wire', () => {
    const dup = [...TOPO_LINKS, { ...TOPO_LINKS[0] }] as NceTopoLink[]
    const g = buildTopology([CORE_SW, AP], dup, new Map())
    expect(g.links).toHaveLength(1)
  })

  it('satisfies the topology identity contract on the topo-link path', () => {
    const g = buildTopology([CORE_SW, AP], TOPO_LINKS, new Map())
    const result = validateTopologyIdentityContract(g)
    expect(result.nodesMissingIdentity).toEqual([])
    expect(result.portsMissingIfName).toEqual([])
  })
})
