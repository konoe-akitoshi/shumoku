/**
 * NetBox to Shumoku: what NetBox knows, as a SourceNetwork in the input's shape.
 *
 * The mapping and the reasons for each choice are in `docs/plugins/netbox-mapping.md`. In short:
 * a field is written only when NetBox states it; what lies beyond the network (providers,
 * provider networks, a cloud) is `external` / `cloud` so the drawing knows which way is up; and
 * nodes are told apart by identity keys, never by their names.
 */

import {
  buildIdentity,
  type inputModel as input,
  type LinkDrawing,
  type NodeObservation,
  type PortObservation,
  rateFromBps,
  type SourceNetwork,
  writeNetworkModel,
} from '@shumoku/core'
import { contains, hostOf, PrefixIndex } from './net.js'
import { directCableId } from './paths.js'
import type {
  ConverterOptions,
  GroupDepth,
  NetBoxChoice,
  NetBoxCircuit,
  NetBoxCircuitTermination,
  NetBoxCluster,
  NetBoxData,
  NetBoxDevice,
  NetBoxInterface,
  NetBoxIPAddress,
  NetBoxLocation,
  NetBoxPrefix,
  NetBoxProvider,
  NetBoxProviderNetwork,
  NetBoxRef,
  NetBoxVirtualMachine,
  NetBoxVlanRef,
  NetBoxVMInterface,
} from './types.js'
import {
  DEFAULT_CIRCUIT_STATUSES,
  DEFAULT_DEVICE_STATUSES,
  nominalSpeedFromInterfaceType,
  ROLE_TO_TYPE,
} from './types.js'

// ============================================
// Small helpers
// ============================================

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** A name as it is written in an id: lower case, without spaces. */
function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'x'
  )
}

/** One value written bare, several as a list; nothing as nothing. */
function oneOrMore(list: readonly string[]): input.OneOrMore<string> | undefined {
  const [first, ...rest] = list
  if (first === undefined) return undefined
  return rest.length === 0 ? first : [first, ...rest]
}

/** The least of the rates that are known; unknown ones do not count. */
function leastKnown(...rates: Array<number | null | undefined>): number | undefined {
  const known = rates.filter((r): r is number => typeof r === 'number' && r > 0)
  return known.length === 0 ? undefined : Math.min(...known)
}

const rateOf = (kbps: number): input.Rate => rateFromBps(kbps * 1000)

/** Node types a site's autonomous system is written on. Other devices sit behind a router. */
const ROUTING_TYPES: ReadonlySet<string> = new Set(['router', 'firewall', 'l3-switch'])

/** L2VPN types that join exactly two ends: a pseudowire. */
const POINT_TO_POINT_L2VPN: ReadonlySet<string> = new Set([
  'vpws',
  'epl',
  'ep-lan',
  'ep-tree',
  'evpn-vpws',
])

const KM_PER_MILE = 1.609344

/** A cable's length in the input's units; NetBox has the mile, the input does not. */
function lengthOf(length: number, unit: string): input.Length | undefined {
  switch (unit) {
    case 'mm':
    case 'cm':
    case 'm':
    case 'km':
    case 'in':
    case 'ft':
      return `${length}${unit}`
    case 'mi':
      return `${Number((length * KM_PER_MILE).toFixed(3))}km`
    default:
      return undefined
  }
}

// ============================================
// The mapping
// ============================================

type NodeKind = 'device' | 'vm'

/** A node end of a link: the node, the port it is on and the interface record, when fetched. */
interface End {
  node: string
  port: string
  /** The interface this end is, with its owner's kind, for its addresses. */
  iface?: { kind: NodeKind; id: number }
}

interface LinkDraft {
  id: string
  endpoints: [input.Endpoint, input.Endpoint]
  speedKbps?: number
  bandwidthKbps?: number
  cable?: string
  length?: input.Length
  segments: string[]
  descriptions: string[]
  connection?: string
  virtual?: true
  /** A cable's label, kept in the drawing. */
  label?: string
  dashed?: boolean
  circuitType?: string
}

interface SegmentDraft {
  id: string
  label?: string
  vlan?: number
  /** The VLAN record this stands for, when it is one. */
  vlanPk?: number
  prefixes: string[]
  vrf?: number
  group?: string
  addresses: Map<string, string[]>
}

interface GroupDraft {
  id: string
  label: string
  parent?: string
}

interface ObservedNode {
  identity?: NodeObservation['identity']
  metadata: Record<string, unknown>
}

class Mapper {
  private readonly depth: GroupDepth
  private readonly statuses: ReadonlySet<string>
  private readonly circuitStatuses: ReadonlySet<string>
  private readonly cloudTypes: ReadonlySet<string>
  private readonly roleTypes: Readonly<Record<string, string>>

  // Indexes over what was fetched.
  private readonly deviceById = new Map<number, NetBoxDevice>()
  private readonly vmById = new Map<number, NetBoxVirtualMachine>()
  private readonly ifaceById = new Map<number, NetBoxInterface>()
  private readonly vmIfaceById = new Map<number, NetBoxVMInterface>()
  private readonly childrenOf = new Map<number, NetBoxInterface[]>()
  private readonly vmChildrenOf = new Map<number, NetBoxVMInterface[]>()
  private readonly cableById = new Map<number, NonNullable<NetBoxData['cables'][number]>>()
  private readonly siteById = new Map<number, NetBoxData['sites'][number]>()
  private readonly locationById = new Map<number, NetBoxLocation>()
  private readonly clusterById = new Map<number, NetBoxCluster>()
  private readonly providerById = new Map<number, NetBoxProvider>()
  private readonly pnById = new Map<number, NetBoxProviderNetwork>()
  private readonly circuitById = new Map<number, NetBoxCircuit>()
  private readonly termById = new Map<number, NetBoxCircuitTermination>()
  private readonly termsByCircuit = new Map<number, NetBoxCircuitTermination[]>()
  private readonly vlanById = new Map<number, NetBoxData['vlans'][number]>()
  private readonly ipById = new Map<number, NetBoxIPAddress>()
  private readonly ipsByIface = new Map<string, NetBoxIPAddress[]>()
  private readonly siteAsns = new Map<number, Set<number>>()
  private readonly vlanPks = new Map<number, Set<number>>()
  private readonly prefixIndex = new PrefixIndex<NetBoxPrefix>()

  // Nodes.
  private readonly nodeOfDevice = new Map<number, string>()
  private readonly nodeOfVm = new Map<number, string>()
  private readonly excludedDevices = new Set<number>()
  private readonly farDevices = new Map<number, { name: string | null }>()
  private readonly usedIds = new Set<string>()
  private readonly nodes = new Map<string, Mutable<input.Node>>()
  private readonly observed = new Map<string, ObservedNode>()
  private readonly ports = new Map<string, Map<string, string | undefined>>()

  // Redundancy.
  private readonly redundancy = new Map<string, Mutable<input.Redundancy>>()
  private readonly clusterRedundancy = new Map<number, string>()
  private readonly clusterHosts = new Map<number, string[]>()
  private readonly cloudNodes = new Map<number, string>()

  // External nodes.
  private readonly providerNodes = new Map<number, string>()
  private readonly pnNodes = new Map<number, string>()

  // Places, segments, links.
  private readonly groups = new Map<string, GroupDraft>()
  private readonly segments = new Map<string, SegmentDraft>()
  private readonly connections = new Map<string, input.Connection>()
  private readonly links = new Map<string, LinkDraft>()
  private readonly linkOfIface = new Map<number, LinkDraft>()
  private readonly seenPaths = new Set<string>()
  private readonly droppedIfaces = new Set<number>()

  constructor(
    private readonly data: NetBoxData,
    options: ConverterOptions,
  ) {
    this.depth = options.groupDepth ?? 'location'
    this.statuses = new Set(options.statuses ?? DEFAULT_DEVICE_STATUSES)
    this.circuitStatuses = new Set(options.circuitStatuses ?? DEFAULT_CIRCUIT_STATUSES)
    this.cloudTypes = new Set(options.cloudClusterTypes ?? [])
    this.roleTypes = options.roleTypes ?? {}
    this.index()
  }

