/**
 * NetBox to Shumoku network converter: what NetBox knows, as a SourceNetwork or the network YAML.
 */

// ============================================
// Imports
// ============================================

import {
  buildIdentity,
  type inputModel as input,
  type LinkDrawing,
  type NodeDesign,
  type NodeDrawing,
  type NodeObservation,
  type PortDesign,
  type PortObservation,
  rateFromBps,
  type SourceNetwork,
  type SubgraphDrawing,
  writeNetworkModel,
} from '@shumoku/core'

import type {
  ConnectionData,
  ConverterOptions,
  DeviceData,
  DeviceStatusValue,
  GroupBy,
  NetBoxCableResponse,
  NetBoxCircuitResponse,
  NetBoxCircuitTerminationResponse,
  NetBoxDeviceResponse,
  NetBoxInterfaceResponse,
  NetBoxTag,
  NetBoxVirtualMachineResponse,
  TagMapping,
} from './types.js'

import {
  CABLE_STYLES,
  DEFAULT_TAG_MAPPING,
  DEVICE_STATUS_STYLES,
  nominalSpeedFromInterfaceType,
  ROLE_TO_TYPE,
  TAG_PRIORITY,
} from './types.js'

// ============================================
// Types
// ============================================

/**
 * Device info extracted from NetBox
 */
interface DeviceInfo {
  name: string
  site?: string
  location?: string
  rack?: string
  tags: NetBoxTag[]
  model?: string
  manufacturer?: string
  ip?: string
  role?: string
  status?: DeviceStatusValue
}

/** Region that holds synthesized provider boundary nodes (keeps them in scope). */
const UPSTREAM_SUBGRAPH_ID = 'upstream'

/** A group as the builders know it: its label and the style it is drawn with. */
interface GroupSpec {
  id: string
  label: string
  style?: SubgraphDrawing['style']
}

/** A synthesized circuit-provider boundary and the handoff ports it needs. */
interface Provider {
  id: string
  name: string
  portIds: string[]
}

/** A circuit end resolved to the device interface it is cabled to. */
interface CircuitEndpoint {
  device: string
  port: string
  speed: number | null
  /** Type of the real cable at this end (joined from the fetched cable list). */
  cableType?: string
}

// ============================================
// Style Constants (using surface tokens)
// ============================================

/**
 * Surface tokens by hierarchy level (for tag-based grouping)
 * These tokens are resolved by the renderer based on the current theme
 */
const SUBGRAPH_TOKENS: Record<number, string> = {
  0: 'accent-blue', // OCX - Blue
  1: 'accent-green', // ONU - Green
  2: 'accent-amber', // Router - Orange/Amber
  3: 'surface-2', // Core Switch - Neutral
  4: 'accent-purple', // Edge Switch - Purple
  5: 'accent-red', // Server/AP - Red
  6: 'surface-3', // Console - Gray
}

/**
 * Surface tokens for site/location/prefix grouping
 * Cycles through available accent colors
 */
const GROUPING_TOKENS = [
  'accent-blue',
  'accent-green',
  'accent-amber',
  'accent-purple',
  'accent-red',
  'surface-2',
  'surface-3',
]

/**
 * Surface tokens for prefix/subnet grouping
 */
const PREFIX_TOKENS = [
  'accent-blue',
  'accent-green',
  'accent-amber',
  'accent-purple',
  'accent-red',
  'surface-2',
  'surface-3',
]

/** VM node style (dashed border) */
const VM_NODE_STYLE = {
  strokeDasharray: '4,4',
  opacity: 0.9,
}

// ============================================
// Main Conversion Functions
// ============================================

/** The virtual machines to draw alongside the devices. */
export interface VirtualMachineData {
  vms: NetBoxVirtualMachineResponse
}

type CircuitData = {
  circuits: NetBoxCircuitResponse
  terminations: NetBoxCircuitTerminationResponse
}

