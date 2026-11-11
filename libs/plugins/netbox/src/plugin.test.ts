import type { PluginRegistryInterface } from '@shumoku/core'
import { sourceToGraph } from '@shumoku/core'
import { validateTopologyIdentityContract } from '@shumoku/core/plugin-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureFetch } from './fixtures/load.js'
import { register } from './index.js'
import { converterOptions, fetchFilters, NetBoxPlugin } from './plugin.js'

function plugin(): NetBoxPlugin {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const p = new NetBoxPlugin()
  p.initialize({ url: 'https://netbox.invalid', token: 'a'.repeat(40) })
  return p
}

type Descriptor = Parameters<PluginRegistryInterface['registerDescriptor']>[0]

/** The descriptor `register` hands to the registry. */
function descriptor(): Descriptor {
  let captured: Descriptor | undefined
  register({
    registerDescriptor: (d: Descriptor) => {
      captured = d
    },
  } as unknown as PluginRegistryInterface)
  if (!captured) throw new Error('nothing registered')
  return captured
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('options', () => {
  it('reads the device filters, one value or several', () => {
    expect(
      fetchFilters({
        siteFilter: ['hq'],
        tagFilter: 'core',
        roleFilter: [],
        excludeRoleFilter: ['patch-panel'],
        excludeTagFilter: ['skip'],
        tenantFilter: ['acme'],
      }),
    ).toEqual({
      site: ['hq'],
      tag: ['core'],
      role: [],
      excludeRole: ['patch-panel'],
      excludeTag: ['skip'],
      tenant: ['acme'],
    })
  })

  it('reads the mapping options; roleTypes is role=type lines or an object', () => {
    expect(
      converterOptions({
        groupDepth: 'rack',
        cloudClusterTypes: ['aws'],
        roleTypes: ['hypervisor=server', ' wireless-bridge = access-point ', 'broken'],
        statusFilter: ['active'],
        circuitStatusFilter: ['active', 'offline'],
      }),
    ).toEqual({
      groupDepth: 'rack',
      cloudClusterTypes: ['aws'],
      roleTypes: { hypervisor: 'server', 'wireless-bridge': 'access-point' },
      statuses: ['active'],
      circuitStatuses: ['active', 'offline'],
    })
    expect(converterOptions({ roleTypes: { a: 'router' } }).roleTypes).toEqual({ a: 'router' })
  })

  it('leaves the defaults to the converter when nothing is set', () => {
    expect(converterOptions(undefined)).toEqual({ cloudClusterTypes: [], roleTypes: {} })
    expect(converterOptions({ groupDepth: 'galaxy' }).groupDepth).toBeUndefined()
  })
})

describe('options schema', () => {
  const properties = descriptor().optionsSchema?.properties ?? {}
  const keys = Object.keys(properties)

  it('offers every option the plugin reads', () => {
    expect([...keys].sort()).toEqual(
      [
        'groupDepth',
        'siteFilter',
        'tagFilter',
        'roleFilter',
        'excludeRoleFilter',
        'excludeTagFilter',
        'tenantFilter',
        'cloudClusterTypes',
        'roleTypes',
        'statusFilter',
        'circuitStatusFilter',
      ].sort(),
    )
  })

  it('has no option for what was removed: tag levels, prefix grouping, colours', () => {
    for (const gone of ['groupBy', 'colorByCableType', 'tagMapping', 'colorByStatus']) {
      expect(keys).not.toContain(gone)
    }
    const depth = properties['groupDepth']
    expect(depth?.oneOf?.map((o) => o.const)).toEqual(['site', 'location', 'rack'])
    expect(depth?.default).toBe('location')
  })

  it('names the cluster types as candidates from NetBox', () => {
    expect(properties['cloudClusterTypes']?.optionsSource).toBe('clusterTypes')
  })
})

describe('NetBoxPlugin against the recorded NetBox', () => {
  it('fetches a topology that meets the identity contract', async () => {
    vi.stubGlobal('fetch', fixtureFetch())
    const source = await plugin().fetchTopology({
      cloudClusterTypes: ['aws'],
      roleTypes: ['hypervisor=server', 'wireless-bridge=access-point', 'vpn-gateway=router'],
      groupDepth: 'location',
    })
    const net = source.network
    expect(net.nodes.find((n) => n.id === 'cluster-aws-ap-northeast-1')?.type).toBe('cloud')
    expect(net.nodes.find((n) => n.id === 'hq-esx1')?.type).toBe('server')
    expect(net.links.some((l) => l.virtual && l.connection === 'tunnel-group-vpn-aws')).toBe(true)
    const result = validateTopologyIdentityContract(source)
    // Core draws a node for each segment a link ends at; no plugin can key those.
    const segmentNodes = (net.segments ?? []).map((s) => s.id)
    expect(result.nodesMissingIdentity.filter((id) => !segmentNodes.includes(id))).toEqual([])
    expect(result.portsMissingName).toEqual([])
    expect(sourceToGraph(source).nodes.length).toBeGreaterThanOrEqual(net.nodes.length)
  })

  it('lists hosts under the same identity keys as the topology nodes', async () => {
    vi.stubGlobal('fetch', fixtureFetch())
    const p = plugin()
    const hosts = await p.getHosts()
    const source = await p.fetchTopology({})
    const rt1 = hosts.find((h) => h.name === 'hq-rt1')
    expect(rt1?.identity).toEqual({
      mgmtIp: '10.0.99.1',
      vendorIds: { 'netbox-device-id': '1' },
    })
    expect(rt1?.ip).toBe('10.0.99.1')
    // The topology node carries NetBox's id the same way; its address is written in its
    // segment (vlan-99), which the model keeps apart from the node's own `address`.
    expect(source.observation?.nodes?.['hq-rt1']?.vendorIds).toEqual(rt1?.identity?.vendorIds)
    expect(source.network.nodes.find((n) => n.id === 'hq-rt1')?.address).toBeUndefined()
    expect(source.network.segments?.find((s) => s.id === 'vlan-99')?.addresses?.['hq-rt1']).toBe(
      rt1?.identity?.mgmtIp,
    )
    for (const host of hosts) expect(host.identity?.sysName).toBeUndefined()
  })

  it('offers sites, tags, roles and cluster types as candidates', async () => {
    vi.stubGlobal('fetch', fixtureFetch())
    const p = plugin()
    expect((await p.getConfigOptions('sites')).map((o) => o.value).sort()).toEqual(['branch', 'hq'])
    expect((await p.getConfigOptions('clusterTypes')).map((o) => o.value).sort()).toEqual([
      'aws',
      'vmware-vsphere',
    ])
    expect((await p.getConfigOptions('roles')).map((o) => o.value)).toContain('core-router')
    expect(await p.getConfigOptions('nothing')).toEqual([])
  })

  it('lists the interfaces of a host as items carrying the interface name', async () => {
    vi.stubGlobal('fetch', fixtureFetch())
    const items = await plugin().getHostItems('1')
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) expect(item.interfaceName).toBe(item.name)
  })
})