  run(): SourceNetwork {
    this.selectNodes()
    this.buildRedundancy()
    this.buildNodes()
    this.buildCabledLinks()
    this.annotateCircuits()
    this.buildTunnels()
    this.buildVirtualCircuits()
    this.buildL2vpns()
    this.buildWirelessLinks()
    this.buildVmAdapters()
    this.placeAddresses()
    return this.output()
  }

  // ------------------------------------------
  // Indexes
  // ------------------------------------------

  private index(): void {
    const d = this.data
    for (const x of d.devices) this.deviceById.set(x.id, x)
    for (const x of d.virtualMachines) this.vmById.set(x.id, x)
    for (const x of d.cables) this.cableById.set(x.id, x)
    for (const x of d.sites) this.siteById.set(x.id, x)
    for (const x of d.locations) this.locationById.set(x.id, x)
    for (const x of d.clusters) this.clusterById.set(x.id, x)
    for (const x of d.providers) this.providerById.set(x.id, x)
    for (const x of d.providerNetworks) this.pnById.set(x.id, x)
    for (const x of d.circuits) this.circuitById.set(x.id, x)
    for (const x of d.ipAddresses) this.ipById.set(x.id, x)
    for (const x of d.circuitTerminations) {
      this.termById.set(x.id, x)
      const list = this.termsByCircuit.get(x.circuit.id) ?? []
      list.push(x)
      this.termsByCircuit.set(x.circuit.id, list)
    }
    for (const x of d.interfaces) {
      this.ifaceById.set(x.id, x)
      if (x.parent) {
        const list = this.childrenOf.get(x.parent.id) ?? []
        list.push(x)
        this.childrenOf.set(x.parent.id, list)
      }
      this.noteVlans(x.untagged_vlan, ...(x.tagged_vlans ?? []))
    }
    for (const x of d.vmInterfaces) {
      this.vmIfaceById.set(x.id, x)
      if (x.parent) {
        const list = this.vmChildrenOf.get(x.parent.id) ?? []
        list.push(x)
        this.vmChildrenOf.set(x.parent.id, list)
      }
      this.noteVlans(x.untagged_vlan, ...(x.tagged_vlans ?? []))
    }
    for (const x of d.vlans) {
      this.vlanById.set(x.id, x)
      this.noteVlans(x)
    }
    for (const x of d.prefixes) {
      this.noteVlans(x.vlan)
      if (this.isRoutable(x)) this.prefixIndex.add(x.prefix, x.vrf?.id ?? null, x)
    }
    for (const ip of d.ipAddresses) {
      const kind = ownerKind(ip.assigned_object_type)
      if (kind && ip.assigned_object_id !== undefined && ip.assigned_object_id !== null) {
        const key = `${kind}:${ip.assigned_object_id}`
        const list = this.ipsByIface.get(key) ?? []
        list.push(ip)
        this.ipsByIface.set(key, list)
      }
    }
    for (const site of d.sites) {
      for (const a of site.asns ?? []) this.addSiteAsn(site.id, a.asn)
    }
    for (const a of d.asns) {
      for (const site of a.sites ?? []) this.addSiteAsn(site.id, a.asn)
    }
  }

  private noteVlans(...refs: Array<{ id: number; vid: number } | null | undefined>): void {
    for (const ref of refs) {
      if (!ref) continue
      const set = this.vlanPks.get(ref.vid) ?? new Set<number>()
      set.add(ref.id)
      this.vlanPks.set(ref.vid, set)
    }
  }

  private addSiteAsn(site: number, asn: number): void {
    const set = this.siteAsns.get(site) ?? new Set<number>()
    set.add(asn)
    this.siteAsns.set(site, set)
  }

  /** A prefix addresses are placed in: not a container, not retired. */
  private isRoutable(prefix: NetBoxPrefix): boolean {
    const status = prefix.status?.value
    return status !== 'container' && status !== 'deprecated'
  }

  // ------------------------------------------
  // Which nodes, and their ids
  // ------------------------------------------

  private isLive(status: NetBoxChoice | undefined): boolean {
    return this.statuses.has(status?.value ?? 'active')
  }

  private isCircuitLive(status: NetBoxChoice | undefined): boolean {
    return this.circuitStatuses.has(status?.value ?? 'active')
  }

  /** A patch panel holds ports but no interface: the cable path passes through it. */
  private isPassive(device: NetBoxDevice): boolean {
    return (
      device.interface_count === 0 &&
      (device.front_port_count ?? 0) + (device.rear_port_count ?? 0) > 0
    )
  }

  private selectNodes(): void {
    const named: Array<{ kind: NodeKind; pk: number; name: string | null }> = []
    for (const device of this.data.devices) {
      if (this.isLive(device.status) && !this.isPassive(device)) {
        named.push({ kind: 'device', pk: device.id, name: device.name })
      } else {
        this.excludedDevices.add(device.id)
      }
    }
    for (const vm of this.data.virtualMachines) {
      if (this.isLive(vm.status)) named.push({ kind: 'vm', pk: vm.id, name: vm.name })
    }

    // A device a cable path reaches but the fetch did not include is still part of the network.
    for (const iface of this.data.interfaces) {
      const near = this.deviceById.get(iface.device.id)
      if (!near || this.excludedDevices.has(near.id)) continue
      if (!iface.cable || iface.wireless_link || !iface.connected_endpoints_reachable) continue
      if (iface.connected_endpoints_type !== 'dcim.interface') continue
      for (const end of iface.connected_endpoints ?? []) {
        const device = end.device
        if (!device || this.deviceById.has(device.id) || this.farDevices.has(device.id)) continue
        this.farDevices.set(device.id, { name: device.name })
        named.push({ kind: 'device', pk: device.id, name: device.name })
      }
    }

    // A name is the id when it is unique in the result; otherwise the record's number.
    const counts = new Map<string, number>()
    for (const { name } of named) if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    for (const { kind, pk, name } of named) {
      const id = name && counts.get(name) === 1 ? name : `${kind === 'vm' ? 'vm' : 'device'}-${pk}`
      const claimed = this.claim(id)
      if (kind === 'vm') this.nodeOfVm.set(pk, claimed)
      else this.nodeOfDevice.set(pk, claimed)
    }
  }

  /** An id nothing else has: `base`, or `base-2`... when taken. */
  private claim(base: string): string {
    let id = base
    for (let n = 2; this.usedIds.has(id); n++) id = `${base}-${n}`
    this.usedIds.add(id)
    return id
  }

  // ------------------------------------------
  // Places
  // ------------------------------------------

  private siteGroup(site: NetBoxRef): string {
    const id = `site-${site.slug ?? slug(site.name ?? String(site.id))}`
    if (!this.groups.has(id)) {
      const full = this.siteById.get(site.id)
      this.groups.set(id, { id, label: full?.name ?? site.name ?? id })
    }
    return id
  }

  /** The innermost group a device or VM sits in, with the groups above it noted. */
  private placeIn(
    site: NetBoxRef | null | undefined,
    location: NetBoxRef | null | undefined,
    rack: NetBoxRef | null | undefined,
  ): string | undefined {
    if (!site) return undefined
    let inner = this.siteGroup(site)
    if (this.depth !== 'site' && location) inner = this.locationGroup(location, inner)
    if (this.depth === 'rack' && rack) {
      const id = `rack-${rack.id}`
      if (!this.groups.has(id)) {
        this.groups.set(id, { id, label: rack.name ?? id, parent: inner })
      }
      inner = id
    }
    return inner
  }

  /** The location and the ones above it, nested under `below`. */
  private locationGroup(location: NetBoxRef, below: string): string {
    const chain: Array<{ id: number; slug: string; name: string }> = []
    let current: NetBoxRef | null | undefined = location
    while (current && chain.length < 32) {
      const full: NetBoxLocation | undefined = this.locationById.get(current.id)
      chain.unshift({
        id: current.id,
        slug: full?.slug ?? current.slug ?? slug(current.name ?? String(current.id)),
        name: full?.name ?? current.name ?? String(current.id),
      })
      current = full?.parent
    }
    let parent = below
    for (const place of chain) {
      const id = `location-${place.slug}`
      if (!this.groups.has(id)) this.groups.set(id, { id, label: place.name, parent })
      parent = id
    }
    return parent
  }