/** What both converters read from the NetBox responses before they shape the output. */
function collect(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  options: ConverterOptions,
  circuitData?: CircuitData,
) {
  const tagMapping = { ...DEFAULT_TAG_MAPPING, ...options.tagMapping }
  const groupBy: GroupBy = options.groupBy ?? (options.groupByTag === false ? 'none' : 'tag')

  // Build device maps
  const { deviceTagMap, deviceInfoMap } = buildDeviceMaps(deviceResp)

  // Build port maps
  const { portVlanMap, portSpeedMap } = buildPortMaps(interfaceResp)

  // Build devices and connections from cables
  const { devices, connections } = buildDevicesAndConnections(
    cableResp,
    deviceTagMap,
    deviceInfoMap,
    portVlanMap,
    portSpeedMap,
    tagMapping,
  )

  // Recover circuit links (device<->circuit cables the plain walker drops) and
  // any synthesized provider boundary nodes. Registers circuit-only devices
  // into `devices` before nodes/subgraphs are built.
  let providers: Provider[] = []
  if (circuitData) {
    const circuitResult = buildCircuitConnections(
      circuitData.circuits,
      circuitData.terminations,
      cableResp,
      devices,
      deviceTagMap,
      deviceInfoMap,
      tagMapping,
    )
    connections.push(...circuitResult.connections)
    providers = circuitResult.providers
  }

  // Emit the upstream region only when it actually holds a provider node, so a
  // topology with no synthesized providers gains no empty box.
  const subgraphs = buildSubgraphsByGroupBy(devices, tagMapping, groupBy)
  if (providers.length > 0) subgraphs.push({ id: UPSTREAM_SUBGRAPH_ID, label: 'Upstream' })

  return { tagMapping, groupBy, devices, connections, providers, subgraphs }
}

/**
 * Convert NetBox data to what the source discovered, in the input's shape: the network, how each
 * device is recognized, and how the source would have them drawn.
 */
