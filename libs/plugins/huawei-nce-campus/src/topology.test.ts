import { validateTopologyIdentityContract } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { buildTopology, mapDeviceType } from './topology.js'
import type { NceDevice, NceLldpNeighbor, NceNetworkLink } from './types.js'

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

/**
 * The same wire as NEIGHBORS, but from the Link Management list. Both ends
 * carry a port DN distinct from the port name, which is how NCE marks a port
 * it actually holds an entity for.
 */
const NETWORK_LINKS: NceNetworkLink[] = [
  {
    linkname: 'campus-core-01_GigabitEthernet0/0/1_f2-ap-01_GigabitEthernet0/0/0',
    anedn: 'dev-core',
    anename: 'campus-core-01',
    aportname: 'GigabitEthernet0/0/1',
    aportdn: 'be38b832-3a60-3042-8d6f-b36f127f889e',
    znedn: 'dev-ap',
    znename: 'f2-ap-01',
    zportname: 'GigabitEthernet0/0/0',
    zportdn: '7c1de4a9-91b0-4f0e-9a3f-2b6c0d5e1f88',
    linktype: 1,
    speed: '1000',
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
      // NCE spells it `CC:D8:1F:9F:D4:17`; identity keys are canonicalised.
      identity: { chassisId: 'cc:d8:1f:9f:d4:17', sysName: '23296727001065' },
    })
    // Parented into the discovering AP's site: this source emits site regions,
    // so the resolver's closed-scope rule discards a node in none of them.
    expect(sw?.parent).toBe('nce-site:site-1')
    expect(g.links).toHaveLength(1)
    expect(g.links[0]?.to).toEqual({ node: sw?.id, port: 'GE0/0/1' })
  })

  it("prefers the device's own address over the one the controller sees it from", () => {
    // `ip` is where the controller sees the device from — one shared public
    // address for the whole site behind NAT. `manageIp` is the device's own.
    const natted = [
      {
        ...AP,
        id: 'ap-1',
        mac: 'aa:bb:cc:00:00:01',
        ip: '103.26.27.187',
        manageIp: '172.16.253.100',
      },
      {
        ...AP,
        id: 'ap-2',
        mac: 'aa:bb:cc:00:00:02',
        ip: '103.26.27.187',
        manageIp: '172.16.253.101',
      },
    ]
    const g0 = buildTopology(natted, [], new Map())
    expect(
      g0.nodes
        .map((n) => n.identity?.mgmtIp)
        .filter(Boolean)
        .sort(),
    ).toEqual(['172.16.253.100', '172.16.253.101'])
  })

  it('falls back to the Link Management address when manageIp is empty', () => {
    const natted = [
      { ...AP, id: 'ap-1', mac: 'aa:bb:cc:00:00:01', ip: '103.26.27.187', manageIp: '' },
      { ...AP, id: 'ap-2', mac: 'aa:bb:cc:00:00:02', ip: '103.26.27.187', manageIp: '' },
    ]
    const links: NceNetworkLink[] = [
      {
        anedn: 'ap-1',
        aneip: '172.16.253.100',
        aportname: 'MultiGE0/0/0',
        aportdn: 'p1',
        znedn: 'sw',
        znename: 'IS230-10TP-AC(V1)',
        zneip: '0.0.0.0',
        zportname: 'GE0/0/5',
        zportdn: 'z1',
      },
      {
        anedn: 'ap-2',
        aneip: '172.16.253.101',
        aportname: 'MultiGE0/0/0',
        aportdn: 'p2',
        znedn: 'sw',
        znename: 'IS230-10TP-AC(V1)',
        zneip: '0.0.0.0',
        zportname: 'GE0/0/6',
        zportdn: 'z2',
      },
    ]
    const g = buildTopology(natted, links, new Map())
    const ips = g.nodes.filter((n) => n.id.startsWith('nce:')).map((n) => n.identity?.mgmtIp)
    expect(ips.sort()).toEqual(['172.16.253.100', '172.16.253.101'])
  })

  it('drops a management address several devices share', () => {
    // No Link Management rows, so the NATed device-list address is all there
    // is — and it is the same for both. Keying on it would merge them.
    const natted = [
      { ...AP, id: 'ap-1', mac: 'aa:bb:cc:00:00:01', ip: '103.26.27.187' },
      { ...AP, id: 'ap-2', mac: 'aa:bb:cc:00:00:02', ip: '103.26.27.187' },
    ]
    const g = buildTopology(natted, [], new Map())
    for (const n of g.nodes) {
      expect(n.identity?.mgmtIp).toBeUndefined()
      // The MAC still tells them apart, so the contract still holds.
      expect(n.identity?.mac).toBeDefined()
    }
    expect(validateTopologyIdentityContract(g).nodesMissingIdentity).toEqual([])
  })

  it('keeps a management address that only one device claims', () => {
    const g = buildTopology([CORE_SW, AP], [], new Map())
    const sw = g.nodes.find((n) => n.spec?.type === 'l2-switch')
    expect(sw?.identity?.mgmtIp).toBe('10.0.0.2')
  })

  it('gives a Link Management peer the chassis MAC from the reporter LLDP table', () => {
    // Link Management carries no MAC, pins the address to 0.0.0.0, and names
    // the peer by model — on its own that peer can never merge with the same
    // switch seen by a wired source. The AP's LLDP table supplies the key.
    const links: NceNetworkLink[] = [
      {
        anedn: 'dev-ap',
        aportname: 'MultiGE0/0/0',
        aportdn: 'a-port-uuid',
        znedn: 'sw-uuid-1',
        znename: 'IS230-10TP-AC(V1)',
        zneip: '0.0.0.0',
        zportname: 'GE0/0/5',
        zportdn: 'z-port-uuid',
        speed: '1000',
      },
    ]
    const neighbors = new Map<string, NceLldpNeighbor[]>([
      [
        'dev-ap',
        [
          {
            localIfName: 'MultiGE0/0/0',
            remoteIfName: 'GE0/0/5',
            sysName: 'IS230-10TP-AC(V1)',
            remoteMac: 'CC:D8:1F:9F:D4:AB',
          },
        ],
      ],
    ])
    const g = buildTopology([AP], links, neighbors)
    const sw = g.nodes.find((n) => n.id.startsWith('nce-lldp:'))
    expect(sw?.identity).toMatchObject({
      chassisId: 'cc:d8:1f:9f:d4:ab',
      mac: 'cc:d8:1f:9f:d4:ab',
    })
    // 0.0.0.0 is not an address, so it must not become an identity key.
    expect(sw?.identity?.mgmtIp).toBeUndefined()
  })

  it('drops a system name several peers share, keeping a unique one', () => {
    // Huawei reports the *model* as the LLDP system name on this switch family,
    // so keying on it would collapse every switch in the tenant into one entity.
    const peer = (znedn: string, aportname: string): NceNetworkLink => ({
      anedn: 'dev-ap',
      aportname,
      aportdn: `${aportname}-uuid`,
      znedn,
      znename: 'IS230-10TP-AC(V1)',
      zneip: '0.0.0.0',
      zportname: 'GE0/0/5',
      zportdn: `${znedn}-port`,
    })
    const neighbor = (localIfName: string, mac: string): NceLldpNeighbor => ({
      localIfName,
      remoteIfName: 'GE0/0/5',
      sysName: 'IS230-10TP-AC(V1)',
      remoteMac: mac,
    })
    const g = buildTopology(
      [AP],
      [peer('sw-a', 'MultiGE0/0/0'), peer('sw-b', 'MultiGE0/0/1')],
      new Map([
        [
          'dev-ap',
          [
            neighbor('MultiGE0/0/0', 'cc:d8:1f:9f:d4:aa'),
            neighbor('MultiGE0/0/1', 'cc:d8:1f:9f:d4:bb'),
          ],
        ],
      ]),
    )
    const peers = g.nodes.filter((n) => n.id.startsWith('nce-lldp:'))
    expect(peers).toHaveLength(2)
    // The shared string is a model, not a name: it moves out of identity and
    // into `spec.model`, but stays on the label — it is the most legible thing
    // known about a switch NCE has no address for.
    for (const p of peers) {
      expect(p.identity?.sysName).toBeUndefined()
      expect(p.spec?.model).toBe('is230-10tp-ac(v1)')
      expect(p.label).toEqual(['IS230-10TP-AC(V1)'])
    }
    expect(peers.map((p) => p.identity?.mac).sort()).toEqual([
      'cc:d8:1f:9f:d4:aa',
      'cc:d8:1f:9f:d4:bb',
    ])
    // Stripping the shared name must not leave a node with no key at all.
    expect(validateTopologyIdentityContract(g).nodesMissingIdentity).toEqual([])
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

  it('builds links from the Link Management list (preferred path)', () => {
    const g = buildTopology([CORE_SW, AP], NETWORK_LINKS, new Map())
    expect(g.links).toHaveLength(1)
    const link = g.links[0]
    expect(link?.from).toEqual({ node: 'nce:dev-core', port: 'GigabitEthernet0/0/1' })
    expect(link?.to).toEqual({ node: 'nce:dev-ap', port: 'GigabitEthernet0/0/0' })
    // speed is Mbit/s in the NBI.
    expect(link?.speedBps).toBe(1_000 * 1_000_000)
  })

  it('prefers reported links over LLDP when both are available', () => {
    const g = buildTopology([CORE_SW, AP], NETWORK_LINKS, NEIGHBORS)
    // The same wire must not be drawn twice (once per source).
    expect(g.links).toHaveLength(1)
    expect(g.links[0]?.from.port).toBe('GigabitEthernet0/0/1')
  })

  it('emits a peer node for a link whose far end NCE does not manage', () => {
    // The live tenant reports AP uplinks into a `VirtualDevice` placeholder
    // that carries no address; dropping those would drop most of the topology.
    const toUnmanaged: NceNetworkLink[] = [
      {
        anedn: 'dev-ap',
        aportname: 'MultiGE0/0/0',
        aportdn: 'be38b832-3a60-3042-8d6f-b36f127f889e',
        znedn: 'b15a3dd9-bf64-4791-a590-7237349d2030',
        znename: 'VirtualDevice',
        zneip: '0.0.0.0',
        zportname: 'port1.0.5',
        zportdn: 'port1.0.5',
      },
    ]
    const g = buildTopology([AP], toUnmanaged, new Map())
    const peer = g.nodes.find((n) => n.id.startsWith('nce-lldp:'))
    expect(peer).toMatchObject({ label: ['VirtualDevice'], parent: 'nce-site:site-1' })
    // 0.0.0.0 is a placeholder, never a management address.
    expect(peer?.identity?.mgmtIp).toBeUndefined()
    expect(peer?.identity?.vendorIds).toEqual({
      'nce-device-id': 'b15a3dd9-bf64-4791-a590-7237349d2030',
    })
    expect(g.links).toHaveLength(1)
    // The AP's port is a real entity and stays; the placeholder's is not, so
    // the far end gets its own anchor instead of a port other links share.
    expect(g.links[0]?.from.port).toBe('MultiGE0/0/0')
    expect(g.links[0]?.to.port).toBe('uplink:dev-ap')
    expect(peer?.ports).toEqual([{ id: 'uplink:dev-ap', label: '', connectors: [] }])
  })

  it('gives each uplink its own anchor when all claim one phantom port', () => {
    // Verbatim shape of the live OMM site: four APs, one synthetic peer, and
    // the same non-entity `port1.0.5` on every far end. Sharing one endpoint
    // id collapses all four edges onto a single point in the layout.
    const aps = ['ap1', 'ap2', 'ap3', 'ap4'].map((id) => ({ ...AP, id, name: id }))
    const fanIn: NceNetworkLink[] = aps.map((d) => ({
      anedn: d.id,
      aportname: 'MultiGE0/0/0',
      aportdn: `dn-${d.id}`,
      znedn: 'virtual-1',
      znename: 'VirtualDevice',
      zportname: 'port1.0.5',
      zportdn: 'port1.0.5',
    }))
    const g = buildTopology(aps, fanIn, new Map())
    expect(g.links).toHaveLength(4)
    const anchors = g.links.map((l) => l.to.port)
    expect(new Set(anchors).size).toBe(4) // four distinct anchors, no collision
    expect(anchors).toEqual(['uplink:ap1', 'uplink:ap2', 'uplink:ap3', 'uplink:ap4'])
    const peers = g.nodes.filter((n) => n.id.startsWith('nce-lldp:'))
    expect(peers).toHaveLength(1)
    // Declared on the peer so the layout can place them; unnamed because we
    // genuinely don't know the far-end port.
    expect(peers[0]?.ports?.map((p) => p.id)).toEqual(anchors)
    expect(peers[0]?.ports?.every((p) => p.label === '')).toBe(true)
  })

  it('reuses one anchor per reporting device across re-syncs', () => {
    // Anchor ids must be derived from stable input, not generated, or every
    // sync churns the port entities behind metrics bindings.
    const link: NceNetworkLink[] = [
      {
        anedn: 'dev-ap',
        aportname: 'MultiGE0/0/0',
        aportdn: 'dn-a',
        znedn: 'virtual-1',
        znename: 'VirtualDevice',
        zportname: 'port1.0.5',
        zportdn: 'port1.0.5',
      },
    ]
    const first = buildTopology([AP], link, new Map())
    const second = buildTopology([AP], link, new Map())
    expect(first.links[0]?.to.port).toBe(second.links[0]?.to.port)
    expect(first.links[0]?.id).toBe(second.links[0]?.id)
  })

  it('drops a link whose reporting end is not a managed device', () => {
    const orphan: NceNetworkLink[] = [
      { anedn: 'not-managed', aportname: 'GE0/0/24', znedn: 'dev-core', zportname: 'GE0/0/1' },
    ]
    const g = buildTopology([CORE_SW, AP], orphan, new Map())
    expect(g.links).toHaveLength(0)
  })

  it('collapses duplicate link records for the same wire', () => {
    const dup = [...NETWORK_LINKS, { ...NETWORK_LINKS[0] }] as NceNetworkLink[]
    const g = buildTopology([CORE_SW, AP], dup, new Map())
    expect(g.links).toHaveLength(1)
  })

  it('satisfies the topology identity contract on the reported-link path', () => {
    const g = buildTopology([CORE_SW, AP], NETWORK_LINKS, new Map())
    const result = validateTopologyIdentityContract(g)
    expect(result.nodesMissingIdentity).toEqual([])
    expect(result.portsMissingIfName).toEqual([])
  })
})