  /** The group of a prefix's scope, when it is a place already drawn. */
  private scopeGroup(
    type: string | null | undefined,
    id: number | null | undefined,
  ): string | undefined {
    if (id === null || id === undefined) return undefined
    if (type === 'dcim.site') {
      const site = this.siteById.get(id)
      const group = site ? `site-${site.slug}` : undefined
      return group && this.groups.has(group) ? group : undefined
    }
    if (type === 'dcim.location') {
      let current: NetBoxLocation | undefined = this.locationById.get(id)
      for (let hops = 0; current && hops < 32; hops++) {
        const group = `location-${current.slug}`
        if (this.groups.has(group)) return group
        if (current.parent) {
          current = this.locationById.get(current.parent.id)
        } else {
          const site: NetBoxRef | null | undefined = current.site
          const siteGroup = site ? `site-${site.slug}` : undefined
          return siteGroup && this.groups.has(siteGroup) ? siteGroup : undefined
        }
      }
    }
    return undefined
  }

  // ------------------------------------------
  // Redundancy sets that nodes name as their host
  // ------------------------------------------

  private buildRedundancy(): void {
    for (const chassis of this.data.virtualChassis) {
      const members = (chassis.members ?? []).flatMap((m) => {
        const id = this.nodeOfDevice.get(m.id)
        return id ? [id] : []
      })
      if (members.length < 2) continue
      const id = this.claim(`vc-${slug(chassis.name)}`)
      this.redundancy.set(id, {
        id,
        label: chassis.name,
        nodes: members.sort(compare),
        kind: 'vc',
      })
      const master = chassis.master ? this.nodeOfDevice.get(chassis.master.id) : undefined
      for (const device of chassis.members ?? []) {
        const node = this.nodeOfDevice.get(device.id)
        if (!node) continue
        const position = this.deviceById.get(device.id)?.vc_position
        this.observe(node).metadata['virtualChassis'] = {
          name: chassis.name,
          ...(position !== null && position !== undefined && { position }),
          ...(master !== undefined && { master: master === node }),
        }
      }
    }

    // A hypervisor cluster of two or more hosts is a set of which a VM runs on one.
    for (const device of this.data.devices) {
      const node = this.nodeOfDevice.get(device.id)
      if (!node || !device.cluster) continue
      const list = this.clusterHosts.get(device.cluster.id) ?? []
      list.push(node)
      this.clusterHosts.set(device.cluster.id, list)
    }
    for (const [clusterId, hosts] of this.clusterHosts) {
      const cluster = this.clusterById.get(clusterId)
      const type = cluster?.type?.slug
      if (!cluster || (type && this.cloudTypes.has(type)) || hosts.length < 2) continue
      const id = this.claim(`cluster-${slug(cluster.name)}`)
      this.redundancy.set(id, {
        id,
        label: cluster.name,
        nodes: [...hosts].sort(compare),
        kind: 'cluster',
      })
      this.clusterRedundancy.set(clusterId, id)
    }

    this.buildFhrp()
  }

  private buildFhrp(): void {
    const members = new Map<number, Set<string>>()
    for (const assignment of this.data.fhrpAssignments) {
      const node = this.nodeOfInterface(assignment.interface_type, assignment.interface_id)
      if (!node) continue
      const set = members.get(assignment.group.id) ?? new Set<string>()
      set.add(node)
      members.set(assignment.group.id, set)
      const iface = ownerKind(assignment.interface_type)
      const groupRec = this.data.fhrpGroups.find((g) => g.id === assignment.group.id)
      if (iface && groupRec) {
        const list = (this.observe(node).metadata['fhrp'] as unknown[] | undefined) ?? []
        list.push({
          protocol: groupRec.protocol,
          groupId: groupRec.group_id,
          ...(assignment.priority !== undefined && { priority: assignment.priority }),
        })
        this.observe(node).metadata['fhrp'] = list
      }
    }
    for (const group of this.data.fhrpGroups) {
      const nodes = [...(members.get(group.id) ?? [])].sort(compare)
      if (nodes.length < 2) continue
      const id = this.claim(`fhrp-${group.protocol}-${group.group_id}`)
      this.redundancy.set(id, {
        id,
        label: group.name || `${group.protocol} ${group.group_id}`,
        nodes,
        kind: 'ha',
      })
      this.fhrpHolder.set(group.id, id)
    }
    for (const group of this.data.fhrpGroups) {
      if (this.fhrpHolder.has(group.id)) continue
      const only = [...(members.get(group.id) ?? [])]
      if (only.length === 1 && only[0]) this.fhrpHolder.set(group.id, only[0])
    }
  }

  /** The node or redundancy set an FHRP group's address is written under. */
  private readonly fhrpHolder = new Map<number, string>()

  private nodeOfInterface(type: string, id: number): string | undefined {
    const kind = ownerKind(type)
    if (kind === 'device') {
      const device = this.ifaceById.get(id)?.device
      return device ? this.nodeOfDevice.get(device.id) : undefined
    }
    if (kind === 'vm') {
      const vm = this.vmIfaceById.get(id)?.virtual_machine
      return vm ? this.nodeOfVm.get(vm.id) : undefined
    }
    return undefined
  }

  // ------------------------------------------
  // Nodes
  // ------------------------------------------

  private observe(id: string): ObservedNode {
    const existing = this.observed.get(id)
    if (existing) return existing
    const created: ObservedNode = { metadata: {} }
    this.observed.set(id, created)
    return created
  }

  private usePort(node: string, port: string, mac?: string): void {
    const ports = this.ports.get(node) ?? new Map<string, string | undefined>()
    if (!ports.has(port) || (mac && !ports.get(port))) ports.set(port, mac)
    this.ports.set(node, ports)
  }

  private typeOf(role: NetBoxRef | null | undefined): string | undefined {
    if (!role?.slug) return undefined
    return this.roleTypes[role.slug] ?? ROLE_TO_TYPE[role.slug]
  }

  private siteAsn(siteId: number | undefined): number | undefined {
    if (siteId === undefined) return undefined
    const [only, ...rest] = this.siteAsns.get(siteId) ?? []
    return only !== undefined && rest.length === 0 ? only : undefined
  }

  private buildNodes(): void {
    for (const [pk, id] of this.nodeOfDevice) {
      const device = this.deviceById.get(pk)
      if (device) this.deviceNode(id, device)
      else this.farNode(id, pk)
    }
    for (const [pk, id] of this.nodeOfVm) {
      const vm = this.vmById.get(pk)
      if (vm) this.vmNode(id, vm)
    }
  }

  private deviceNode(id: string, device: NetBoxDevice): void {
    const type = this.typeOf(device.role)
    const maker = device.device_type?.manufacturer?.slug
    const model = device.device_type?.slug
    const group = this.placeIn(device.site, device.location, device.rack)
    const asn = type && ROUTING_TYPES.has(type) ? this.siteAsn(device.site?.id) : undefined
    this.nodes.set(id, {
      id,
      ...(device.name && { label: device.name }),
      ...(type && { type }),
      ...(maker && model && { product: `${maker}/${model}` }),
      ...(device.platform?.name && { software: device.platform.name }),
      ...(device.description && { description: device.description }),
      ...(asn !== undefined && { asn }),
      ...(group && { group }),
    })
    const ip = device.primary_ip4?.address ?? device.primary_ip6?.address
    const observed = this.observe(id)
    observed.identity = buildIdentity({
      mgmtIp: ip ? hostOf(ip) : undefined,
      vendorIds: { 'netbox-device-id': String(device.id) },
    })
    const meta = observed.metadata
    if (device.role?.slug) meta['role'] = device.role.slug
    if (device.status?.value) meta['status'] = device.status.value
    if (device.serial) meta['serial'] = device.serial
    if (device.asset_tag) meta['assetTag'] = device.asset_tag
    if (device.url) meta['url'] = device.url
  }