export function convertToSourceNetwork(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  options: ConverterOptions = {},
  circuitData?: CircuitData,
  vmData?: VirtualMachineData,
): SourceNetwork {
  const showPorts = options.showPorts ?? true
  const colorByCableType = options.colorByCableType ?? true
  const useRoleForType = options.useRoleForType ?? true
  const colorByStatus = options.colorByStatus ?? false
  const groupVMsByCluster = options.groupVMsByCluster ?? false

  const { tagMapping, groupBy, devices, connections, providers, subgraphs } = collect(
    deviceResp,
    interfaceResp,
    cableResp,
    options,
    circuitData,
  )

  const nodes: input.Node[] = []
  const observedNodes: Record<
    string,
    NodeObservation & {
      ports?: Record<string, PortObservation>
      metadata?: Record<string, unknown>
    }
  > = {}
  const drawnNodes: Record<string, NodeDrawing> = {}
  const designedNodes: Record<string, NodeDesign & { ports: Record<string, PortDesign> }> = {}

  for (const device of devices.values()) {
    const type = resolveDeviceType(device, tagMapping[device.primaryTag], useRoleForType)
    const product = productPath(device.manufacturer, device.model)
    const parent = getNodeParent(device, groupBy)
    nodes.push({
      id: device.name,
      label: device.name,
      type,
      ...(product && { product }),
      ...(device.ip && { address: device.ip }),
      ...(parent && { group: parent }),
    })

    // Identity keys so the resolver clusters this device across rescans and
    // across sources (mgmtIp is the strongest node key; sysName is the fallback).
    // The zone tag goes on the node itself: the composite layout engine keys
    // zones off `metadata.location`.
    const location = device.location ?? device.site
    observedNodes[device.name] = {
      identity: buildIdentity({ mgmtIp: device.ip, sysName: device.name }),
      ...(location && { metadata: { location } }),
    }
    const status = colorByStatus && device.status ? statusStyle(device.status) : undefined
    drawnNodes[device.name] = { shape: 'rounded', ...(status && { style: status }) }
  }

  for (const provider of providers) {
    nodes.push({
      id: provider.id,
      label: provider.name,
      type: 'internet',
      group: UPSTREAM_SUBGRAPH_ID,
    })
    // A provider boundary is external: sysName-only identity keeps it distinct
    // across rescans without colliding with any device key. Each circuit's handoff
    // port is a key of its own.
    const ports: Record<string, PortObservation> = {}
    for (const portId of provider.portIds) ports[portId] = {}
    observedNodes[provider.id] = {
      identity: buildIdentity({ sysName: provider.id }),
      ports,
    }
    // The provider hands each circuit off on its own WAN port.
    const designed: Record<string, PortDesign> = {}
    for (const portId of provider.portIds)
      designed[portId] = { label: portId, role: 'wan', connectors: [] }
    designedNodes[provider.id] = { ports: designed }
    drawnNodes[provider.id] = { shape: 'rounded' }
  }

  const clusters =
    options.includeVMs && vmData && groupVMsByCluster ? clusterGroups(vmData.vms) : []
  if (options.includeVMs && vmData) {
    for (const vm of vmData.vms.results) {
      const ip = vm.primary_ip4?.address?.split('/')[0] ?? vm.primary_ip6?.address?.split('/')[0]
      const sizing: string[] = []
      if (vm.vcpus) sizing.push(`${vm.vcpus}vCPU`)
      if (vm.memory) sizing.push(`${Math.round(vm.memory / 1024)}GB`)
      const id = `vm-${vm.name}`
      nodes.push({
        id,
        label: vm.name,
        type: 'server',
        ...(ip && { address: ip }),
        ...(sizing.length > 0 && { description: sizing.join(' / ') }),
        ...(groupVMsByCluster && vm.cluster && { group: `cluster-${vm.cluster.slug}` }),
      })
      observedNodes[id] = {
        identity: buildIdentity({ mgmtIp: ip, sysName: vm.name }),
        metadata: {
          isVirtualMachine: true,
          cluster: vm.cluster?.slug,
          vcpus: vm.vcpus,
          memory: vm.memory,
          disk: vm.disk,
        },
      }
      const status =
        colorByStatus && vm.status?.value
          ? statusStyle(vm.status.value as DeviceStatusValue)
          : undefined
      drawnNodes[id] = { shape: 'rounded', style: { ...VM_NODE_STYLE, ...status } }
    }
  }

  const segments = new Map<string, input.Segment>()
  const links: input.Link[] = []
  const drawnLinks: Record<string, LinkDrawing> = {}
  for (const [index, conn] of connections.entries()) {
    const id = `link-${index}`
    const endpoint = (node: string, port: string): input.NodeEnd =>
      showPorts && port ? { node, port } : { node }
    const segmentIds: string[] = []
    for (const vlan of conn.vlans) {
      const segmentId = `vlan-${vlan}`
      segments.set(segmentId, { id: segmentId, vlan })
      segmentIds.push(segmentId)
    }
    links.push({
      id,
      endpoints: [endpoint(conn.srcDev, conn.srcPort), endpoint(conn.dstDev, conn.dstPort)],
      ...(conn.speed && conn.speed > 0 && { speed: rateFromBps(conn.speed * 1000) }),
      ...(conn.cableType && { cable: conn.cableType }),
      ...(segmentIds.length > 0 && { segments: segmentIds }),
    })
    drawnLinks[id] = linkDrawing(conn, colorByCableType)
  }

  const allGroups = [...subgraphs, ...clusters]
  const groups: input.Group[] = allGroups.map(({ id, label }) => ({ id, label }))
  const drawnGroups: Record<string, SubgraphDrawing> = {}
  for (const { id, style } of allGroups) if (style) drawnGroups[id] = { style }

  return {
    network: {
      name: 'Network Topology',
      description: 'Generated from NetBox',
      ...(groups.length > 0 && { groups }),
      ...(segments.size > 0 && { segments: [...segments.values()] }),
      nodes,
      links,
    },
    observation: { nodes: observedNodes },
    ...(Object.keys(designedNodes).length > 0 && { design: { nodes: designedNodes } }),
    drawing: {
      nodes: drawnNodes,
      links: drawnLinks,
      ...(Object.keys(drawnGroups).length > 0 && { groups: drawnGroups }),
      settings: {
        direction: 'TB',
        theme: options.theme ?? 'light',
        legend: options.legend,
      },
    },
  }
}

/** `vendor/model`, `vendor`, or `?/model`, lower-cased as the graph's spec has them. */
function productPath(manufacturer: string | undefined, model: string | undefined) {
  const vendor = manufacturer?.toLowerCase()
  const name = model?.toLowerCase()
  if (vendor && name) return `${vendor}/${name}`
  if (vendor) return vendor
  if (name) return `?/${name}`
  return undefined
}

