import { validateTopologyIdentityContract } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { buildTopology } from './topology.js'
import type { CvManagedDevice, CvSwitch } from './types.js'

const AP: CvManagedDevice = {
  boxId: 4,
  name: 'j58-2f-pub-ap-02',
  macaddress: '30:86:2D:83:BE:BF',
  model: 'C-250',
  vendorName: 'Arista',
  ipAddress: '192.168.11.53',
  active: true,
  uplinkWiredInterfacesInfo: {
    sensorLanPortName: 'LAN1',
    sensorLinkSpeed: 10000,
    lan1Data: {
      name: 'eth0',
      primaryInterface: true,
      linkStatus: 1,
      linkSpeed: 10000,
      switchName: 'j58-test-AP-PoESW-01',
      switchPortId: 'Ethernet13',
      switchChassisId: 'e0:fa:5b:71:ff:75',
      switchVendor: 'AristaNe',
    },
  },
}

const SWITCH: CvSwitch = {
  name: 'j58-test-AP-PoESW-01',
  vendor: 'AristaNe',
  chassisId: 'e0:fa:5b:71:ff:75',
  numAps: 48,
}

describe('buildTopology', () => {
  it('emits AP + switch nodes and the AP↔switch link', () => {
    const g = buildTopology([AP], [SWITCH])
    expect(g.nodes).toHaveLength(2)
    const ap = g.nodes.find((n) => n.spec?.type === 'access-point')
    const sw = g.nodes.find((n) => n.spec?.type === 'l2-switch')
    expect(ap?.identity).toMatchObject({ mgmtIp: '192.168.11.53', mac: '30:86:2D:83:BE:BF' })
    expect(sw?.identity).toMatchObject({
      chassisId: 'e0:fa:5b:71:ff:75',
      sysName: 'j58-test-AP-PoESW-01',
    })
    expect(g.links).toHaveLength(1)
    const link = g.links[0]
    expect(link?.from.node).toBe(ap?.id)
    expect(link?.from.port).toBe('eth0')
    expect(link?.to.node).toBe(sw?.id)
    expect(link?.to.port).toBe('Ethernet13')
    expect(link?.rateBps).toBe(10_000 * 1_000_000)
  })

  it('does not duplicate a switch seeded by /switches and referenced by an uplink', () => {
    const g = buildTopology([AP], [SWITCH])
    const switches = g.nodes.filter((n) => n.spec?.type === 'l2-switch')
    expect(switches).toHaveLength(1)
  })

  it('satisfies the topology identity contract', () => {
    const g = buildTopology([AP], [SWITCH])
    const result = validateTopologyIdentityContract(g)
    expect(result.nodesMissingIdentity).toEqual([])
    expect(result.portsMissingIfName).toEqual([])
  })

  it('drops the uplink link (but keeps the node) for an inactive AP — stale LLDP', () => {
    const stale = { ...AP, active: false }
    const g = buildTopology([stale], [SWITCH])
    expect(g.nodes.filter((n) => n.spec?.type === 'access-point')).toHaveLength(1)
    expect(g.links).toHaveLength(0)
  })

  it('groups APs into nested location subgraphs (switches stay unparented)', () => {
    const ap = { ...AP, locationId: { type: 'locallocationid', id: 57 } }
    const locations = {
      id: 0,
      name: 'root',
      children: [{ id: 32, name: 'kenbun', children: [{ id: 57, name: '1F' }] }],
    }
    const g = buildTopology([ap], [SWITCH], locations)
    const apNode = g.nodes.find((n) => n.spec?.type === 'access-point')
    const swNode = g.nodes.find((n) => n.spec?.type === 'l2-switch')
    // AP parented into its floor; switch left unparented so it merges by identity.
    expect(apNode?.parent).toBe('cvcue-loc:57')
    expect(swNode?.parent).toBeUndefined()
    // The floor subgraph is nested under the building, both carry region identity.
    const floor = g.subgraphs?.find((s) => s.id === 'cvcue-loc:57')
    const building = g.subgraphs?.find((s) => s.id === 'cvcue-loc:32')
    expect(floor).toMatchObject({ label: '1F', parent: 'cvcue-loc:32', identity: { name: '1F' } })
    expect(building).toMatchObject({ label: 'kenbun', identity: { name: 'kenbun' } })
    expect(building?.parent).toBeUndefined()
  })
})