  /** A device only a cable path told of: its name and identity, nothing else. */
  private farNode(id: string, pk: number): void {
    const far = this.farDevices.get(pk)
    if (!far) return
    this.nodes.set(id, { id, ...(far.name && { label: far.name }) })
    this.observe(id).identity = buildIdentity({ vendorIds: { 'netbox-device-id': String(pk) } })
  }

  private vmNode(id: string, vm: NetBoxVirtualMachine): void {
    const host = this.hostFor(vm)
    const device = vm.device ? this.deviceById.get(vm.device.id) : undefined
    const cluster = vm.cluster ? this.clusterById.get(vm.cluster.id) : undefined
    const group = vm.site
      ? this.placeIn(vm.site, undefined, undefined)
      : device?.site
        ? this.placeIn(device.site, undefined, undefined)
        : this.clusterSite(cluster)
    this.nodes.set(id, {
      id,
      label: vm.name,
      type: 'virtual-machine',
      ...(vm.platform?.name && { software: vm.platform.name }),
      ...(vm.description && { description: vm.description }),
      ...(host && { host }),
      ...(group && { group }),
    })
    const ip = vm.primary_ip4?.address ?? vm.primary_ip6?.address
    const observed = this.observe(id)
    observed.identity = buildIdentity({
      mgmtIp: ip ? hostOf(ip) : undefined,
      vendorIds: { 'netbox-vm-id': String(vm.id) },
    })
    const meta = observed.metadata
    if (vm.role?.slug) meta['role'] = vm.role.slug
    if (vm.status?.value) meta['status'] = vm.status.value
    if (vm.cluster?.name) meta['cluster'] = vm.cluster.name
    if (vm.vcpus) meta['vcpus'] = vm.vcpus
    if (vm.memory) meta['memory'] = vm.memory
    if (vm.disk) meta['disk'] = vm.disk
    if (vm.url) meta['url'] = vm.url
  }

  /** The site a cluster stands in, when its scope is a site or a location. */
  private clusterSite(cluster: NetBoxCluster | undefined): string | undefined {
    if (!cluster?.scope_id) return undefined
    if (cluster.scope_type === 'dcim.site') {
      const site = this.siteById.get(cluster.scope_id)
      return site ? this.placeIn(site, undefined, undefined) : undefined
    }
    if (cluster.scope_type === 'dcim.location') {
      const location = this.locationById.get(cluster.scope_id)
      return location?.site ? this.placeIn(location.site, undefined, undefined) : undefined
    }
    return undefined
  }

  /** What a VM runs on: its device, the cloud it is in, or its cluster's hosts. */
  private hostFor(vm: NetBoxVirtualMachine): string | undefined {
    const pinned = vm.device ? this.nodeOfDevice.get(vm.device.id) : undefined
    if (pinned) return pinned
    if (!vm.cluster) return undefined
    const cluster = this.clusterById.get(vm.cluster.id)
    const type = cluster?.type?.slug
    if (cluster && type && this.cloudTypes.has(type)) return this.cloudNode(cluster, type)
    const set = this.clusterRedundancy.get(vm.cluster.id)
    if (set) return set
    const hosts = this.clusterHosts.get(vm.cluster.id) ?? []
    return hosts.length === 1 ? hosts[0] : undefined
  }

  private cloudNode(cluster: NetBoxCluster, typeSlug: string): string {
    const existing = this.cloudNodes.get(cluster.id)
    if (existing) return existing
    const id = this.claim(`cluster-${slug(cluster.name)}`)
    this.cloudNodes.set(cluster.id, id)
    const group = this.clusterSite(cluster)
    this.nodes.set(id, {
      id,
      label: cluster.name,
      type: 'cloud',
      product: typeSlug,
      ...(group && { group }),
    })
    this.observe(id).identity = buildIdentity({
      vendorIds: { 'netbox-cluster-id': String(cluster.id) },
    })
    return id
  }

  // ------------------------------------------
  // External nodes: providers and provider networks
  // ------------------------------------------

  private providerAsns(provider: NetBoxRef | undefined): { asn?: number; description?: string } {
    const full = provider ? this.providerById.get(provider.id) : undefined
    const asns = [...new Set((full?.asns ?? []).map((a) => a.asn))]
    if (asns.length === 1) return { asn: asns[0] }
    if (asns.length > 1) return { description: `AS${asns.join(', AS')}` }
    return {}
  }

  private providerNode(provider: NetBoxRef): string {
    const existing = this.providerNodes.get(provider.id)
    if (existing) return existing
    const id = this.claim(`provider-${provider.slug ?? slug(provider.name ?? String(provider.id))}`)
    this.providerNodes.set(provider.id, id)
    const { asn, description } = this.providerAsns(provider)
    this.nodes.set(id, {
      id,
      label: this.providerById.get(provider.id)?.name ?? provider.name ?? id,
      type: 'external',
      ...(asn !== undefined && { asn }),
      ...(description && { description }),
    })
    this.observe(id).identity = buildIdentity({
      vendorIds: { 'netbox-provider-id': String(provider.id) },
    })
    return id
  }

  private pnNode(pn: NetBoxProviderNetwork): string {
    const existing = this.pnNodes.get(pn.id)
    if (existing) return existing
    const provider = pn.provider
    const prefix = provider?.slug ?? slug(provider?.name ?? 'provider')
    const id = this.claim(`pn-${prefix}-${slug(pn.name)}`)
    this.pnNodes.set(pn.id, id)
    const { asn, description } = this.providerAsns(provider)
    this.nodes.set(id, {
      id,
      label: pn.name,
      type: 'external',
      ...(asn !== undefined && { asn }),
      ...(description && { description }),
    })
    this.observe(id).identity = buildIdentity({
      vendorIds: { 'netbox-provider-network-id': String(pn.id) },
    })
    return id
  }

  // ------------------------------------------
  // Ports and the interfaces behind them
  // ------------------------------------------

  /** The port a device interface is on: a subinterface is its parent's port. */
  private devicePort(iface: { name: string; parent?: { id: number } | null }): string {
    let current = iface
    for (let hops = 0; hops < 8; hops++) {
      const next = current.parent ? this.ifaceById.get(current.parent.id) : undefined
      if (!next) break
      current = next
    }
    return current.name
  }

  /** The end of a link an interface of a device or VM is. */
  private endOfInterface(
    type: string | null | undefined,
    id: number | null | undefined,
  ): End | undefined {
    if (id === null || id === undefined) return undefined
    const kind = ownerKind(type)
    if (kind === 'device') {
      const iface = this.ifaceById.get(id)
      const node = iface ? this.nodeOfDevice.get(iface.device.id) : undefined
      if (!iface || !node) return undefined
      return { node, port: this.devicePort(iface), iface: { kind, id: iface.id } }
    }
    if (kind === 'vm') {
      const iface = this.vmIfaceById.get(id)
      const node = iface ? this.nodeOfVm.get(iface.virtual_machine.id) : undefined
      if (!iface || !node) return undefined
      return { node, port: this.topVmInterface(iface).name, iface: { kind, id: iface.id } }
    }
    return undefined
  }

  private topVmInterface(iface: NetBoxVMInterface): NetBoxVMInterface {
    let current = iface
    for (let hops = 0; hops < 8; hops++) {
      const next = current.parent ? this.vmIfaceById.get(current.parent.id) : undefined
      if (!next) break
      current = next
    }
    return current
  }

  // ------------------------------------------
  // Segments
  // ------------------------------------------

  private vlanSegment(vlan: NetBoxVlanRef): string {
    const repeated = (this.vlanPks.get(vlan.vid)?.size ?? 0) > 1
    const id = repeated ? `vlan-${vlan.vid}-${vlan.id}` : `vlan-${vlan.vid}`
    if (!this.segments.has(id)) {
      const name = this.vlanById.get(vlan.id)?.name ?? vlan.name
      this.segments.set(id, {
        id,
        ...(name && { label: name }),
        vlan: vlan.vid,
        vlanPk: vlan.id,
        prefixes: [],
        addresses: new Map(),
      })
    }
    return id
  }