/** How a link is drawn: its label, and the stroke and dash its cable gives it. */
function linkDrawing(conn: ConnectionData, colorByCableType: boolean): LinkDrawing {
  const drawing: LinkDrawing = { arrow: 'none' }
  if (colorByCableType) {
    if (conn.cableColor) {
      drawing.style = { stroke: conn.cableColor }
    } else if (conn.cableType) {
      const cableStyle = CABLE_STYLES[conn.cableType]
      if (cableStyle) {
        drawing.style = { stroke: cableStyle.color }
        if (cableStyle.type) drawing.type = cableStyle.type
      }
    }
  }
  // Dashed wins over cable-type styling (a planned circuit stays dashed even
  // when its fiber type would otherwise pick a solid colored stroke).
  if (conn.dashed) drawing.type = 'dashed'
  const label = [conn.cableLabel, conn.cableLength].filter(Boolean).join(' ')
  if (label) drawing.label = label
  return drawing
}

// ============================================
// Device & Port Map Builders
// ============================================

function buildDeviceMaps(deviceResp: NetBoxDeviceResponse) {
  const deviceTagMap = new Map<string, string>()
  const deviceInfoMap = new Map<string, Omit<DeviceInfo, 'name' | 'tags' | 'rack'>>()

  for (const device of deviceResp.results) {
    const deviceName = device.name ?? `noname-${device.id}`
    deviceTagMap.set(deviceName, resolvePrimaryTag(device.tags))
    deviceInfoMap.set(deviceName, {
      model: device.device_type?.model,
      manufacturer: device.device_type?.manufacturer?.name,
      ip: device.primary_ip4?.address?.split('/')[0] ?? device.primary_ip6?.address?.split('/')[0],
      role: device.role?.slug,
      site: device.site?.slug,
      location: device.location?.slug,
      status: device.status?.value,
    })
  }

  return { deviceTagMap, deviceInfoMap }
}

function buildPortMaps(interfaceResp: NetBoxInterfaceResponse) {
  const portVlanMap = new Map<string, Map<string, number[]>>()
  const portSpeedMap = new Map<string, Map<string, number | null>>()

  for (const iface of interfaceResp.results) {
    const devName = iface.device.name
    const portName = iface.name

    if (!portVlanMap.has(devName)) portVlanMap.set(devName, new Map())
    if (!portSpeedMap.has(devName)) portSpeedMap.set(devName, new Map())

    const vlans = new Set<number>()
    if (iface.untagged_vlan?.vid) vlans.add(iface.untagged_vlan.vid)
    for (const tv of iface.tagged_vlans) vlans.add(tv.vid)

    portVlanMap.get(devName)?.set(portName, Array.from(vlans))
    // Explicit operating speed wins; otherwise fall back to the nominal rate
    // encoded in the interface type (operators rarely populate `speed`).
    portSpeedMap
      .get(devName)
      ?.set(portName, iface.speed ?? nominalSpeedFromInterfaceType(iface.type?.value))
  }

  return { portVlanMap, portSpeedMap }
}

