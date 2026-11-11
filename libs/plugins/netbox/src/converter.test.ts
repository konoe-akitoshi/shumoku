// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The NetBox mapping, run over the responses recorded from the seeded `fictional-corp` NetBox and
 * asserted against the "Expected input-model output" of `docs/plugins/netbox-mapping.md`. Where
 * NetBox 4.7 differs from what the document assumed, the test follows the data and says so.
 */

import {
  checkNetwork,
  type inputModel as input,
  readNetworkModel,
  type SourceNetwork,
  sourceToGraph,
  writeNetworkModel,
} from '@shumoku/core'
import { validateTopologyIdentityContract } from '@shumoku/core/plugin-kit'
import { beforeAll, describe, expect, it } from 'vitest'
import { convertToSourceNetwork, toYaml } from './converter.js'
import { fictionalCorp } from './fixtures/load.js'
import type { ConverterOptions, NetBoxData } from './types.js'
import { nominalSpeedFromInterfaceType } from './types.js'

/** The options the document gives for the test. */
const OPTIONS: ConverterOptions = {
  cloudClusterTypes: ['aws'],
  roleTypes: { hypervisor: 'server', 'wireless-bridge': 'access-point', 'vpn-gateway': 'router' },
  groupDepth: 'location',
}

// ---------------------------------------------------------------------------
// Readers over the output

type Net = input.Network

function node(net: Net, id: string): input.Node {
  const found = net.nodes.find((n) => n.id === id)
  if (!found) throw new Error(`no node ${id}`)
  return found
}

function segment(net: Net, id: string): input.Segment {
  const found = net.segments?.find((s) => s.id === id)
  if (!found) throw new Error(`no segment ${id}`)
  return found
}

const endName = (e: input.Endpoint): string =>
  'node' in e
    ? `${e.node}:${e.port ?? ''}`
    : 'segment' in e
      ? `~${e.segment}`
      : `@${e.routingDomain}`

/** The links between two ends, in either order: `a` and `b` are `node:port` or `~segment`. */
function linksBetween(net: Net, a: string, b: string): input.Link[] {
  return net.links.filter((l) => {
    const ends = l.endpoints.map(endName)
    return ends.includes(a) && ends.includes(b)
  })
}

/** The one link between two ends. */
function linkBetween(net: Net, a: string, b: string): input.Link {
  const found = linksBetween(net, a, b)
  const [only] = found
  if (found.length !== 1 || !only) throw new Error(`${found.length} links between ${a} and ${b}`)
  return only
}

function linksOf(net: Net, nodeId: string): input.Link[] {
  return net.links.filter((l) => l.endpoints.some((e) => 'node' in e && e.node === nodeId))
}

function group(groups: readonly input.Group[] | undefined, id: string): input.Group | undefined {
  for (const g of groups ?? []) {
    if (g.id === id) return g
    const inner = group(g.groups, id)
    if (inner) return inner
  }
  return undefined
}

// ---------------------------------------------------------------------------