  /** The segment a prefix is: its VLAN's when it has one, else one of its own. */
  private prefixSegment(prefix: NetBoxPrefix): string {
    if (prefix.vlan) return this.vlanSegment(prefix.vlan)
    const vrf = prefix.vrf ? this.data.vrfs.find((v) => v.id === prefix.vrf?.id) : undefined
    const vrfName = vrf?.name ?? prefix.vrf?.name
    const base = `prefix-${prefix.prefix.replace('/', '-')}`
    const id = prefix.vrf ? `${base}-${slug(vrfName ?? String(prefix.vrf.id))}` : base
    if (!this.segments.has(id)) {
      // NetBox names such a segment by nothing but its prefix; the id is made, not written.
      this.segments.set(id, {
        id,
        label: prefix.prefix,
        prefixes: [prefix.prefix],
        ...(prefix.vrf && { vrf: prefix.vrf.id }),
        addresses: new Map(),
      })
    }
    return id
  }

  /** The routable prefix an address sits in, in its VRF. */
  private prefixOf(address: string, vrf: number | null): NetBoxPrefix | undefined {
    return this.prefixIndex.longestMatch(address, vrf)
  }

  /** The prefixes the addresses assigned straight to an interface sit in. */
  private interfacePrefixes(end: End | undefined): NetBoxPrefix[] {
    if (!end?.iface) return []
    const ips = this.ipsByIface.get(`${end.iface.kind}:${end.iface.id}`) ?? []
    const found = new Map<number, NetBoxPrefix>()
    for (const ip of ips) {
      const prefix = this.prefixOf(ip.address, ip.vrf?.id ?? null)
      if (prefix) found.set(prefix.id, prefix)
    }
    return [...found.values()]
  }

  /** The prefixes both ends have an address in: a link between them carries that network. */
  private sharedPrefixSegments(a: End | undefined, b: End | undefined): string[] {
    const inB = new Set(this.interfacePrefixes(b).map((p) => p.id))
    return this.interfacePrefixes(a)
      .filter((p) => inB.has(p.id))
      .map((p) => this.prefixSegment(p))
  }

  // ------------------------------------------
  // Links
  // ------------------------------------------

  private newLink(base: string, endpoints: [input.Endpoint, input.Endpoint]): LinkDraft {
    let id = base
    for (let n = 2; this.links.has(id); n++) id = `${base}-${n}`
    const draft: LinkDraft = { id, endpoints, segments: [], descriptions: [] }
    this.links.set(id, draft)
    return draft
  }

  private addSegments(link: LinkDraft, ids: readonly string[]): void {
    for (const id of ids) if (!link.segments.includes(id)) link.segments.push(id)
  }

  private macOf(iface: NetBoxInterface | undefined): string | undefined {
    return iface?.primary_mac_address?.mac_address
  }

  /** The VLAN segments an interface's end of a link carries, with its subinterfaces and LAG. */
  private carriedVlans(iface: NetBoxInterface | undefined): string[] {
    if (!iface) return []
    const lag = iface.lag ? this.ifaceById.get(iface.lag.id) : undefined
    // `tagged-all` carries every VLAN: listing some would claim the others are not carried.
    if (iface.mode?.value === 'tagged-all' || lag?.mode?.value === 'tagged-all') return []
    const sources = [iface, ...(this.childrenOf.get(iface.id) ?? [])]
    if (lag) sources.push(lag, ...(this.childrenOf.get(lag.id) ?? []))
    const vlans = new Map<number, NetBoxVlanRef>()
    for (const source of sources) {
      for (const vlan of [source.untagged_vlan, ...(source.tagged_vlans ?? [])]) {
        if (vlan) vlans.set(vlan.id, vlan)
      }
    }
    return [...vlans.values()].sort((a, b) => a.vid - b.vid).map((v) => this.vlanSegment(v))
  }

  private speedOf(iface: NetBoxInterface | undefined): number | undefined {
    if (!iface) return undefined
    return leastKnown(iface.speed ?? nominalSpeedFromInterfaceType(iface.type?.value))
  }

  private buildCabledLinks(): void {
    // A circuit that is not drawn takes the cabled paths through it with it.
    for (const circuit of this.data.circuits) {
      if (this.isCircuitLive(circuit.status)) continue
      for (const term of this.termsByCircuit.get(circuit.id) ?? []) {
        if (term.link_peers_type !== 'dcim.interface') continue
        for (const peer of term.link_peers ?? []) this.droppedIfaces.add(peer.id)
      }
    }

    for (const iface of this.data.interfaces) {
      const node = this.nodeOfDevice.get(iface.device.id)
      if (!node || !iface.cable || iface.wireless_link || this.droppedIfaces.has(iface.id)) continue
      const ends = iface.connected_endpoints ?? []
      if (
        iface.connected_endpoints_reachable &&
        iface.connected_endpoints_type === 'dcim.interface'
      ) {
        for (const end of ends) this.cabledLink(iface, node, end)
      } else if (
        iface.connected_endpoints_reachable &&
        iface.connected_endpoints_type === 'circuits.providernetwork'
      ) {
        for (const end of ends) this.providerNetworkLink(iface, node, end.id)
      } else if (ends.length === 0 && iface.link_peers_type === 'circuits.circuittermination') {
        this.providerLink(iface, node)
      }
    }
  }

  private cabledLink(
    iface: NetBoxInterface,
    nodeA: string,
    end: NonNullable<NetBoxInterface['connected_endpoints']>[number],
  ): void {
    const deviceId = end.device?.id
    if (deviceId === undefined || this.excludedDevices.has(deviceId)) return
    const nodeB = this.nodeOfDevice.get(deviceId)
    if (!nodeB || nodeB === nodeA) return
    const far = this.ifaceById.get(end.id)
    if (far && this.droppedIfaces.has(far.id)) return
    const portA = iface.name
    const portB = far?.name ?? end.name
    if (!portB) return

    const a: End = { node: nodeA, port: portA, iface: { kind: 'device', id: iface.id } }
    const b: End = {
      node: nodeB,
      port: portB,
      ...(far && { iface: { kind: 'device' as const, id: far.id } }),
    }
    const [first, second] = [a, b].sort((x, y) => compare(endKey(x), endKey(y))) as [End, End]
    const key = `${endKey(first)}--${endKey(second)}`
    if (this.seenPaths.has(key)) return
    this.seenPaths.add(key)

    const link = this.newLink(`path-${key}`, [
      { node: first.node, port: first.port },
      { node: second.node, port: second.port },
    ])
    this.usePort(nodeA, portA, this.macOf(iface))
    this.usePort(nodeB, portB, this.macOf(far))
    link.speedKbps = leastKnown(this.speedOf(iface), this.speedOf(far))

    const cableId = directCableId(iface)
    const cable = cableId !== undefined ? this.cableById.get(cableId) : undefined
    if (cable?.type) link.cable = cable.type
    if (cable?.length && cable.length_unit) {
      const length = lengthOf(cable.length, cable.length_unit.value)
      if (length) link.length = length
    }
    if (cable?.label) link.label = cable.label

    this.addSegments(link, [...this.carriedVlans(iface), ...this.carriedVlans(far)])
    this.addSegments(link, this.sharedPrefixSegments(a, b))
    link.connection = this.lagConnection(iface, nodeA, far, nodeB)
    this.linkOfIface.set(iface.id, link)
    if (far) this.linkOfIface.set(far.id, link)
  }

  /** The LAG the two ends belong to, as one connection; one-sided is still a connection. */
  private lagConnection(
    a: NetBoxInterface,
    nodeA: string,
    b: NetBoxInterface | undefined,
    nodeB: string,
  ): string | undefined {
    const lagEnd = (iface: NetBoxInterface | undefined, node: string) => {
      if (!iface?.lag) return undefined
      const device = iface.lag.device?.id
      const owner = device !== undefined ? (this.nodeOfDevice.get(device) ?? node) : node
      return { node: owner, name: iface.lag.name }
    }
    const first = lagEnd(a, nodeA)
    const second = lagEnd(b, nodeB)
    if (!first && !second) return undefined
    if (first && second) {
      const [x, y] = [first, second].sort((p, q) =>
        compare(`${p.node}-${p.name}`, `${q.node}-${q.name}`),
      ) as [typeof first, typeof second]
      const id = `lag-${x.node}-${x.name}--${y.node}-${y.name}`
      this.connections.set(id, { id, label: `${x.name} ⇄ ${y.name}` })
      return id
    }
    const near = first ?? second
    const farNode = first ? nodeB : nodeA
    if (!near) return undefined
    const id = `lag-${near.node}-${near.name}--${farNode}`
    this.connections.set(id, { id, label: near.name })
    return id
  }