function buildDevicesAndConnections(
  cableResp: NetBoxCableResponse,
  deviceTagMap: Map<string, string>,
  deviceInfoMap: Map<string, Omit<DeviceInfo, 'name' | 'tags' | 'rack'>>,
  portVlanMap: Map<string, Map<string, number[]>>,
  portSpeedMap: Map<string, Map<string, number | null>>,
  tagMapping: Record<string, TagMapping>,
) {
  const devices = new Map<string, DeviceData>()
  const connections: ConnectionData[] = []

  for (const cable of cableResp.results) {
    if (!cable.a_terminations[0] || !cable.b_terminations[0]) continue

    const termA = cable.a_terminations[0].object
    const termB = cable.b_terminations[0].object

    // Skip if termination is not a device interface (e.g., circuit, console port, power port)
    if (!termA.device || !termB.device) continue

    const nameA = termA.device.name ?? `noname-${termA.device.id}`
    const nameB = termB.device.name ?? `noname-${termB.device.id}`

    const tagA = deviceTagMap.get(nameA)
    const tagB = deviceTagMap.get(nameB)

    // Skip cables where either device is not in the filtered device list
    if (!tagA || !tagB) continue

    const infoA = deviceInfoMap.get(nameA)
    const infoB = deviceInfoMap.get(nameB)
    const vlansA = portVlanMap.get(nameA)?.get(termA.name) ?? []
    const vlansB = portVlanMap.get(nameB)?.get(termB.name) ?? []
    const speedA = portSpeedMap.get(nameA)?.get(termA.name) ?? null
    const speedB = portSpeedMap.get(nameB)?.get(termB.name) ?? null

    registerDevice(devices, nameA, tagA, termA.name, vlansA, speedA, infoA)
    registerDevice(devices, nameB, tagB, termB.name, vlansB, speedB, infoB)

    const combinedVlans = [...new Set([...vlansA, ...vlansB])]
    // A link runs at the lower of its two ends (a 100G QSFP cabled to a 25G
    // breakout leg links at 25G); one-sided data falls back to the known end.
    const linkSpeed =
      speedA !== null && speedB !== null ? Math.min(speedA, speedB) : (speedA ?? speedB)
    const levelA = getLevelByTag(tagA, tagMapping)
    const levelB = getLevelByTag(tagB, tagMapping)

    const conn = createConnection(
      levelA <= levelB
        ? { name: nameA, port: termA.name, level: levelA, tag: tagA }
        : { name: nameB, port: termB.name, level: levelB, tag: tagB },
      levelA <= levelB
        ? { name: nameB, port: termB.name, level: levelB, tag: tagB }
        : { name: nameA, port: termA.name, level: levelA, tag: tagA },
      cable,
      linkSpeed,
      combinedVlans,
    )
    connections.push(conn)
  }

  return { devices, connections }
}

function createConnection(
  src: { name: string; port: string; level: number; tag: string },
  dst: { name: string; port: string; level: number; tag: string },
  cable: NetBoxCableResponse['results'][0],
  speed: number | null,
  vlans: number[],
): ConnectionData {
  return {
    srcDev: src.name,
    srcPort: src.port,
    srcLevel: src.level,
    dstDev: dst.name,
    dstPort: dst.port,
    dstLevel: dst.level,
    dstTag: dst.tag,
    cableType: cable.type,
    cableColor: cable.color ? `#${cable.color}` : undefined,
    cableLabel: cable.label,
    cableLength:
      cable.length && cable.length_unit ? `${cable.length}${cable.length_unit.value}` : undefined,
    speed,
    vlans,
  }
}

// ============================================
// Circuit Builders
// ============================================

/**
 * Recover circuit links that the plain cable-walker drops.
 *
 * A device interface cabled to a circuit-termination (rather than to another
 * device) is skipped by {@link buildDevicesAndConnections}, so the transport a
 * circuit carries — a dark fiber between two of your own sites, or an uplink to
 * a provider — is invisible. NetBox models the far end on the *circuit*, not on
 * the cable's device side, so we join it back here:
 *
 *   - Both ends land on a device in the set → a device↔device link (the circuit
 *     is transport between owned gear; provider/cid become the label).
 *   - Only one end lands on a device → the far end is the provider itself; we
 *     synthesize one boundary node per provider and link the device to it.
 *
 * Circuit-endpoint devices are registered into `devices` so a device reachable
 * *only* through a circuit still gets a node. Non-active circuits render dashed.
 */