describe('fictional-corp', () => {
  let source: SourceNetwork
  let net: Net

  beforeAll(() => {
    source = convertToSourceNetwork(fictionalCorp(), OPTIONS)
    net = source.network
  })

  describe('as an input', () => {
    it('is a valid network for the input reader', () => {
      expect(checkNetwork(net)).toEqual([])
    })

    it('survives a write and a read as YAML', () => {
      const model = readNetworkModel(writeNetworkModel({ config: net }))
      expect(model.config.nodes.map((n) => n.id)).toEqual(net.nodes.map((n) => n.id))
      expect(model.config.links).toHaveLength(net.links.length)
      expect(toYaml(fictionalCorp(), OPTIONS)).toBe(writeNetworkModel({ config: net }))
    })

    it('is the same for the same data, whatever order NetBox lists it in', () => {
      const data = fictionalCorp()
      const shuffled: NetBoxData = {
        ...data,
        devices: [...data.devices].reverse(),
        interfaces: [...data.interfaces].reverse(),
        cables: [...data.cables].reverse(),
        circuits: [...data.circuits].reverse(),
        ipAddresses: [...data.ipAddresses].reverse(),
        prefixes: [...data.prefixes].reverse(),
      }
      expect(convertToSourceNetwork(shuffled, OPTIONS)).toEqual(source)
    })
  })

  describe('identity', () => {
    it('meets the topology identity contract', () => {
      const result = validateTopologyIdentityContract(source)
      // The resolver's graph also holds a node for each segment a link ends at, which core
      // draws itself and no plugin can key; every node the plugin writes has a key.
      const segmentNodes = (net.segments ?? []).map((s) => s.id)
      expect(result.nodesMissingIdentity.filter((id) => !segmentNodes.includes(id))).toEqual([])
      expect(result.portsMissingName).toEqual([])
      for (const n of net.nodes) {
        // Every node is recognized by its address or by NetBox's own id.
        const vendorIds = source.observation?.nodes?.[n.id]?.vendorIds ?? {}
        expect(Boolean(n.address) || Object.keys(vendorIds).length > 0, n.id).toBe(true)
      }
    })

    it('keys a device by its NetBox id and management address, never by a sysName from its name', () => {
      const rt1 = node(net, 'hq-rt1')
      expect(source.observation?.nodes?.['hq-rt1']?.vendorIds).toEqual({ 'netbox-device-id': '1' })
      // Its primary address sits in vlan-99, so it is the segment's, not the node's.
      expect(rt1.address).toBeUndefined()
      const bare: NetBoxData = { ...fictionalCorp(), prefixes: [] }
      expect(node(convertToSourceNetwork(bare, OPTIONS).network, 'hq-rt1').address).toBe(
        '10.0.99.1',
      )
      expect(rt1.sysName).toBeUndefined()
      for (const n of net.nodes) {
        expect(n.sysName, n.id).toBeUndefined()
        expect(n.chassisId, n.id).toBeUndefined()
        expect(n.mac, n.id).toBeUndefined()
      }
    })

    it('keys VMs, providers, provider networks and the cloud by their NetBox ids only', () => {
      const vendorIds = (id: string) => source.observation?.nodes?.[id]?.vendorIds
      expect(vendorIds('app01')?.['netbox-vm-id']).toBe('1')
      expect(vendorIds('cluster-aws-ap-northeast-1')).toEqual({ 'netbox-cluster-id': '2' })
      expect(node(net, 'cluster-aws-ap-northeast-1').address).toBeUndefined()
      for (const id of [
        'pn-transit-one-transit-one-backbone',
        'pn-transit-two-transit-two-backbone',
        'pn-fict-ix-fict-ix-peering-lan',
      ]) {
        expect(Object.keys(vendorIds(id) ?? {})).toEqual(['netbox-provider-network-id'])
        expect(node(net, id).address).toBeUndefined()
      }
    })

    it('names ports by their interface name; subinterfaces are not ports', () => {
      const ports = source.observation?.nodes?.['hq-rt1']?.ports ?? {}
      expect(Object.keys(ports)).toContain('et-0/0/0')
      expect(Object.keys(ports)).toContain('irb.20')
      expect(Object.keys(ports)).not.toContain('et-0/0/0.100')
      expect(Object.keys(ports)).not.toContain('et-0/0/1.200')
      const fw1 = source.observation?.nodes?.['hq-fw1']?.ports ?? {}
      expect(Object.keys(fw1)).toContain('tunnel.1')
      // The provider's port is the circuit that is handed off on it.
      const pn = source.observation?.nodes?.['pn-transit-one-transit-one-backbone']?.ports ?? {}
      expect(Object.keys(pn).sort()).toEqual(['TO-IP-1001', 'TO-IP-1002'])
    })

    it('writes an interface hardware address on the configuration port, spelt one way', () => {
      const data = fictionalCorp()
      const iface = data.interfaces.find((i) => i.name === 'et-0/0/0' && i.device.id === 1)
      expect(iface).toBeDefined()
      const withMac: NetBoxData = {
        ...data,
        interfaces: data.interfaces.map((i) =>
          i === iface ? { ...i, primary_mac_address: { mac_address: 'CC-D8-1F-9F-D4-AB' } } : i,
        ),
      }
      const out = convertToSourceNetwork(withMac, OPTIONS)
      expect(node(out.network, 'hq-rt1').ports).toEqual([
        { name: 'et-0/0/0', mac: 'cc:d8:1f:9f:d4:ab' },
      ])
      // Nothing of the port but that it was seen rides in the observation.
      expect(out.observation?.nodes?.['hq-rt1']?.ports?.['et-0/0/0']).toEqual({})
      // Without a hardware address no port is written: the links name it.
      expect(node(net, 'hq-rt1').ports).toBeUndefined()
    })
  })

  describe('places', () => {
    it('nests locations under their site, and writes only the places that hold a node', () => {
      expect(net.groups?.map((g) => g.id)).toEqual(['site-branch', 'site-hq'])
      const hq = group(net.groups, 'site-hq')
      expect(hq?.label).toBe('Fictional HQ')
      expect(hq?.groups?.map((g) => [g.id, g.label])).toEqual([
        ['location-hq-annex', 'HQ Annex'],
        ['location-hq-mdf', 'HQ MDF'],
      ])
      expect(group(net.groups, 'site-branch')?.label).toBe('Branch Osaka')
      expect(group(net.groups, 'site-branch')?.groups).toBeUndefined()
    })

    it('puts a device in its innermost place and a VM in its site', () => {
      expect(node(net, 'hq-rt1').group).toBe('location-hq-mdf')
      expect(node(net, 'annex-sw1').group).toBe('location-hq-annex')
      expect(node(net, 'br-rt1').group).toBe('site-branch')
      expect(node(net, 'app01').group).toBe('site-hq')
      expect(node(net, 'db01').group).toBe('site-hq')
    })

    it('leaves a VM with no site out of every place', () => {
      expect(node(net, 'web01').group).toBeUndefined()
      expect(node(net, 'vgw').group).toBeUndefined()
      expect(node(net, 'cluster-aws-ap-northeast-1').group).toBeUndefined()
    })
  })

  describe('nodes', () => {
    it('uses the name as the id and the label', () => {
      expect(node(net, 'hq-rt1').label).toBe('hq-rt1')
      expect(net.nodes.map((n) => n.id)).toEqual(
        expect.arrayContaining(['hq-rt1', 'hq-fw1', 'hq-sw1', 'hq-esx1', 'hq-wl1', 'br-rt1']),
      )
    })

    it('writes product as maker/model slugs and software as the platform', () => {
      expect(node(net, 'hq-rt1')).toMatchObject({
        product: 'juniper/mx204',
        software: 'Junos 23.4R2',
      })
      expect(node(net, 'hq-fw1')).toMatchObject({
        product: 'fortinet/fortigate-100f',
        software: 'FortiOS',
      })
      expect(node(net, 'hq-esx1')).toMatchObject({
        product: 'dell/poweredge-r760',
        software: 'VMware ESXi 8',
      })
      expect(node(net, 'hq-wl1').product).toBe('ubiquiti/airfiber-60')
      // No platform in NetBox: no software, not a guess.
      expect(node(net, 'hq-wl1').software).toBeUndefined()
    })

    it('types a node by its role: the built-in map, then the roleTypes option', () => {
      expect(node(net, 'hq-rt1').type).toBe('router')
      expect(node(net, 'br-rt1').type).toBe('router')
      expect(node(net, 'hq-fw1').type).toBe('firewall')
      expect(node(net, 'hq-sw1').type).toBe('l2-switch')
      expect(node(net, 'hq-esx1').type).toBe('server')
      expect(node(net, 'hq-wl1').type).toBe('access-point')
      expect(node(net, 'annex-wl1').type).toBe('access-point')
    })

    it('leaves the type unwritten when the role is not mapped', () => {
      const bare = convertToSourceNetwork(fictionalCorp(), { ...OPTIONS, roleTypes: {} })
      expect(node(bare.network, 'hq-esx1').type).toBeUndefined()
      expect(node(bare.network, 'hq-wl1').type).toBeUndefined()
      expect(node(bare.network, 'hq-rt1').type).toBe('router')
    })

    it('does not draw a patch panel: the path passes through it', () => {
      expect(net.nodes.find((n) => n.id === 'hq-pp1')).toBeUndefined()
      expect(JSON.stringify(net)).not.toContain('hq-pp1')
    })

    it('puts the site ASN on routers, firewalls and L3 switches only', () => {
      // Decision 2 of the design: the document's sample also gave it to switches and servers.
      expect(node(net, 'hq-rt1').asn).toBe(64496)
      expect(node(net, 'hq-fw1').asn).toBe(64496)
      expect(node(net, 'hq-fw2').asn).toBe(64496)
      expect(node(net, 'br-rt1').asn).toBe(64496)
      for (const id of ['hq-sw1', 'hq-sw2', 'annex-sw1', 'hq-esx1', 'hq-wl1', 'app01']) {
        expect(node(net, id).asn).toBeUndefined()
      }
    })

    it('writes no ASN when the site has two', () => {
      const data = fictionalCorp()
      const two: NetBoxData = {
        ...data,
        sites: data.sites.map((s) =>
          s.slug === 'hq' ? { ...s, asns: [...(s.asns ?? []), { id: 99, asn: 64999 }] } : s,
        ),
      }
      const out = convertToSourceNetwork(two, OPTIONS).network
      expect(node(out, 'hq-rt1').asn).toBeUndefined()
      expect(node(out, 'br-rt1').asn).toBe(64496)
    })

    it('writes a VM as a virtual-machine, with its platform and no role-derived type', () => {
      expect(node(net, 'app01')).toMatchObject({ type: 'virtual-machine', software: 'Linux' })
      // vgw has the role vpn-gateway, which roleTypes maps to router: a VM stays a VM.
      expect(node(net, 'vgw').type).toBe('virtual-machine')
      expect(node(net, 'web01').type).toBe('virtual-machine')
    })
  })

  describe('hosts of VMs', () => {
    it('hosts a VM pinned to a device on that device', () => {
      expect(node(net, 'db01').host).toBe('hq-esx1')
    })

    it('hosts an unpinned VM of a two-host cluster on the cluster as a set', () => {
      expect(node(net, 'app01').host).toBe('cluster-hq-vsphere')
      const set = net.redundancy?.find((r) => r.id === 'cluster-hq-vsphere')
      expect(set).toMatchObject({
        label: 'hq-vsphere',
        kind: 'cluster',
        nodes: ['hq-esx1', 'hq-esx2'],
      })
    })

    it('draws a cloud cluster as a cloud node that hosts its VMs', () => {
      expect(node(net, 'cluster-aws-ap-northeast-1')).toEqual({
        id: 'cluster-aws-ap-northeast-1',
        label: 'aws-ap-northeast-1',
        type: 'cloud',
        product: 'aws',
      })
      expect(node(net, 'web01').host).toBe('cluster-aws-ap-northeast-1')
      expect(node(net, 'vgw').host).toBe('cluster-aws-ap-northeast-1')
    })

    it('draws no cloud when the option does not name the cluster type', () => {
      const out = convertToSourceNetwork(fictionalCorp(), { ...OPTIONS, cloudClusterTypes: [] })
      expect(out.network.nodes.some((n) => n.type === 'cloud')).toBe(false)
      expect(node(out.network, 'web01').host).toBeUndefined()
    })

    it('hosts a VM on the one host of a single-host cluster, not on a set', () => {
      const data = fictionalCorp()
      const single: NetBoxData = {
        ...data,
        devices: data.devices.map((d) => (d.name === 'hq-esx2' ? { ...d, cluster: null } : d)),
      }
      const out = convertToSourceNetwork(single, OPTIONS).network
      expect(node(out, 'app01').host).toBe('hq-esx1')
      expect(out.redundancy?.some((r) => r.kind === 'cluster')).toBe(false)
    })
  })

  describe('cabled links', () => {
    it('links two devices once, however many times the path is seen', () => {
      const link = linkBetween(net, 'hq-fw1:port1', 'hq-sw1:ge-0/0/1')
      expect(link).toMatchObject({ speed: '1G', cable: 'cat6', segments: ['vlan-10'] })
      expect(link.id).toBe('path-hq-fw1-port1--hq-sw1-ge-0/0/1')
      expect(link.virtual).toBeUndefined()
      expect(link.length).toBeUndefined()
    })

    it('writes the cable type and length of a single cable', () => {
      expect(linkBetween(net, 'hq-rt1:et-0/0/4', 'hq-sw1:et-0/0/48')).toMatchObject({
        speed: '100G',
        cable: 'smf',
        length: '3m',
      })
      expect(linkBetween(net, 'hq-rt1:et-0/0/5', 'hq-sw2:et-0/0/48')).toMatchObject({
        cable: 'smf',
        length: '3m',
      })
    })

    it('writes no cable type when the cable has none', () => {
      const link = linkBetween(net, 'hq-esx1:vmnic0', 'hq-sw1:ge-0/0/10')
      expect(link).toMatchObject({ speed: '1G', segments: ['vlan-10', 'vlan-20', 'vlan-99'] })
      expect(link.cable).toBeUndefined()
    })

    it('carries the VLANs of both ends, a LAG and its members', () => {
      const lagMember = linkBetween(net, 'hq-rt1:et-0/0/4', 'hq-sw1:et-0/0/48')
      expect(lagMember.segments).toEqual(['vlan-10', 'vlan-20', 'vlan-99'])
      expect(linkBetween(net, 'hq-sw2:ge-0/0/20', 'hq-wl1:eth0').segments).toEqual(['vlan-99'])
    })

    it('makes a LAG across virtual chassis members one connection', () => {
      const a = linkBetween(net, 'hq-rt1:et-0/0/4', 'hq-sw1:et-0/0/48')
      const b = linkBetween(net, 'hq-rt1:et-0/0/5', 'hq-sw2:et-0/0/48')
      expect(a.connection).toBe('lag-hq-rt1-ae0--hq-sw1-ae0')
      expect(b.connection).toBe(a.connection)
      expect(net.connections?.find((c) => c.id === a.connection)).toEqual({
        id: 'lag-hq-rt1-ae0--hq-sw1-ae0',
        label: 'ae0 ⇄ ae0',
      })
    })

    it('writes the circuit through a patch panel as one device-to-device link', () => {
      // The same two ports are also joined by the pseudowire, which is a virtual link.
      const [link] = linksBetween(net, 'hq-rt1:et-0/0/1', 'br-rt1:ge-0/0/0').filter(
        (l) => !l.virtual,
      )
      expect(link).toMatchObject({ speed: '10G', description: 'fictional-telecom FT-DF-0001' })
      if (!link) throw new Error('no cabled link')
      expect(link.id).toBe('path-br-rt1-ge-0/0/0--hq-rt1-et-0/0/1')
      // Several cables with several media: no cable type, no length.
      expect(link.cable).toBeUndefined()
      expect(link.length).toBeUndefined()
      expect(link.virtual).toBeUndefined()
      // Both ends are our own: the provider is not a node.
      expect(net.nodes.some((n) => n.id.includes('fictional-telecom'))).toBe(false)
    })

    it('gives every link an id that does not change with the order NetBox lists things in', () => {
      for (const link of net.links) expect(link.id).toBeTruthy()
      expect(new Set(net.links.map((l) => l.id)).size).toBe(net.links.length)
    })

    it('never colours a link and keeps the cable type as a fact', () => {
      expect(JSON.stringify(source.drawing ?? {})).not.toMatch(/stroke|color|#[0-9a-f]{3,6}/i)
    })
  })

  describe('beyond the network: providers and provider networks', () => {
    const pns = [
      ['pn-transit-one-transit-one-backbone', 'transit-one-backbone', 64500],
      ['pn-transit-two-transit-two-backbone', 'transit-two-backbone', 64501],
      ['pn-fict-ix-fict-ix-peering-lan', 'fict-ix-peering-lan', 64510],
    ] as const

    it('writes each provider network a circuit reaches as an external node with its ASN', () => {
      for (const [id, label, asn] of pns) {
        expect(node(net, id)).toEqual({ id, label, type: 'external', asn })
      }
    })

    it('writes no node for a provider whose circuit lands on our devices at both ends', () => {
      expect(net.nodes.filter((n) => n.type === 'external')).toHaveLength(3)
      expect(net.nodes.find((n) => n.label === 'fictional-telecom')).toBeUndefined()
    })

    it('links a device to the provider network on a port named for the circuit', () => {
      expect(
        linkBetween(net, 'hq-rt1:et-0/0/0', 'pn-transit-one-transit-one-backbone:TO-IP-1001'),
      ).toMatchObject({
        speed: '10G',
        bandwidth: '2G',
        description: 'transit-one TO-IP-1001',
        segments: ['prefix-198.51.100.0-31'],
      })
      expect(
        linkBetween(net, 'hq-rt1:et-0/0/2', 'pn-transit-two-transit-two-backbone:TT-IP-2002'),
      ).toMatchObject({
        description: 'transit-two TT-IP-2002',
        segments: ['prefix-198.51.100.2-31'],
      })
      expect(
        linkBetween(net, 'hq-rt1:et-0/0/3', 'pn-fict-ix-fict-ix-peering-lan:IX-PORT-7'),
      ).toMatchObject({
        description: 'fict-ix IX-PORT-7',
        segments: ['prefix-203.0.113.0-24'],
      })
    })

    it('takes the speed from the interface when the circuit states none', () => {
      // The document leaves TO-IP-1002 without a speed; the interface states 1 Gb/s.
      const link = linkBetween(
        net,
        'br-rt1:ge-0/0/1',
        'pn-transit-one-transit-one-backbone:TO-IP-1002',
      )
      expect(link).toMatchObject({ speed: '1G', description: 'transit-one TO-IP-1002' })
      expect(link.segments).toBeUndefined()
    })

    it('leaves the speed out when neither the interface nor the circuit states one', () => {
      // et-0/0/2 is a 100G optic, but its speed is not set: a nominal rate is not the circuit's.
      expect(
        linkBetween(net, 'hq-rt1:et-0/0/2', 'pn-transit-two-transit-two-backbone:TT-IP-2002').speed,
      ).toBeUndefined()
    })

    it('writes the circuit type as a fact of the link, not a colour', () => {
      expect(source.observation?.links?.['circuit-TO-IP-1001']?.metadata).toEqual({
        circuitType: 'internet',
      })
    })

    it('does not draw the planned circuit', () => {
      expect(JSON.stringify(net)).not.toContain('FT-PLAN-9')
      // Its provider has another circuit that is drawn, so only the planned one is missing.
      expect(net.links.filter((l) => l.description?.includes('fictional-telecom'))).toHaveLength(1)
    })

    it('draws a planned circuit only when the status filter asks for it', () => {
      const data = fictionalCorp()
      const planned: NetBoxData = {
        ...data,
        circuits: data.circuits.map((c) =>
          c.cid === 'TO-IP-1002' ? { ...c, status: { value: 'planned', label: 'Planned' } } : c,
        ),
      }
      const hidden = convertToSourceNetwork(planned, OPTIONS)
      expect(hidden.network.links.some((l) => l.id === 'circuit-TO-IP-1002')).toBe(false)
      const shown = convertToSourceNetwork(planned, {
        ...OPTIONS,
        circuitStatuses: ['active', 'planned'],
      })
      expect(shown.network.links.some((l) => l.id === 'circuit-TO-IP-1002')).toBe(true)
      expect(shown.drawing?.links?.['circuit-TO-IP-1002']).toEqual({ type: 'dashed' })
    })

    it('marks a circuit that is not active as dashed in the drawing', () => {
      const data = fictionalCorp()
      const offline: NetBoxData = {
        ...data,
        circuits: data.circuits.map((c) =>
          c.cid === 'TO-IP-1002' ? { ...c, status: { value: 'offline', label: 'Offline' } } : c,
        ),
      }
      const out = convertToSourceNetwork(offline, OPTIONS)
      expect(out.drawing?.links?.['circuit-TO-IP-1002']).toEqual({ type: 'dashed' })
      expect(out.drawing?.links?.['circuit-TO-IP-1001']).toBeUndefined()
    })

    it('stands a provider for the far side when the circuit goes nowhere we know', () => {
      const data = fictionalCorp()
      // Make TO-IP-1002's far termination a site-scoped, uncabled one.
      const open: NetBoxData = {
        ...data,
        interfaces: data.interfaces.map((i) =>
          i.device.name === 'br-rt1' && i.name === 'ge-0/0/1'
            ? { ...i, connected_endpoints: [], connected_endpoints_type: null }
            : i,
        ),
        circuitTerminations: data.circuitTerminations.map((t) =>
          t.circuit.cid === 'TO-IP-1002' && t.term_side === 'Z'
            ? { ...t, termination_type: 'dcim.site', termination_id: 2 }
            : t,
        ),
      }
      const out = convertToSourceNetwork(open, OPTIONS).network
      expect(node(out, 'provider-transit-one')).toEqual({
        id: 'provider-transit-one',
        label: 'transit-one',
        type: 'external',
        asn: 64500,
      })
      expect(
        linkBetween(out, 'br-rt1:ge-0/0/1', 'provider-transit-one:TO-IP-1002').description,
      ).toBe('transit-one TO-IP-1002')
    })

    it('lists the ASNs in words when the provider has several, and writes none as the node ASN', () => {
      const data = fictionalCorp()
      const many: NetBoxData = {
        ...data,
        providers: data.providers.map((p) =>
          p.slug === 'transit-one'
            ? { ...p, asns: [...(p.asns ?? []), { id: 50, asn: 64550 }] }
            : p,
        ),
      }
      const out = convertToSourceNetwork(many, OPTIONS).network
      const pn = node(out, 'pn-transit-one-transit-one-backbone')
      expect(pn.asn).toBeUndefined()
      expect(pn.description).toBe('AS64500, AS64550')
    })
  })

  describe('virtual links', () => {
    it('writes each tunnel as a virtual link between the terminated interfaces', () => {
      const one = linkBetween(net, 'hq-fw1:tunnel.1', 'vgw:tun1')
      const two = linkBetween(net, 'hq-fw1:tunnel.2', 'vgw:tun2')
      expect(one.virtual).toBe(true)
      expect(two.virtual).toBe(true)
      expect(one.id).toBe('tunnel-aws-tun-1')
      expect(two.id).toBe('tunnel-aws-tun-2')
      // NetBox 4.7 gives the encapsulation as `ipsec-tunnel`; it is written as it is given.
      expect(one.description).toBe('ipsec-tunnel aws-tun-1')
      expect(two.description).toBe('ipsec-tunnel aws-tun-2')
      expect(one.cable).toBeUndefined()
    })

    it('groups the tunnels of a tunnel group into one connection', () => {
      const one = linkBetween(net, 'hq-fw1:tunnel.1', 'vgw:tun1')
      const two = linkBetween(net, 'hq-fw1:tunnel.2', 'vgw:tun2')
      expect(one.connection).toBe('tunnel-group-vpn-aws')
      expect(two.connection).toBe('tunnel-group-vpn-aws')
      expect(net.connections?.find((c) => c.id === 'tunnel-group-vpn-aws')).toEqual({
        id: 'tunnel-group-vpn-aws',
        label: 'vpn-aws',
      })
    })

    it('carries the inside prefix of a tunnel as its segment', () => {
      expect(linkBetween(net, 'hq-fw1:tunnel.1', 'vgw:tun1').segments).toEqual([
        'prefix-192.0.2.0-30',
      ])
      expect(linkBetween(net, 'hq-fw1:tunnel.2', 'vgw:tun2').segments).toEqual([
        'prefix-192.0.2.4-30',
      ])
    })

    it('joins a hub and a spoke as it joins two peers', () => {
      const data = fictionalCorp()
      const hubbed: NetBoxData = {
        ...data,
        tunnelTerminations: data.tunnelTerminations.map((t) => {
          if (t.tunnel.id !== 1) return t
          return {
            ...t,
            role: { value: t.termination_type === 'dcim.interface' ? 'hub' : 'spoke' },
          }
        }),
      }
      const out = convertToSourceNetwork(hubbed, OPTIONS).network
      expect(linkBetween(out, 'hq-fw1:tunnel.1', 'vgw:tun1').virtual).toBe(true)
    })

    it('writes the virtual circuit as a virtual link, subinterfaces folded into their parents', () => {
      const link = linkBetween(net, 'hq-rt1:et-0/0/0', 'br-rt1:ge-0/0/1')
      expect(link).toMatchObject({
        id: 'vcircuit-TO-VC-77-1',
        virtual: true,
        description: 'transit-one-backbone TO-VC-77',
      })
      expect(link.cable).toBeUndefined()
    })

    it('joins a lone virtual circuit termination to the provider network', () => {
      const data = fictionalCorp()
      const lone: NetBoxData = {
        ...data,
        virtualCircuitTerminations: data.virtualCircuitTerminations.slice(0, 1),
      }
      const out = convertToSourceNetwork(lone, OPTIONS).network
      const link = linkBetween(
        out,
        'hq-rt1:et-0/0/0',
        'pn-transit-one-transit-one-backbone:TO-VC-77',
      )
      expect(link.virtual).toBe(true)
    })

    it('writes a point-to-point L2VPN as one virtual link between the folded ports', () => {
      // The same two ports are joined by the circuit's cabled path; the pseudowire is the other.
      const virtual = linksBetween(net, 'hq-rt1:et-0/0/1', 'br-rt1:ge-0/0/0').filter(
        (l) => l.virtual,
      )
      expect(virtual).toHaveLength(1)
      expect(virtual[0]).toMatchObject({ id: 'l2vpn-pw-hq-br', description: 'vpws pw-hq-br' })
      expect(virtual[0]?.cable).toBeUndefined()
    })

    it('writes a multipoint L2VPN as a segment, each terminated interface virtually joined to it', () => {
      expect(segment(net, 'l2vpn-evpn-users')).toEqual({
        id: 'l2vpn-evpn-users',
        label: 'evpn-users',
      })
      for (const holder of ['hq-rt1', 'br-rt1']) {
        const link = linkBetween(net, `${holder}:irb.20`, '~l2vpn-evpn-users')
        expect(link.virtual).toBe(true)
      }
    })

    it('maps no VLAN termination of an L2VPN', () => {
      const data = fictionalCorp()
      const vlanOnly: NetBoxData = {
        ...data,
        l2vpnTerminations: data.l2vpnTerminations.map((t) => ({
          ...t,
          assigned_object_type: 'ipam.vlan',
        })),
      }
      const out = convertToSourceNetwork(vlanOnly, OPTIONS).network
      expect(out.segments?.some((s) => s.id.startsWith('l2vpn-'))).toBe(false)
    })

    it('joins a VM adapter to the VLAN segment with a virtual link', () => {
      for (const vm of ['app01', 'db01']) {
        const link = linkBetween(net, `${vm}:eth0`, '~vlan-10')
        expect(link.virtual).toBe(true)
        expect(link.id).toBe(`vm-${vm}-eth0-vlan-10`)
      }
    })

    it('writes no link for a VM whose address is in a subnet but which has no VLAN', () => {
      expect(linksOf(net, 'web01')).toEqual([])
    })

    it('writes the wireless link as neither virtual nor cabled, the medium in words', () => {
      const link = linkBetween(net, 'hq-wl1:radio0', 'annex-wl1:radio0')
      expect(link.id).toBe('wireless-1')
      expect(link.description).toBe('wireless hq-annex-ptp, 300m')
      expect(link.virtual).toBeUndefined()
      expect(link.cable).toBeUndefined()
      expect(link.length).toBeUndefined()
    })

    it('does not read a wireless peer as a cabled path', () => {
      // The radios are each other's connected endpoint in NetBox, but there is no cable.
      expect(
        net.links.filter((l) => l.endpoints.some((e) => 'node' in e && e.port === 'radio0')),
      ).toHaveLength(1)
    })
  })

  describe('redundancy', () => {
    it('writes a virtual chassis as a set, its members staying separate nodes', () => {
      expect(net.redundancy?.find((r) => r.id === 'vc-hq-vc')).toEqual({
        id: 'vc-hq-vc',
        label: 'hq-vc',
        nodes: ['hq-sw1', 'hq-sw2'],
        kind: 'vc',
      })
      expect(net.nodes.some((n) => n.members)).toBe(false)
      expect(source.observation?.nodes?.['hq-sw1']?.metadata?.['virtualChassis']).toEqual({
        name: 'hq-vc',
        position: 1,
        master: true,
      })
      expect(source.observation?.nodes?.['hq-sw2']?.metadata?.['virtualChassis']).toMatchObject({
        position: 2,
        master: false,
      })
    })

    it('writes an FHRP group on two nodes as a set, with its VIP under the set', () => {
      // NetBox 4.7 names the protocol vrrp2, so the id is fhrp-vrrp2-10 (the document said vrrp).
      expect(net.redundancy?.find((r) => r.id === 'fhrp-vrrp2-10')).toEqual({
        id: 'fhrp-vrrp2-10',
        label: 'fw-vip',
        nodes: ['hq-fw1', 'hq-fw2'],
        kind: 'ha',
      })
      expect(segment(net, 'vlan-10').addresses?.['fhrp-vrrp2-10']).toBe('10.0.10.1')
      // The VIP is the group's, not either firewall's.
      expect(segment(net, 'vlan-10').addresses?.['hq-fw1']).toBe('10.0.10.2')
      expect(segment(net, 'vlan-10').addresses?.['hq-fw2']).toBe('10.0.10.3')
    })

    it('writes the VIP under the one node when the group is on one node only', () => {
      const data = fictionalCorp()
      const solo: NetBoxData = {
        ...data,
        fhrpAssignments: data.fhrpAssignments.filter((a) => a.interface_id === 12),
      }
      const out = convertToSourceNetwork(solo, OPTIONS).network
      expect(out.redundancy?.some((r) => r.kind === 'ha')).toBe(false)
      expect(segment(out, 'vlan-10').addresses?.['hq-fw1']).toEqual(['10.0.10.1', '10.0.10.2'])
    })

    it('keeps the FHRP priorities as facts of the member nodes', () => {
      expect(source.observation?.nodes?.['hq-fw1']?.metadata?.['fhrp']).toEqual([
        { protocol: 'vrrp2', groupId: 10, priority: 110 },
      ])
    })
  })

  describe('segments, addresses and routing domains', () => {
    it('writes the VLAN segments some link carries, with prefix, place and addresses', () => {
      expect(segment(net, 'vlan-10')).toMatchObject({
        label: 'servers',
        vlan: 10,
        prefix: '10.0.10.0/24',
        group: 'site-hq',
        addresses: {
          'hq-fw1': '10.0.10.2',
          'hq-fw2': '10.0.10.3',
          app01: '10.0.10.21',
          db01: '10.0.10.31',
          'fhrp-vrrp2-10': '10.0.10.1',
        },
      })
      expect(segment(net, 'vlan-20')).toEqual({
        id: 'vlan-20',
        label: 'users',
        vlan: 20,
        prefix: '10.0.20.0/24',
        group: 'site-hq',
      })
      expect(segment(net, 'vlan-99')).toMatchObject({
        label: 'mgmt',
        vlan: 99,
        prefix: '10.0.99.0/24',
        group: 'site-hq',
        addresses: {
          'hq-rt1': '10.0.99.1',
          'hq-fw1': '10.0.99.2',
          'hq-fw2': '10.0.99.3',
          'hq-sw1': '10.0.99.11',
          'hq-esx1': '10.0.99.21',
          'hq-esx2': '10.0.99.22',
          'br-rt1': '10.0.99.254',
        },
      })
    })

    it('writes a prefix with no VLAN as a segment only when a node has an address in it', () => {
      expect(segment(net, 'prefix-192.0.2.0-30')).toEqual({
        id: 'prefix-192.0.2.0-30',
        label: '192.0.2.0/30',
        prefix: '192.0.2.0/30',
        addresses: { 'hq-fw1': '192.0.2.1', vgw: '192.0.2.2' },
      })
      expect(segment(net, 'prefix-192.0.2.4-30').addresses).toEqual({
        'hq-fw1': '192.0.2.5',
        vgw: '192.0.2.6',
      })
      expect(segment(net, 'prefix-198.51.100.0-31').addresses).toEqual({ 'hq-rt1': '198.51.100.1' })
      expect(segment(net, 'prefix-198.51.100.2-31').addresses).toEqual({ 'hq-rt1': '198.51.100.3' })
      expect(segment(net, 'prefix-203.0.113.0-24')).toEqual({
        id: 'prefix-203.0.113.0-24',
        label: '203.0.113.0/24',
        prefix: '203.0.113.0/24',
        group: 'site-hq',
        addresses: { 'hq-rt1': '203.0.113.10' },
      })
    })

    it('does not write a prefix nobody has an address in', () => {
      expect(net.segments?.some((s) => s.prefix === '10.100.2.0/24')).toBe(false)
      expect(net.segments?.some((s) => s.prefix === '10.100.0.0/16')).toBe(false)
    })

    it('keeps a primary address in the segment, not on the node', () => {
      expect(segment(net, 'vlan-99').addresses?.['hq-rt1']).toBe('10.0.99.1')
      for (const n of net.nodes) expect(n.address).toBeUndefined()
    })

    it('writes the address on the node when no prefix holds it', () => {
      const data = fictionalCorp()
      const bare: NetBoxData = { ...data, prefixes: [] }
      const out = convertToSourceNetwork(bare, OPTIONS).network
      expect(node(out, 'hq-rt1').address).toBe('10.0.99.1')
      expect(out.segments?.every((s) => !s.addresses)).toBe(true)
      expect(checkNetwork(out)).toEqual([])
    })

    it('writes a VRF as a routing domain with its top-level containers', () => {
      expect(net.routingDomains).toEqual([
        {
          id: 'vrf-vpc-0a1b2c3d4e5f60789',
          label: 'vpc-0a1b2c3d4e5f60789',
          prefix: '10.100.0.0/16',
        },
      ])
      expect(segment(net, 'prefix-10.100.1.0-24-vpc-0a1b2c3d4e5f60789')).toEqual({
        id: 'prefix-10.100.1.0-24-vpc-0a1b2c3d4e5f60789',
        label: '10.100.1.0/24',
        prefix: '10.100.1.0/24',
        routingDomain: 'vrf-vpc-0a1b2c3d4e5f60789',
        addresses: { web01: '10.100.1.10' },
      })
    })

    it('writes no routing domain for the global table', () => {
      expect(net.routingDomains?.map((d) => d.id)).toEqual(['vrf-vpc-0a1b2c3d4e5f60789'])
      expect(net.segments?.filter((s) => s.routingDomain)).toHaveLength(1)
    })

    it('tells apart two VLANs that share a VID', () => {
      const data = fictionalCorp()
      const clash: NetBoxData = {
        ...data,
        vlans: [...data.vlans, { id: 77, vid: 20, name: 'other-users' }],
      }
      const out = convertToSourceNetwork(clash, OPTIONS).network
      expect(out.segments?.some((s) => s.id === 'vlan-20-2')).toBe(true)
      expect(out.segments?.some((s) => s.id === 'vlan-20')).toBe(false)
    })
  })

  describe('drawing the top', () => {
    it('makes the provider networks and the cloud the things beyond the network', () => {
      const beyond = net.nodes.filter((n) => n.type === 'external' || n.type === 'cloud')
      expect(beyond.map((n) => n.id).sort()).toEqual([
        'cluster-aws-ap-northeast-1',
        'pn-fict-ix-fict-ix-peering-lan',
        'pn-transit-one-transit-one-backbone',
        'pn-transit-two-transit-two-backbone',
      ])
    })

    it('resolves into a graph the resolver can ingest', () => {
      const graph = sourceToGraph(source)
      // Core adds a node for each segment a link ends at.
      const joined = new Set(
        net.links.flatMap((l) => l.endpoints.flatMap((e) => ('segment' in e ? [e.segment] : []))),
      )
      expect(graph.nodes).toHaveLength(net.nodes.length + joined.size)
      expect(graph.links).toHaveLength(net.links.length)
    })
  })
})

// ---------------------------------------------------------------------------

describe('what is left out', () => {
  it('excludes planned and inventory devices and VMs by default', () => {
    const data = fictionalCorp()
    const planned: NetBoxData = {
      ...data,
      devices: data.devices.map((d) =>
        d.name === 'hq-wl1'
          ? { ...d, status: { value: 'planned', label: 'Planned' } }
          : d.name === 'annex-wl1'
            ? { ...d, status: { value: 'inventory', label: 'Inventory' } }
            : d,
      ),
      virtualMachines: data.virtualMachines.map((v) =>
        v.name === 'web01' ? { ...v, status: { value: 'planned', label: 'Planned' } } : v,
      ),
    }
    const out = convertToSourceNetwork(planned, OPTIONS).network
    expect(out.nodes.some((n) => n.id === 'hq-wl1')).toBe(false)
    expect(out.nodes.some((n) => n.id === 'annex-wl1')).toBe(false)
    expect(out.nodes.some((n) => n.id === 'web01')).toBe(false)
    // A path to a device that is not drawn is not drawn, and does not bring it back.
    expect(JSON.stringify(out)).not.toContain('hq-wl1')
    expect(JSON.stringify(out)).not.toContain('annex-wl1')
    expect(checkNetwork(out)).toEqual([])
  })

  it('draws them when the status filter says so', () => {
    const data = fictionalCorp()
    const planned: NetBoxData = {
      ...data,
      devices: data.devices.map((d) =>
        d.name === 'hq-wl1' ? { ...d, status: { value: 'planned', label: 'Planned' } } : d,
      ),
    }
    const out = convertToSourceNetwork(planned, {
      ...OPTIONS,
      statuses: ['active', 'planned'],
    }).network
    expect(out.nodes.some((n) => n.id === 'hq-wl1')).toBe(true)
  })

  it('takes the path through a circuit that is not drawn out with it', () => {
    const data = fictionalCorp()
    const gone: NetBoxData = {
      ...data,
      circuits: data.circuits.map((c) =>
        c.cid === 'FT-DF-0001' ? { ...c, status: { value: 'planned', label: 'Planned' } } : c,
      ),
    }
    const out = convertToSourceNetwork(gone, OPTIONS).network
    expect(JSON.stringify(out.links.map((l) => l.id))).not.toContain('FT-DF')
    expect(out.links.some((l) => l.description?.includes('FT-DF-0001'))).toBe(false)
    expect(out.links.some((l) => l.id === 'path-br-rt1-ge-0/0/0--hq-rt1-et-0/0/1')).toBe(false)
  })
})

describe('ids', () => {
  it('uses device-<pk> for a name that repeats in the result, and for no name', () => {
    const data = fictionalCorp()
    const dup: NetBoxData = {
      ...data,
      devices: data.devices.map((d) =>
        d.name === 'hq-sw2'
          ? { ...d, name: 'hq-sw1' }
          : d.name === 'annex-sw1'
            ? { ...d, name: null }
            : d,
      ),
    }
    const out = convertToSourceNetwork(dup, OPTIONS).network
    expect(out.nodes.some((n) => n.id === 'hq-sw1')).toBe(false)
    expect(node(out, 'device-4').label).toBe('hq-sw1')
    expect(node(out, 'device-5').label).toBe('hq-sw1')
    expect(node(out, 'device-8').label).toBeUndefined()
    expect(checkNetwork(out)).toEqual([])
  })

  it('shares one namespace between devices and VMs', () => {
    const data = fictionalCorp()
    const dup: NetBoxData = {
      ...data,
      virtualMachines: data.virtualMachines.map((v) =>
        v.name === 'app01' ? { ...v, name: 'hq-rt1' } : v,
      ),
    }
    const out = convertToSourceNetwork(dup, OPTIONS).network
    expect(out.nodes.some((n) => n.id === 'hq-rt1')).toBe(false)
    expect(node(out, 'device-1').label).toBe('hq-rt1')
    expect(node(out, 'vm-1').label).toBe('hq-rt1')
  })
})

describe('group depth', () => {
  it('draws only sites at depth site', () => {
    const out = convertToSourceNetwork(fictionalCorp(), { ...OPTIONS, groupDepth: 'site' }).network
    expect(out.groups).toEqual([
      { id: 'site-branch', label: 'Branch Osaka' },
      { id: 'site-hq', label: 'Fictional HQ' },
    ])
    expect(node(out, 'hq-rt1').group).toBe('site-hq')
  })

  it('nests the rack under its location at depth rack', () => {
    const data = fictionalCorp()
    const racked: NetBoxData = {
      ...data,
      devices: data.devices.map((d) =>
        d.name === 'hq-rt1' ? { ...d, rack: { id: 7, name: 'Rack A1' } } : d,
      ),
    }
    const out = convertToSourceNetwork(racked, { ...OPTIONS, groupDepth: 'rack' }).network
    expect(node(out, 'hq-rt1').group).toBe('rack-7')
    expect(group(out.groups, 'rack-7')).toEqual({ id: 'rack-7', label: 'Rack A1' })
    expect(group(group(out.groups, 'location-hq-mdf')?.groups, 'rack-7')).toBeDefined()
  })

  it('nests a location under its parent location', () => {
    const data = fictionalCorp()
    const nested: NetBoxData = {
      ...data,
      locations: data.locations.map((l) =>
        l.slug === 'hq-annex' ? { ...l, parent: { id: 1, name: 'HQ MDF', slug: 'hq-mdf' } } : l,
      ),
    }
    const out = convertToSourceNetwork(nested, OPTIONS).network
    expect(group(group(out.groups, 'location-hq-mdf')?.groups, 'location-hq-annex')?.label).toBe(
      'HQ Annex',
    )
  })
})

describe('far-end devices', () => {
  it('draws a device a path reaches though it was not fetched, with only what is known', () => {
    const data = fictionalCorp()
    // Fetch only hq-rt1 and its circuit's far end: br-rt1 is then known only through the path.
    const partial: NetBoxData = {
      ...data,
      devices: data.devices.filter((d) => d.name !== 'br-rt1'),
      interfaces: data.interfaces.filter((i) => i.device.name !== 'br-rt1'),
    }
    const out = convertToSourceNetwork(partial, OPTIONS).network
    expect(node(out, 'br-rt1')).toEqual({ id: 'br-rt1', label: 'br-rt1' })
    expect(linkBetween(out, 'hq-rt1:et-0/0/1', 'br-rt1:ge-0/0/0')).toBeDefined()
    expect(checkNetwork(out)).toEqual([])
  })
})

describe('nominalSpeedFromInterfaceType', () => {
  it('reads the rate out of the Ethernet type slug', () => {
    expect(nominalSpeedFromInterfaceType('1000base-t')).toBe(1_000_000)
    expect(nominalSpeedFromInterfaceType('100gbase-x-qsfp28')).toBe(100_000_000)
    expect(nominalSpeedFromInterfaceType('virtual')).toBeNull()
    expect(nominalSpeedFromInterfaceType(undefined)).toBeNull()
  })
})