  private providerNetworkLink(iface: NetBoxInterface, node: string, pnId: number): void {
    const pn = this.pnById.get(pnId)
    if (!pn) return
    const peer =
      iface.link_peers_type === 'circuits.circuittermination' ? iface.link_peers?.[0] : undefined
    const circuit = peer?.circuit ? this.circuitById.get(peer.circuit.id) : undefined
    if (circuit && !this.isCircuitLive(circuit.status)) return
    const external = this.pnNode(pn)
    this.circuitLink(iface, node, external, {
      circuit,
      cid: circuit?.cid ?? peer?.circuit?.cid,
      termination: peer ? this.termById.get(peer.id) : undefined,
      providerName: circuit?.provider?.name ?? pn.provider?.name,
    })
  }

  /** A circuit whose far side is not modelled: the provider stands for what lies beyond. */
  private providerLink(iface: NetBoxInterface, node: string): void {
    const peer = iface.link_peers?.[0]
    const circuit = peer?.circuit ? this.circuitById.get(peer.circuit.id) : undefined
    if (!peer || !circuit?.provider || !this.isCircuitLive(circuit.status)) return
    const other = (this.termsByCircuit.get(circuit.id) ?? []).find((t) => t.id !== peer.id)
    if (other?.cable || other?.termination_type === 'circuits.providernetwork') return
    const external = this.providerNode(circuit.provider)
    this.circuitLink(iface, node, external, {
      circuit,
      cid: circuit.cid,
      termination: this.termById.get(peer.id),
      providerName: circuit.provider.name,
    })
  }

  private circuitLink(
    iface: NetBoxInterface,
    node: string,
    external: string,
    circuit: {
      circuit?: NetBoxCircuit
      cid?: string
      termination?: NetBoxCircuitTermination
      providerName?: string
    },
  ): void {
    const { cid } = circuit
    const base = cid ? `circuit-${cid}` : `path-${node}-${iface.name}--${external}`
    const link = this.newLink(base, [
      { node, port: iface.name },
      { node: external, ...(cid && { port: cid }) },
    ])
    this.usePort(node, iface.name, this.macOf(iface))
    if (cid) this.usePort(external, cid)
    link.speedKbps = leastKnown(iface.speed, circuit.termination?.port_speed)
    if (circuit.circuit?.commit_rate) link.bandwidthKbps = circuit.circuit.commit_rate
    if (cid) link.descriptions.push([circuit.providerName, cid].filter(Boolean).join(' '))
    if (circuit.circuit && circuit.circuit.status?.value !== 'active') link.dashed = true
    if (circuit.circuit?.type?.slug) link.circuitType = circuit.circuit.type.slug
    // The handoff network: the provider side is in the prefix the near address sits in.
    const near: End = { node, port: iface.name, iface: { kind: 'device', id: iface.id } }
    this.addSegments(
      link,
      this.interfacePrefixes(near).map((p) => this.prefixSegment(p)),
    )
  }

  /** A circuit between two of our devices names the link its path already gave. */
  private annotateCircuits(): void {
    for (const circuit of this.data.circuits) {
      if (!this.isCircuitLive(circuit.status)) continue
      const terms = this.termsByCircuit.get(circuit.id) ?? []
      const links = new Set<LinkDraft>()
      for (const term of terms) {
        if (term.link_peers_type !== 'dcim.interface') continue
        for (const peer of term.link_peers ?? []) {
          const link = this.linkOfIface.get(peer.id)
          if (link) links.add(link)
        }
      }
      for (const link of links) {
        const text = [circuit.provider?.name, circuit.cid].filter(Boolean).join(' ')
        if (text) link.descriptions.push(text)
        link.speedKbps = leastKnown(link.speedKbps, ...terms.map((t) => t.port_speed))
        if (circuit.commit_rate) link.bandwidthKbps = circuit.commit_rate
        if (circuit.status?.value !== 'active') link.dashed = true
        if (circuit.type?.slug) link.circuitType = circuit.type.slug
      }
    }
  }

  // ------------------------------------------
  // Virtual links
  // ------------------------------------------

  /** Pairs of ends joined by a tunnel or a virtual circuit, by the role each termination has. */
  private pairs(ends: Array<{ role: string; end: End }>): Array<[End, End]> {
    const of = (role: string) => ends.filter((e) => e.role === role).map((e) => e.end)
    const peers = of('peer')
    const result: Array<[End, End]> = []
    for (const [i, x] of peers.entries()) {
      for (const y of peers.slice(i + 1)) result.push([x, y])
    }
    for (const hub of of('hub')) {
      for (const spoke of of('spoke')) result.push([spoke, hub])
    }
    return result
  }

  private virtualLink(
    base: string,
    [a, b]: [End, End],
    description: string | undefined,
  ): LinkDraft | undefined {
    if (a.node === b.node) return undefined
    const link = this.newLink(base, [
      { node: a.node, port: a.port },
      { node: b.node, port: b.port },
    ])
    link.virtual = true
    if (description) link.descriptions.push(description)
    this.usePort(a.node, a.port)
    this.usePort(b.node, b.port)
    return link
  }

  private buildTunnels(): void {
    const byTunnel = new Map<number, Array<{ role: string; end: End }>>()
    for (const term of this.data.tunnelTerminations) {
      const end = this.endOfInterface(term.termination_type, term.termination_id)
      if (!end) continue
      const list = byTunnel.get(term.tunnel.id) ?? []
      list.push({ role: term.role?.value ?? 'peer', end })
      byTunnel.set(term.tunnel.id, list)
    }
    for (const tunnel of this.data.tunnels) {
      if (tunnel.status?.value === 'planned') continue
      const pairs = this.pairs(byTunnel.get(tunnel.id) ?? [])
      const group = tunnel.group
        ? this.data.tunnelGroups.find((g) => g.id === tunnel.group?.id)
        : undefined
      for (const [n, pair] of pairs.entries()) {
        const description = [tunnel.encapsulation?.value, tunnel.name].filter(Boolean).join(' ')
        const base = `tunnel-${slug(tunnel.name)}${pairs.length > 1 ? `-${n + 1}` : ''}`
        const link = this.virtualLink(base, pair, description)
        if (!link) continue
        this.addSegments(link, this.sharedPrefixSegments(pair[0], pair[1]))
        const ref = group ?? tunnel.group
        if (ref) {
          const id = `tunnel-group-${ref.slug ?? slug(ref.name ?? String(ref.id))}`
          this.connections.set(id, { id, label: ref.name ?? id })
          link.connection = id
        }
      }
    }
  }

  private buildVirtualCircuits(): void {
    const byCircuit = new Map<number, Array<{ role: string; end: End }>>()
    const count = new Map<number, number>()
    for (const term of this.data.virtualCircuitTerminations) {
      count.set(term.virtual_circuit.id, (count.get(term.virtual_circuit.id) ?? 0) + 1)
      const end = term.interface
        ? this.endOfInterface('dcim.interface', term.interface.id)
        : undefined
      if (!end) continue
      const list = byCircuit.get(term.virtual_circuit.id) ?? []
      list.push({ role: term.role?.value ?? 'peer', end })
      byCircuit.set(term.virtual_circuit.id, list)
    }
    for (const vc of this.data.virtualCircuits) {
      if (!this.isCircuitLive(vc.status)) continue
      const pn = vc.provider_network ? this.pnById.get(vc.provider_network.id) : undefined
      const description = [pn?.name ?? vc.provider_network?.name, vc.cid].filter(Boolean).join(' ')
      const ends = byCircuit.get(vc.id) ?? []
      if (count.get(vc.id) === 1 && ends.length === 1 && ends[0] && pn) {
        // The far side of a lone termination is the provider network, by definition.
        const external = this.pnNode(pn)
        this.virtualLink(
          `vcircuit-${vc.cid}-1`,
          [ends[0].end, { node: external, port: vc.cid }],
          description,
        )
        continue
      }
      for (const [n, pair] of this.pairs(ends).entries()) {
        this.virtualLink(`vcircuit-${vc.cid}-${n + 1}`, pair, description)
      }
    }
  }