function buildCircuitConnections(
  circuitResp: NetBoxCircuitResponse,
  terminationResp: NetBoxCircuitTerminationResponse,
  cableResp: NetBoxCableResponse,
  devices: Map<string, DeviceData>,
  deviceTagMap: Map<string, string>,
  deviceInfoMap: Map<string, Omit<DeviceInfo, 'name' | 'tags' | 'rack'>>,
  tagMapping: Record<string, TagMapping>,
): { connections: ConnectionData[]; providers: Provider[] } {
  // The termination's embedded cable reference is abbreviated (no `type`), but
  // the full cable is already in the fetched cable list — the walker skipped it
  // because one end isn't a device. Join by id to style the link from the REAL
  // cable instead of assuming anything about it.
  const cableById = new Map(cableResp.results.map((c) => [c.id, c]))

  // Group each circuit's cabled device endpoints by circuit id.
  const endpointsByCircuit = new Map<number, CircuitEndpoint[]>()
  for (const term of terminationResp.results) {
    const circuitId = term.circuit?.id
    if (circuitId === undefined) continue
    const peer = term.link_peers?.find((p) => p.device?.name)
    const deviceName = peer?.device?.name
    if (!deviceName) continue
    const list = endpointsByCircuit.get(circuitId) ?? []
    list.push({
      device: deviceName,
      port: peer.name,
      speed: term.port_speed ?? null,
      cableType: term.cable ? cableById.get(term.cable.id)?.type : undefined,
    })
    endpointsByCircuit.set(circuitId, list)
  }

  const circuitById = new Map(circuitResp.results.map((c) => [c.id, c]))
  const connections: ConnectionData[] = []
  const providers: Provider[] = []
  const providerById = new Map<string, Provider>()

  const ensureRegistered = (ep: CircuitEndpoint, tag: string): void => {
    registerDevice(devices, ep.device, tag, ep.port, [], ep.speed, deviceInfoMap.get(ep.device))
  }

  for (const [circuitId, endpoints] of endpointsByCircuit) {
    const circuit = circuitById.get(circuitId)
    const inSet = endpoints.filter((ep) => deviceTagMap.has(ep.device))
    if (inSet.length === 0) continue

    const dashed = circuit?.status?.value !== undefined && circuit.status.value !== 'active'
    const provider = circuit?.provider?.name
    const cid = circuit?.cid
    const label = [provider, cid].filter(Boolean).join(' · ') || undefined

    const [src, dst] = inSet
    if (src && dst) {
      // Transport between two owned devices → a direct device↔device link.
      const srcTag = deviceTagMap.get(src.device) ?? 'other'
      const dstTag = deviceTagMap.get(dst.device) ?? 'other'
      ensureRegistered(src, srcTag)
      ensureRegistered(dst, dstTag)
      connections.push(makeCircuitConnection(src, dst, srcTag, dstTag, tagMapping, label, dashed))
    } else if (src) {
      // Only one owned device — the far end is the provider itself.
      if (!provider) continue
      const srcTag = deviceTagMap.get(src.device) ?? 'other'
      ensureRegistered(src, srcTag)
      const providerId = `provider:${circuit?.provider?.slug ?? provider}`
      let providerEntry = providerById.get(providerId)
      if (!providerEntry) {
        providerEntry = { id: providerId, name: provider, portIds: [] }
        providerById.set(providerId, providerEntry)
        providers.push(providerEntry)
      }
      // One synthesized handoff port per circuit. A port models exactly one
      // cable termination (LinkEndpoint contract: "must reference an existing
      // port"), and the provider really does hand each circuit off on its own
      // port — two uplinks to one provider must not converge on a portless
      // node. Identity ifName defaults to the port id on ingest.
      const portId = cid || `circuit-${circuitId}`
      providerEntry.portIds.push(portId)
      connections.push(
        makeCircuitConnection(
          src,
          { device: providerId, port: portId, speed: src.speed },
          srcTag,
          'other',
          tagMapping,
          cid || provider,
          dashed,
        ),
      )
    }
  }

  return { connections, providers }
}

function makeCircuitConnection(
  src: CircuitEndpoint,
  dst: CircuitEndpoint,
  srcTag: string,
  dstTag: string,
  mapping: Record<string, TagMapping>,
  label: string | undefined,
  dashed: boolean,
): ConnectionData {
  const srcLevel = getLevelByTag(srcTag, mapping)
  const dstLevel = getLevelByTag(dstTag, mapping)
  const ordered = srcLevel <= dstLevel
  const a = ordered ? src : dst
  const b = ordered ? dst : src
  return {
    srcDev: a.device,
    srcPort: a.port,
    srcLevel: ordered ? srcLevel : dstLevel,
    dstDev: b.device,
    dstPort: b.port,
    dstLevel: ordered ? dstLevel : srcLevel,
    dstTag: ordered ? dstTag : srcTag,
    // Style from the real cable at either end — never assumed. Empty string =
    // unknown, which applyCableStyle treats as "no cable-type styling".
    cableType: src.cableType ?? dst.cableType ?? '',
    cableLabel: label,
    speed: src.speed ?? dst.speed,
    vlans: [],
    dashed,
  }
}

