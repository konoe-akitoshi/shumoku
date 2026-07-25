import { validateTopologyIdentityContract } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { buildTopology, mapDeviceType } from './topology.js'
import type { NceDevice, NceLldpNeighbor } from './types.js'

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

describe('buildTopology', () => {
  it('emits device nodes with identity and a site subgraph', () => {
    const g = buildTopology([CORE_SW, AP], new Map())
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
    const g = buildTopology([CORE_SW, AP], NEIGHBORS)
    expect(g.links).toHaveLength(1)
    const link = g.links[0]
    const ports = [link?.from.port, link?.to.port].sort()
    expect(ports).toEqual(['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1'])
    const ends = [link?.from.node, link?.to.node].sort()
    expect(ends).toEqual(['nce:dev-ap', 'nce:dev-core'])
  })

  it('matches peers by MAC case-insensitively even when sysName differs', () => {
    const renamed = { ...AP, name: 'operator renamed this' }
    const g = buildTopology([CORE_SW, renamed], NEIGHBORS)
    // dev-core's neighbor entry still finds the AP via remoteMac.
    expect(g.links).toHaveLength(1)
  })

  it('drops neighbors outside the managed inventory', () => {
    const foreign = new Map<string, NceLldpNeighbor[]>([
      [
        'dev-core',
        [{ localIfName: 'GE0/0/24', sysName: 'isp-router', remoteMac: 'de:ad:be:ef:00:01' }],
      ],
    ])
    const g = buildTopology([CORE_SW], foreign)
    expect(g.links).toHaveLength(0)
    expect(g.nodes).toHaveLength(1)
  })

  it('satisfies the topology identity contract', () => {
    const g = buildTopology([CORE_SW, AP], NEIGHBORS)
    const result = validateTopologyIdentityContract(g)
    expect(result.nodesMissingIdentity).toEqual([])
    expect(result.portsMissingIfName).toEqual([])
  })
})