  private buildL2vpns(): void {
    const byL2vpn = new Map<number, End[]>()
    for (const term of this.data.l2vpnTerminations) {
      const end = this.endOfInterface(term.assigned_object_type, term.assigned_object_id)
      if (!end) continue
      const list = byL2vpn.get(term.l2vpn.id) ?? []
      if (!list.some((e) => e.node === end.node && e.port === end.port)) list.push(end)
      byL2vpn.set(term.l2vpn.id, list)
    }
    for (const l2vpn of this.data.l2vpns) {
      if (l2vpn.status?.value === 'planned') continue
      const ends = byL2vpn.get(l2vpn.id) ?? []
      if (ends.length === 0) continue
      const type = l2vpn.type?.value ?? ''
      const [first, second] = ends
      if (POINT_TO_POINT_L2VPN.has(type) && ends.length === 2 && first && second) {
        this.virtualLink(`l2vpn-${l2vpn.slug}`, [first, second], `${type} ${l2vpn.name}`)
        continue
      }
      // A shared network: a segment, and each terminated interface joined to it.
      const id = this.claimSegment(`l2vpn-${l2vpn.slug}`)
      this.segments.set(id, { id, label: l2vpn.name, prefixes: [], addresses: new Map() })
      for (const end of ends) {
        const link = this.newLink(`l2vpn-${l2vpn.slug}-${end.node}-${end.port}`, [
          { node: end.node, port: end.port },
          { segment: id },
        ])
        link.virtual = true
        this.usePort(end.node, end.port)
      }
    }
  }

  private claimSegment(base: string): string {
    let id = base
    for (let n = 2; this.segments.has(id); n++) id = `${base}-${n}`
    return id
  }

  private buildWirelessLinks(): void {
    for (const wireless of this.data.wirelessLinks) {
      if (wireless.status?.value === 'planned') continue
      const ends = [wireless.interface_a, wireless.interface_b].map((ref) => {
        const iface = this.ifaceById.get(ref.id)
        const deviceId = iface?.device.id ?? ref.device?.id
        const node = deviceId !== undefined ? this.nodeOfDevice.get(deviceId) : undefined
        return node ? { node, port: iface ? this.devicePort(iface) : ref.name } : undefined
      })
      const [a, b] = ends
      if (!a || !b || a.node === b.node) continue
      const distance =
        wireless.distance && wireless.distance_unit
          ? `${wireless.distance}${wireless.distance_unit.value}`
          : undefined
      // A radio path is neither a cable nor virtual: the medium goes in the words.
      const description = ['wireless', wireless.ssid].filter(Boolean).join(' ')
      const link = this.newLink(`wireless-${wireless.id}`, [
        { node: a.node, port: a.port },
        { node: b.node, port: b.port },
      ])
      link.descriptions.push([description, distance].filter(Boolean).join(', '))
      this.usePort(a.node, a.port)
      this.usePort(b.node, b.port)
    }
  }

  /** A VM's adapter in a VLAN: the VM is joined to that segment, with no cable of its own. */
  private buildVmAdapters(): void {
    for (const iface of this.data.vmInterfaces) {
      if (iface.parent) continue
      const node = this.nodeOfVm.get(iface.virtual_machine.id)
      if (!node) continue
      if (iface.mode?.value === 'tagged-all') continue
      const vlans = new Map<number, NetBoxVlanRef>()
      for (const source of [iface, ...(this.vmChildrenOf.get(iface.id) ?? [])]) {
        for (const vlan of [source.untagged_vlan, ...(source.tagged_vlans ?? [])]) {
          if (vlan) vlans.set(vlan.id, vlan)
        }
      }
      for (const vlan of [...vlans.values()].sort((a, b) => a.vid - b.vid)) {
        const segment = this.vlanSegment(vlan)
        const link = this.newLink(`vm-${node}-${iface.name}-${segment}`, [
          { node, port: iface.name },
          { segment },
        ])
        link.virtual = true
        this.usePort(node, iface.name, iface.primary_mac_address?.mac_address)
      }
    }
  }

  // ------------------------------------------
  // Addresses
  // ------------------------------------------

  /** Writes every address into the segment it sits in; a primary address with none is the node's. */
  private placeAddresses(): void {
    const byNode = new Map<string, Map<string, { address: string; vrf: number | null }>>()
    const note = (node: string, address: string, vrf: number | null) => {
      const list = byNode.get(node) ?? new Map()
      const host = hostOf(address)
      if (!list.has(host)) list.set(host, { address, vrf })
      byNode.set(node, list)
    }
    for (const ip of this.data.ipAddresses) {
      const kind = ownerKind(ip.assigned_object_type)
      if (!kind || ip.assigned_object_id === null || ip.assigned_object_id === undefined) continue
      const node = this.nodeOfInterface(ip.assigned_object_type ?? '', ip.assigned_object_id)
      if (node) note(node, ip.address, ip.vrf?.id ?? null)
    }

    const primaries = new Map<string, { address: string; vrf: number | null }>()
    for (const [pk, node] of this.nodeOfDevice)
      this.notePrimary(primaries, node, this.deviceById.get(pk))
    for (const [pk, node] of this.nodeOfVm) this.notePrimary(primaries, node, this.vmById.get(pk))
    for (const [node, primary] of primaries) note(node, primary.address, primary.vrf)

    for (const [node, addresses] of [...byNode].sort(([x], [y]) => compare(x, y))) {
      const placed = new Set<string>()
      const loose: string[] = []
      for (const [host, { address, vrf }] of addresses) {
        const prefix = this.prefixOf(address, vrf)
        if (!prefix) {
          loose.push(host)
          continue
        }
        this.addAddress(this.prefixSegment(prefix), node, host)
        placed.add(host)
      }
      const primary = primaries.get(node)
      const primaryHost = primary ? hostOf(primary.address) : undefined
      const rest = loose.filter((host) => host !== primaryHost)
      const target = this.nodes.get(node)
      if (target && primaryHost && !placed.has(primaryHost)) target.address = primaryHost
      if (rest.length > 0) this.observe(node).metadata['unsegmentedAddresses'] = rest
    }

    for (const group of this.data.fhrpGroups) {
      const holder = this.fhrpHolder.get(group.id)
      if (!holder) continue
      for (const vip of group.ip_addresses ?? []) {
        const full = this.ipById.get(vip.id)
        const prefix = this.prefixOf(vip.address, full?.vrf?.id ?? null)
        if (prefix) this.addAddress(this.prefixSegment(prefix), holder, hostOf(vip.address))
      }
    }
  }

  private notePrimary(
    into: Map<string, { address: string; vrf: number | null }>,
    node: string,
    record: NetBoxDevice | NetBoxVirtualMachine | undefined,
  ): void {
    const ip = record?.primary_ip4 ?? record?.primary_ip6
    if (!ip) return
    const vrf = ip.id !== undefined ? (this.ipById.get(ip.id)?.vrf?.id ?? null) : null
    into.set(node, { address: ip.address, vrf })
  }

  private addAddress(segment: string, holder: string, host: string): void {
    const draft = this.segments.get(segment)
    if (!draft) return
    const list = draft.addresses.get(holder) ?? []
    if (!list.includes(host)) list.push(host)
    draft.addresses.set(holder, list)
  }

  // ------------------------------------------
  // Output
  // ------------------------------------------