// ============================================
// Helper Functions
// ============================================

function resolvePrimaryTag(tags: NetBoxTag[]): string {
  const tagSet = new Set(tags.map((t) => t.slug))
  for (const priority of TAG_PRIORITY) {
    if (tagSet.has(priority)) return priority
  }
  return tags[0] ? tags[0].slug : 'other'
}

function getLevelByTag(tag: string, mapping: Record<string, TagMapping>): number {
  return mapping[tag]?.level ?? 99
}

function registerDevice(
  devices: Map<string, DeviceData>,
  name: string,
  tag: string,
  port: string,
  vlans: number[],
  speed: number | null,
  info?: Omit<DeviceInfo, 'name' | 'tags' | 'rack'>,
): void {
  const device = devices.get(name) ?? {
    name,
    primaryTag: tag,
    ports: new Set(),
    portVlans: new Map(),
    portSpeeds: new Map(),
    model: info?.model,
    manufacturer: info?.manufacturer,
    ip: info?.ip,
    role: info?.role,
    site: info?.site,
    location: info?.location,
    status: info?.status,
  }

  device.ports.add(port)
  device.portVlans.set(port, vlans)
  device.portSpeeds.set(port, speed)

  devices.set(name, device)
}

function getNetworkPrefix(ip: string | undefined): string | null {
  if (!ip) return null
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  return `${parts[0]}.${parts[1]}.0.0/16`
}

function formatLocationLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============================================
// Subgraph Builders
// ============================================

function buildSubgraphsByGroupBy(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>,
  groupBy: GroupBy,
): GroupSpec[] {
  switch (groupBy) {
    case 'none':
      return []
    case 'tag':
      return buildSubgraphsByTag(devices, mapping)
    case 'site':
      return buildSubgraphsBySite(devices)
    case 'location':
      return buildSubgraphsByLocation(devices)
    case 'prefix':
      return buildSubgraphsByPrefix(devices)
    default:
      return []
  }
}

function buildSubgraphsByTag(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>,
): GroupSpec[] {
  const tagDevices = groupDevicesBy(devices, (d) => d.primaryTag)
  const subgraphs: GroupSpec[] = []

  for (const [tag, devs] of tagDevices) {
    if (devs.length === 0) continue

    const tagConfig = mapping[tag]
    const level = tagConfig?.level ?? 99
    const label = tagConfig?.subgraph ?? tag
    // Use surface token - renderer will resolve to actual colors based on theme
    const token = SUBGRAPH_TOKENS[level] ?? 'surface-1'

    subgraphs.push({
      id: tag,
      label,
      style: { fill: token },
    })
  }

  return subgraphs.sort((a, b) => {
    const tagA = a.id
    const tagB = b.id
    return (mapping[tagA]?.level ?? 99) - (mapping[tagB]?.level ?? 99)
  })
}

function buildSubgraphsBySite(devices: Map<string, DeviceData>): GroupSpec[] {
  return buildGroupedSubgraphs(
    groupDevicesBy(devices, (d) => d.site ?? 'unknown'),
    GROUPING_TOKENS,
  )
}

function buildSubgraphsByLocation(devices: Map<string, DeviceData>): GroupSpec[] {
  return buildGroupedSubgraphs(
    groupDevicesBy(devices, (d) => d.location ?? d.site ?? 'unknown'),
    GROUPING_TOKENS,
  )
}

function buildSubgraphsByPrefix(devices: Map<string, DeviceData>): GroupSpec[] {
  const prefixDevices = groupDevicesBy(devices, (d) => getNetworkPrefix(d.ip) ?? 'unknown')

  const sortedPrefixes = Array.from(prefixDevices.keys()).sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    const [a0 = 0, a1 = 0] = a.split('.').slice(0, 2).map(Number)
    const [b0 = 0, b1 = 0] = b.split('.').slice(0, 2).map(Number)
    return a0 - b0 || a1 - b1
  })

  const subgraphs: GroupSpec[] = []
  let tokenIndex = 0

  for (const prefix of sortedPrefixes) {
    const devs = prefixDevices.get(prefix)
    if (devs?.length === 0) continue

    const token = PREFIX_TOKENS[tokenIndex++ % PREFIX_TOKENS.length]
    const label =
      prefix === 'unknown' ? 'Unknown Network' : `Subnet: ${prefix.replace('.0.0/16', '.x.x')}`

    subgraphs.push({
      id: prefix.replace(/[./]/g, '-'),
      label,
      style: { fill: token },
    })
  }

  return subgraphs
}

function groupDevicesBy(
  devices: Map<string, DeviceData>,
  keyFn: (d: DeviceData) => string,
): Map<string, DeviceData[]> {
  const grouped = new Map<string, DeviceData[]>()
  for (const device of devices.values()) {
    const key = keyFn(device)
    const data = grouped.get(key) ?? []
    data.push(device)
    grouped.set(key, data)
  }
  return grouped
}

function buildGroupedSubgraphs(grouped: Map<string, DeviceData[]>, tokens: string[]): GroupSpec[] {
  const subgraphs: GroupSpec[] = []
  let tokenIndex = 0

  for (const [key, devs] of grouped) {
    if (devs.length === 0) continue

    const token = tokens[tokenIndex++ % tokens.length]
    subgraphs.push({
      id: key,
      label: formatLocationLabel(key),
      style: { fill: token },
    })
  }

  return subgraphs
}

// ============================================
// Node Builders
// ============================================

function resolveDeviceType(
  device: DeviceData,
  tagConfig: TagMapping | undefined,
  useRoleForType: boolean,
): string {
  if (tagConfig?.type) return tagConfig.type
  if (useRoleForType && device.role) {
    const roleType = ROLE_TO_TYPE[device.role]
    if (roleType) return roleType
  }
  return 'generic'
}

function statusStyle(status: DeviceStatusValue): NodeDrawing['style'] | undefined {
  const style = DEVICE_STATUS_STYLES[status]
  if (!style || Object.keys(style).length === 0) return undefined
  return {
    ...(style.fill && { fill: style.fill }),
    ...(style.stroke && { stroke: style.stroke }),
    ...(style.strokeDasharray && { strokeDasharray: style.strokeDasharray }),
    ...(style.opacity && { opacity: style.opacity }),
  }
}

function getNodeParent(device: DeviceData, groupBy: GroupBy): string | undefined {
  switch (groupBy) {
    case 'tag':
      return device.primaryTag
    case 'site':
      return device.site
    case 'location': {
      const loc = device.location ?? device.site
      return loc
    }
    case 'prefix': {
      const prefix = getNetworkPrefix(device.ip)
      return prefix ? prefix.replace(/[./]/g, '-') : undefined
    }
    default:
      return undefined
  }
}

// ============================================
// VM Support
// ============================================

function clusterGroups(vmResp: NetBoxVirtualMachineResponse): GroupSpec[] {
  const groups: GroupSpec[] = []
  const seen = new Set<string>()
  for (const vm of vmResp.results) {
    if (!vm.cluster || seen.has(vm.cluster.slug)) continue
    seen.add(vm.cluster.slug)
    const token = GROUPING_TOKENS[groups.length % GROUPING_TOKENS.length]
    groups.push({
      id: `cluster-${vm.cluster.slug}`,
      label: vm.cluster.name ?? vm.cluster.slug,
      style: { fill: token, strokeDasharray: '4,2' },
    })
  }
  return groups
}

// ============================================
// YAML Output
// ============================================

/**
 * Generate the network YAML from NetBox data.
 */
export function toYaml(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  options: ConverterOptions = {},
  circuitData?: CircuitData,
  vmData?: VirtualMachineData,
): string {
  const { network } = convertToSourceNetwork(
    deviceResp,
    interfaceResp,
    cableResp,
    options,
    circuitData,
    vmData,
  )
  return writeNetworkModel({ config: network })
}