  private output(): SourceNetwork {
    const segments = this.finishSegments()
    const domains = this.finishRoutingDomains(segments)
    const groups = this.finishGroups()
    const links = [...this.links.values()].sort((a, b) => compare(a.id, b.id))
    const connectionIds = new Set(links.flatMap((l) => (l.connection ? [l.connection] : [])))

    const observedNodes: Record<
      string,
      NodeObservation & {
        ports?: Record<string, PortObservation>
        metadata?: Record<string, unknown>
      }
    > = {}
    const nodes = [...this.nodes.values()].sort((a, b) => compare(a.id, b.id))
    for (const node of nodes) {
      const observed = this.observed.get(node.id)
      const ports: Record<string, PortObservation> = {}
      for (const [port, mac] of this.ports.get(node.id) ?? []) {
        const identity = buildIdentity({ ifName: port, mac })
        ports[port] = identity ? { identity } : {}
      }
      const metadata = observed?.metadata ?? {}
      observedNodes[node.id] = {
        ...(observed?.identity && { identity: observed.identity }),
        ...(Object.keys(ports).length > 0 && { ports }),
        ...(Object.keys(metadata).length > 0 && { metadata }),
      }
    }

    const observedLinks: Record<string, { metadata: Record<string, unknown> }> = {}
    const drawnLinks: Record<string, LinkDrawing> = {}
    const outLinks: input.Link[] = links.map((draft) => {
      if (draft.circuitType)
        observedLinks[draft.id] = { metadata: { circuitType: draft.circuitType } }
      const drawing: LinkDrawing = {
        ...(draft.label && { label: draft.label }),
        ...(draft.dashed && { type: 'dashed' as const }),
      }
      if (Object.keys(drawing).length > 0) drawnLinks[draft.id] = drawing
      return linkOf(draft)
    })

    const network: input.Network = {
      ...(groups.length > 0 && { groups }),
      ...(domains.length > 0 && { routingDomains: domains }),
      ...(connectionIds.size > 0 && {
        connections: [...this.connections.values()]
          .filter((c) => connectionIds.has(c.id))
          .sort((a, b) => compare(a.id, b.id)),
      }),
      ...(segments.length > 0 && { segments }),
      ...(this.redundancy.size > 0 && {
        redundancy: [...this.redundancy.values()].sort((a, b) => compare(a.id, b.id)),
      }),
      nodes,
      links: outLinks,
    }

    return {
      network,
      observation: {
        nodes: observedNodes,
        ...(Object.keys(observedLinks).length > 0 && { links: observedLinks }),
      },
      ...(Object.keys(drawnLinks).length > 0 && { drawing: { links: drawnLinks } }),
    }
  }

  private finishSegments(): input.Segment[] {
    const result: input.Segment[] = []
    for (const draft of [...this.segments.values()].sort((a, b) => compare(a.id, b.id))) {
      const prefixes = [...draft.prefixes]
      let vrf = draft.vrf
      let group = draft.group
      if (draft.vlanPk !== undefined) {
        const own = this.data.prefixes.filter(
          (p) => p.vlan?.id === draft.vlanPk && p.status?.value !== 'container',
        )
        for (const p of own) if (!prefixes.includes(p.prefix)) prefixes.push(p.prefix)
        const vrfs = new Set(own.map((p) => p.vrf?.id ?? null))
        const only = vrfs.size === 1 ? [...vrfs][0] : undefined
        if (only !== undefined && only !== null) vrf = only
        for (const p of own) {
          group = group ?? this.scopeGroup(p.scope_type, p.scope_id)
        }
      } else if (prefixes[0]) {
        const own = this.data.prefixes.find(
          (p) => p.prefix === prefixes[0] && (p.vrf?.id ?? null) === (vrf ?? null),
        )
        group = this.scopeGroup(own?.scope_type, own?.scope_id)
      }
      const addresses: Record<string, input.OneOrMore<string>> = {}
      for (const [holder, list] of [...draft.addresses].sort(([x], [y]) => compare(x, y))) {
        const value = oneOrMore([...list].sort(compare))
        if (value) addresses[holder] = value
      }
      const prefix = oneOrMore(prefixes)
      result.push({
        id: draft.id,
        ...(draft.label && { label: draft.label }),
        ...(draft.vlan !== undefined && { vlan: draft.vlan }),
        ...(prefix && { prefix }),
        ...(vrf !== undefined && { routingDomain: this.domainId(vrf) }),
        ...(group && { group }),
        ...(Object.keys(addresses).length > 0 && { addresses }),
      })
    }
    return result
  }

  private readonly domainIds = new Map<number, string>()

  private domainId(vrf: number): string {
    const existing = this.domainIds.get(vrf)
    if (existing) return existing
    const name = this.data.vrfs.find((v) => v.id === vrf)?.name
    const base = `vrf-${slug(name ?? String(vrf))}`
    let id = base
    const taken = new Set(this.domainIds.values())
    if (taken.has(id)) id = `${base}-${vrf}`
    this.domainIds.set(vrf, id)
    return id
  }

  /** A routing domain is written for each VRF a segment names, with its top containers. */
  private finishRoutingDomains(segments: readonly input.Segment[]): input.RoutingDomain[] {
    const named = new Set(segments.flatMap((s) => (s.routingDomain ? [s.routingDomain] : [])))
    const result: input.RoutingDomain[] = []
    for (const [vrf, id] of this.domainIds) {
      if (!named.has(id)) continue
      const record = this.data.vrfs.find((v) => v.id === vrf)
      const containers = this.data.prefixes
        .filter((p) => p.vrf?.id === vrf && p.status?.value === 'container')
        .map((p) => p.prefix)
      const top = containers.filter(
        (p) => !containers.some((other) => other !== p && contains(other, p)),
      )
      const prefix = oneOrMore(top.sort(compare))
      result.push({
        id,
        ...(record?.name && { label: record.name }),
        ...(prefix && { prefix }),
      })
    }
    return result.sort((a, b) => compare(a.id, b.id))
  }

  private finishGroups(): input.Group[] {
    const childrenOf = new Map<string | undefined, GroupDraft[]>()
    for (const group of this.groups.values()) {
      const list = childrenOf.get(group.parent) ?? []
      list.push(group)
      childrenOf.set(group.parent, list)
    }
    const build = (parent: string | undefined): input.Group[] =>
      (childrenOf.get(parent) ?? [])
        .sort((a, b) => compare(a.id, b.id))
        .map((g): input.Group => {
          const children = build(g.id)
          return { id: g.id, label: g.label, ...(children.length > 0 && { groups: children }) }
        })
    return build(undefined)
  }
}

// ============================================
// Free helpers
// ============================================

/** `dcim.interface` belongs to a device, `virtualization.vminterface` to a VM. */
function ownerKind(type: string | null | undefined): NodeKind | undefined {
  if (type === 'dcim.interface') return 'device'
  if (type === 'virtualization.vminterface') return 'vm'
  return undefined
}

function endKey(end: End): string {
  return `${end.node}-${end.port}`
}

function linkOf(draft: LinkDraft): input.Link {
  const speed = draft.speedKbps ? rateOf(draft.speedKbps) : undefined
  // A rate below the speed is a cap; at or above it, it says nothing.
  const bandwidth =
    draft.bandwidthKbps && (!draft.speedKbps || draft.bandwidthKbps < draft.speedKbps)
      ? rateOf(draft.bandwidthKbps)
      : undefined
  const description = draft.descriptions.filter(Boolean).join(', ')
  return {
    id: draft.id,
    endpoints: draft.endpoints,
    ...(speed && { speed }),
    ...(bandwidth && { bandwidth }),
    ...(draft.cable && { cable: draft.cable }),
    ...(draft.length && { length: draft.length }),
    ...(draft.segments.length > 0 && { segments: draft.segments }),
    ...(description && { description }),
    ...(draft.connection && { connection: draft.connection }),
    ...(draft.virtual && { virtual: true as const }),
  }
}

/**
 * Convert what NetBox knows to what the source discovered, in the input's shape: the network, how
 * each node is recognized, and the little a source says of how it is drawn.
 */
export function convertToSourceNetwork(
  data: NetBoxData,
  options: ConverterOptions = {},
): SourceNetwork {
  return new Mapper(data, options).run()
}

/** The network YAML from NetBox data. */
export function toYaml(data: NetBoxData, options: ConverterOptions = {}): string {
  return writeNetworkModel({ config: convertToSourceNetwork(data, options).network })
}
