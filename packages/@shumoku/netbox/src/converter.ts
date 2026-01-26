/**
 * NetBox to Shumoku NetworkGraph Converter
 */

// ============================================
// Imports
// ============================================

import type {
  DeviceType,
  LegendSettings,
  Link,
  LinkEndpoint,
  NetworkGraph,
  Node,
  Subgraph,
} from '@shumoku/core/models'

import type {
  ConnectionData,
  ConverterOptions,
  DeviceData,
  DeviceStatusValue,
  GroupBy,
  NetBoxCableResponse,
  NetBoxDeviceResponse,
  NetBoxInterfaceResponse,
  NetBoxTag,
  NetBoxVirtualMachineResponse,
  NetBoxVMInterfaceResponse,
  TagMapping,
} from './types.js'

import {
  CABLE_STYLES,
  convertSpeedToBandwidth,
  DEFAULT_TAG_MAPPING,
  DEVICE_STATUS_STYLES,
  ROLE_TO_TYPE,
  TAG_PRIORITY,
} from './types.js'

// ============================================
// Types
// ============================================

/**
 * Options for hierarchical output generation
 */
export interface HierarchicalConverterOptions extends ConverterOptions {
  /** Enable hierarchical output (multiple files) */
  hierarchical?: boolean
  /** Hierarchy depth: 'site' | 'location' | 'rack' */
  hierarchyDepth?: 'site' | 'location' | 'rack'
  /** Base path for file references (default: './') */
  fileBasePath?: string
}

/**
 * Cross-location link representing a cable between devices in different locations
 */
export interface CrossLocationLink {
  fromLocation: string
  fromDevice: string
  fromPort: string
  toLocation: string
  toDevice: string
  toPort: string
  cable: ConnectionData
}

/**
 * Result of hierarchical conversion
 */
export interface HierarchicalOutput {
  main: string
  files: Map<string, string>
  crossLinks: CrossLocationLink[]
}

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

/**
 * Convert NetBox data to Shumoku NetworkGraph
 */
export function convertToNetworkGraph(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  options: ConverterOptions = {},
): NetworkGraph {
  const tagMapping = { ...DEFAULT_TAG_MAPPING, ...options.tagMapping }
  const groupBy: GroupBy = options.groupBy ?? (options.groupByTag === false ? 'none' : 'tag')
  const showPorts = options.showPorts ?? true
  const colorByCableType = options.colorByCableType ?? true
  const useRoleForType = options.useRoleForType ?? true
  const colorByStatus = options.colorByStatus ?? false

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

  // Build graph components
  const subgraphs = buildSubgraphsByGroupBy(devices, tagMapping, groupBy)
  const nodes = buildNodes(devices, tagMapping, groupBy, useRoleForType, colorByStatus)
  const links = buildLinks(connections, showPorts, colorByCableType)

  return {
    version: '1.0.0',
    name: 'Network Topology',
    description: 'Generated from NetBox',
    nodes,
    links,
    subgraphs: subgraphs.length > 0 ? subgraphs : undefined,
    settings: {
      direction: 'TB',
      theme: options.theme ?? 'light',
      legend: options.legend,
    },
  }
}

/**
 * Convert NetBox data with VMs to Shumoku NetworkGraph
 */
export function convertToNetworkGraphWithVMs(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  vmResp: NetBoxVirtualMachineResponse,
  vmInterfaceResp: NetBoxVMInterfaceResponse,
  options: ConverterOptions = {},
): NetworkGraph {
  const graph = convertToNetworkGraph(deviceResp, interfaceResp, cableResp, options)

  if (!options.includeVMs) {
    return graph
  }

  const colorByStatus = options.colorByStatus ?? false
  const groupVMsByCluster = options.groupVMsByCluster ?? false

  // Build VM VLAN map (reserved for future VLAN-based VM connections)
  buildVMVlanMap(vmInterfaceResp)

  // Create cluster subgraphs if needed
  const clusterSubgraphs = groupVMsByCluster ? buildClusterSubgraphs(vmResp) : []

  // Convert VMs to nodes
  const vmNodes = buildVMNodes(vmResp, colorByStatus, groupVMsByCluster)

  // Add to graph
  graph.nodes.push(...vmNodes)
  if (clusterSubgraphs.length > 0) {
    graph.subgraphs ??= []
    graph.subgraphs.push(...clusterSubgraphs)
  }

  return graph
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

    portVlanMap.get(devName)!.set(portName, Array.from(vlans))
    portSpeedMap.get(devName)!.set(portName, iface.speed)
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
    if (cable.a_terminations.length === 0 || cable.b_terminations.length === 0) continue

    const termA = cable.a_terminations[0].object
    const termB = cable.b_terminations[0].object

    // Skip if termination is not a device interface (e.g., circuit, console port, power port)
    if (!termA.device || !termB.device) continue

    const nameA = termA.device.name ?? `noname-${termA.device.id}`
    const nameB = termB.device.name ?? `noname-${termB.device.id}`
    const tagA = deviceTagMap.get(nameA) ?? 'other'
    const tagB = deviceTagMap.get(nameB) ?? 'other'

    const infoA = deviceInfoMap.get(nameA)
    const infoB = deviceInfoMap.get(nameB)
    const vlansA = portVlanMap.get(nameA)?.get(termA.name) ?? []
    const vlansB = portVlanMap.get(nameB)?.get(termB.name) ?? []
    const speedA = portSpeedMap.get(nameA)?.get(termA.name) ?? null
    const speedB = portSpeedMap.get(nameB)?.get(termB.name) ?? null

    registerDevice(devices, nameA, tagA, termA.name, vlansA, speedA, infoA)
    registerDevice(devices, nameB, tagB, termB.name, vlansB, speedB, infoB)

    const combinedVlans = [...new Set([...vlansA, ...vlansB])]
    const linkSpeed = speedA ?? speedB
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
// Helper Functions
// ============================================

function resolvePrimaryTag(tags: NetBoxTag[]): string {
  const tagSet = new Set(tags.map((t) => t.slug))
  for (const priority of TAG_PRIORITY) {
    if (tagSet.has(priority)) return priority
  }
  return tags.length > 0 ? tags[0].slug : 'other'
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
  if (!devices.has(name)) {
    devices.set(name, {
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
    })
  }

  const device = devices.get(name)!
  device.ports.add(port)
  device.portVlans.set(port, vlans)
  device.portSpeeds.set(port, speed)
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
): Subgraph[] {
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
): Subgraph[] {
  const tagDevices = groupDevicesBy(devices, (d) => d.primaryTag)
  const subgraphs: Subgraph[] = []

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

function buildSubgraphsBySite(devices: Map<string, DeviceData>): Subgraph[] {
  return buildGroupedSubgraphs(
    groupDevicesBy(devices, (d) => d.site ?? 'unknown'),
    GROUPING_TOKENS,
  )
}

function buildSubgraphsByLocation(devices: Map<string, DeviceData>): Subgraph[] {
  return buildGroupedSubgraphs(
    groupDevicesBy(devices, (d) => d.location ?? d.site ?? 'unknown'),
    GROUPING_TOKENS,
  )
}

function buildSubgraphsByPrefix(devices: Map<string, DeviceData>): Subgraph[] {
  const prefixDevices = groupDevicesBy(devices, (d) => getNetworkPrefix(d.ip) ?? 'unknown')

  const sortedPrefixes = Array.from(prefixDevices.keys()).sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    const aNum = a.split('.').slice(0, 2).map(Number)
    const bNum = b.split('.').slice(0, 2).map(Number)
    return aNum[0] - bNum[0] || aNum[1] - bNum[1]
  })

  const subgraphs: Subgraph[] = []
  let tokenIndex = 0

  for (const prefix of sortedPrefixes) {
    const devs = prefixDevices.get(prefix)!
    if (devs.length === 0) continue

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
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(device)
  }
  return grouped
}

function buildGroupedSubgraphs(grouped: Map<string, DeviceData[]>, tokens: string[]): Subgraph[] {
  const subgraphs: Subgraph[] = []
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

function buildNodes(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>,
  groupBy: GroupBy,
  useRoleForType: boolean,
  colorByStatus: boolean,
): Node[] {
  const nodes: Node[] = []

  for (const device of devices.values()) {
    const tagConfig = mapping[device.primaryTag]
    const deviceType = resolveDeviceType(device, tagConfig, useRoleForType)

    const labelLines: string[] = [`<b>${device.name}</b>`]
    if (device.ip) labelLines.push(device.ip)

    const node: Node = {
      id: device.name,
      label: labelLines,
      shape: 'rounded',
      type: deviceType as DeviceType,
      rank: tagConfig?.level,
      model: device.model?.toLowerCase(),
      vendor: device.manufacturer?.toLowerCase(),
    }

    if (colorByStatus && device.status) {
      applyStatusStyle(node, device.status)
    }

    node.parent = getNodeParent(device, groupBy)
    nodes.push(node)
  }

  return nodes
}

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

function applyStatusStyle(node: Node, status: DeviceStatusValue): void {
  const statusStyle = DEVICE_STATUS_STYLES[status]
  if (statusStyle && Object.keys(statusStyle).length > 0) {
    node.style = {
      ...(statusStyle.fill && { fill: statusStyle.fill }),
      ...(statusStyle.stroke && { stroke: statusStyle.stroke }),
      ...(statusStyle.strokeDasharray && { strokeDasharray: statusStyle.strokeDasharray }),
      ...(statusStyle.opacity && { opacity: statusStyle.opacity }),
    }
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
// Link Builders
// ============================================

function buildLinks(
  connections: ConnectionData[],
  showPorts: boolean,
  colorByCableType: boolean,
): Link[] {
  return connections.map((conn, index) => {
    const from: LinkEndpoint = { node: conn.srcDev }
    const to: LinkEndpoint = { node: conn.dstDev }

    if (showPorts) {
      from.port = conn.srcPort
      to.port = conn.dstPort
    }

    const link: Link = {
      id: `link-${index}`,
      from,
      to,
      arrow: 'none',
    }

    const bandwidth = convertSpeedToBandwidth(conn.speed)
    if (bandwidth) link.bandwidth = bandwidth

    if (conn.vlans.length > 0) link.vlan = conn.vlans

    if (colorByCableType) {
      applyCableStyle(link, conn)
    }

    const labelParts: string[] = []
    if (conn.cableLabel) labelParts.push(conn.cableLabel)
    if (conn.cableLength) labelParts.push(conn.cableLength)
    if (labelParts.length > 0) link.label = labelParts.join(' ')

    return link
  })
}

function applyCableStyle(link: Link, conn: ConnectionData): void {
  if (conn.cableColor) {
    link.style = { stroke: conn.cableColor }
  } else if (conn.cableType) {
    const cableStyle = CABLE_STYLES[conn.cableType]
    if (cableStyle) {
      link.style = { stroke: cableStyle.color }
      if (cableStyle.type) link.type = cableStyle.type
    }
  }
}

// ============================================
// VM Support
// ============================================

function buildVMVlanMap(vmInterfaceResp: NetBoxVMInterfaceResponse): Map<string, number[]> {
  const vmVlanMap = new Map<string, number[]>()

  for (const vmIface of vmInterfaceResp.results) {
    const vmName = vmIface.virtual_machine.name
    const vlans = new Set<number>()

    if (vmIface.untagged_vlan?.vid) vlans.add(vmIface.untagged_vlan.vid)
    for (const tv of vmIface.tagged_vlans) vlans.add(tv.vid)

    if (!vmVlanMap.has(vmName)) vmVlanMap.set(vmName, [])
    vmVlanMap.get(vmName)!.push(...vlans)
  }

  return vmVlanMap
}

function buildClusterSubgraphs(vmResp: NetBoxVirtualMachineResponse): Subgraph[] {
  const clusters = new Set<string>()
  for (const vm of vmResp.results) {
    if (vm.cluster) clusters.add(vm.cluster.slug)
  }

  const subgraphs: Subgraph[] = []
  let tokenIdx = 0

  for (const clusterSlug of clusters) {
    const vm = vmResp.results.find((v) => v.cluster?.slug === clusterSlug)
    const clusterName = vm?.cluster?.name ?? clusterSlug
    const token = GROUPING_TOKENS[tokenIdx++ % GROUPING_TOKENS.length]

    subgraphs.push({
      id: `cluster-${clusterSlug}`,
      label: clusterName,
      style: {
        fill: token,
        strokeDasharray: '4,2',
      },
    })
  }

  return subgraphs
}

function buildVMNodes(
  vmResp: NetBoxVirtualMachineResponse,
  colorByStatus: boolean,
  groupVMsByCluster: boolean,
): Node[] {
  return vmResp.results.map((vm) => {
    const labelLines: string[] = [`<b>${vm.name}</b>`]
    const ip = vm.primary_ip4?.address?.split('/')[0] ?? vm.primary_ip6?.address?.split('/')[0]
    if (ip) labelLines.push(ip)

    if (vm.vcpus || vm.memory) {
      const specs: string[] = []
      if (vm.vcpus) specs.push(`${vm.vcpus}vCPU`)
      if (vm.memory) specs.push(`${Math.round(vm.memory / 1024)}GB`)
      labelLines.push(specs.join(' / '))
    }

    const node: Node = {
      id: `vm-${vm.name}`,
      label: labelLines,
      shape: 'rounded',
      type: 'server' as DeviceType,
      style: { ...VM_NODE_STYLE },
      metadata: {
        isVirtualMachine: true,
        cluster: vm.cluster?.slug,
        vcpus: vm.vcpus,
        memory: vm.memory,
        disk: vm.disk,
      },
    }

    if (colorByStatus && vm.status?.value) {
      const statusStyle = DEVICE_STATUS_STYLES[vm.status.value as DeviceStatusValue]
      if (statusStyle && Object.keys(statusStyle).length > 0) {
        node.style = {
          ...node.style,
          ...(statusStyle.fill && { fill: statusStyle.fill }),
          ...(statusStyle.stroke && { stroke: statusStyle.stroke }),
          ...(statusStyle.strokeDasharray && { strokeDasharray: statusStyle.strokeDasharray }),
          ...(statusStyle.opacity && { opacity: statusStyle.opacity }),
        }
      }
    }

    if (groupVMsByCluster && vm.cluster) {
      node.parent = `cluster-${vm.cluster.slug}`
    }

    return node
  })
}

// ============================================
// YAML Output
// ============================================

/**
 * Generate YAML string from NetworkGraph
 */
export function toYaml(graph: NetworkGraph): string {
  const lines: string[] = []

  // Header
  lines.push(`name: "${graph.name ?? 'Network Topology'}"`)
  if (graph.description) lines.push(`description: "${graph.description}"`)
  lines.push('')

  // Settings
  if (graph.settings) {
    lines.push('settings:')
    if (graph.settings.direction) lines.push(`  direction: ${graph.settings.direction}`)
    if (graph.settings.theme) lines.push(`  theme: ${graph.settings.theme}`)
    if (graph.settings.legend) {
      serializeLegendSettings(lines, graph.settings.legend)
    }
    lines.push('')
  }

  // Subgraphs
  if (graph.subgraphs?.length) {
    lines.push('subgraphs:')
    for (const sg of graph.subgraphs) {
      serializeSubgraph(lines, sg)
    }
    lines.push('')
  }

  // Nodes
  lines.push('nodes:')
  for (const node of graph.nodes) {
    serializeNode(lines, node)
  }
  lines.push('')

  // Links
  lines.push('links:')
  for (const link of graph.links) {
    serializeLink(lines, link)
  }

  return lines.join('\n')
}

function serializeLegendSettings(
  lines: string[],
  legend: boolean | LegendSettings | undefined,
): void {
  if (legend === true) {
    lines.push('  legend: true')
  } else if (typeof legend === 'object') {
    lines.push('  legend:')
    if (legend.enabled !== undefined) lines.push(`    enabled: ${legend.enabled}`)
    if (legend.position) lines.push(`    position: ${legend.position}`)
    if (legend.showDeviceTypes !== undefined)
      lines.push(`    showDeviceTypes: ${legend.showDeviceTypes}`)
    if (legend.showBandwidth !== undefined) lines.push(`    showBandwidth: ${legend.showBandwidth}`)
    if (legend.showCableTypes !== undefined)
      lines.push(`    showCableTypes: ${legend.showCableTypes}`)
    if (legend.showVlans !== undefined) lines.push(`    showVlans: ${legend.showVlans}`)
  }
}

function serializeSubgraph(lines: string[], sg: Subgraph): void {
  lines.push(`  - id: ${sg.id}`)
  lines.push(`    label: "${sg.label}"`)
  if (sg.style) {
    lines.push('    style:')
    if (sg.style.fill) lines.push(`      fill: "${sg.style.fill}"`)
    if (sg.style.stroke) lines.push(`      stroke: "${sg.style.stroke}"`)
    if (sg.style.strokeWidth) lines.push(`      strokeWidth: ${sg.style.strokeWidth}`)
  }
}

function serializeNode(lines: string[], node: Node): void {
  lines.push(`  - id: ${node.id}`)

  if (Array.isArray(node.label)) {
    lines.push('    label:')
    for (const line of node.label) lines.push(`      - "${line}"`)
  } else {
    lines.push(`    label: "${node.label}"`)
  }

  if (node.type) lines.push(`    type: ${node.type}`)
  if (node.vendor) lines.push(`    vendor: ${node.vendor}`)
  if (node.model) lines.push(`    model: ${node.model}`)
  if (node.parent) lines.push(`    parent: ${node.parent}`)
  if (node.rank !== undefined) lines.push(`    rank: ${node.rank}`)
}

function serializeLink(lines: string[], link: Link): void {
  const from = typeof link.from === 'string' ? link.from : link.from.node
  const to = typeof link.to === 'string' ? link.to : link.to.node
  const fromPort = typeof link.from === 'object' ? link.from.port : undefined
  const toPort = typeof link.to === 'object' ? link.to.port : undefined

  if (fromPort || toPort) {
    lines.push('  - from:')
    lines.push(`      node: ${from}`)
    if (fromPort) lines.push(`      port: ${fromPort}`)
    lines.push('    to:')
    lines.push(`      node: ${to}`)
    if (toPort) lines.push(`      port: ${toPort}`)
  } else {
    lines.push(`  - from: ${from}`)
    lines.push(`    to: ${to}`)
  }

  if (link.bandwidth) lines.push(`    bandwidth: ${link.bandwidth}`)
  if (link.type) lines.push(`    type: ${link.type}`)
  if (link.vlan?.length) lines.push(`    vlan: [${link.vlan.join(', ')}]`)
  if (link.style?.stroke) {
    lines.push('    style:')
    lines.push(`      stroke: "${link.style.stroke}"`)
  }
}

// ============================================
// Hierarchical Output Generation
// ============================================

/**
 * Convert NetBox data to hierarchical YAML output
 */
export function convertToHierarchicalYaml(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  options: HierarchicalConverterOptions = {},
): HierarchicalOutput {
  const hierarchyDepth = options.hierarchyDepth ?? 'location'
  const fileBasePath = options.fileBasePath ?? './'

  // Build device and port info maps
  const deviceInfoMap = buildHierarchicalDeviceInfoMap(deviceResp)
  const { portVlanMap, portSpeedMap } = buildPortMaps(interfaceResp)

  // Get location key function
  const getLocationKey = createLocationKeyFn(deviceInfoMap, hierarchyDepth)

  // Group devices by location
  const locationDevices = new Map<string, Set<string>>()
  for (const [deviceName] of deviceInfoMap) {
    const loc = getLocationKey(deviceName)
    if (!locationDevices.has(loc)) locationDevices.set(loc, new Set())
    locationDevices.get(loc)!.add(deviceName)
  }

  // Analyze cables
  const { crossLinks, internalConnections } = analyzeCables(
    cableResp,
    getLocationKey,
    portVlanMap,
    portSpeedMap,
  )

  // Generate files
  const files = new Map<string, string>()
  for (const [locationId, deviceNames] of locationDevices) {
    const locationGraph = buildLocationGraph(
      locationId,
      deviceNames,
      deviceInfoMap,
      internalConnections.get(locationId) ?? [],
      options,
    )
    files.set(locationId, toYaml(locationGraph))
  }

  // Generate main YAML
  const mainYaml = generateMainYaml(locationDevices, crossLinks, fileBasePath, options)

  return { main: mainYaml, files, crossLinks }
}

function buildHierarchicalDeviceInfoMap(deviceResp: NetBoxDeviceResponse): Map<string, DeviceInfo> {
  const map = new Map<string, DeviceInfo>()

  for (const device of deviceResp.results) {
    const deviceName = device.name ?? `noname-${device.id}`
    map.set(deviceName, {
      name: deviceName,
      site: device.site?.slug,
      location: device.location?.slug,
      rack: device.rack?.name,
      tags: device.tags,
      model: device.device_type?.model,
      manufacturer: device.device_type?.manufacturer?.name,
      ip: device.primary_ip4?.address?.split('/')[0] ?? device.primary_ip6?.address?.split('/')[0],
      role: device.role?.slug,
      status: device.status?.value,
    })
  }

  return map
}

function createLocationKeyFn(
  deviceInfoMap: Map<string, DeviceInfo>,
  hierarchyDepth: 'site' | 'location' | 'rack',
): (deviceName: string) => string {
  return (deviceName: string) => {
    const info = deviceInfoMap.get(deviceName)
    if (!info) return 'unknown'

    switch (hierarchyDepth) {
      case 'site':
        return info.site ?? 'unknown'
      case 'location':
        return info.location ?? info.site ?? 'unknown'
      case 'rack':
        return info.rack ?? info.location ?? info.site ?? 'unknown'
    }
  }
}

function analyzeCables(
  cableResp: NetBoxCableResponse,
  getLocationKey: (name: string) => string,
  portVlanMap: Map<string, Map<string, number[]>>,
  portSpeedMap: Map<string, Map<string, number | null>>,
) {
  const crossLinks: CrossLocationLink[] = []
  const internalConnections = new Map<string, ConnectionData[]>()

  for (const cable of cableResp.results) {
    if (cable.a_terminations.length === 0 || cable.b_terminations.length === 0) continue

    const termA = cable.a_terminations[0].object
    const termB = cable.b_terminations[0].object

    // Skip if termination is not a device interface (e.g., circuit, console port, power port)
    if (!termA.device || !termB.device) continue

    const nameA = termA.device.name ?? `noname-${termA.device.id}`
    const nameB = termB.device.name ?? `noname-${termB.device.id}`
    const locA = getLocationKey(nameA)
    const locB = getLocationKey(nameB)

    const vlansA = portVlanMap.get(nameA)?.get(termA.name) ?? []
    const vlansB = portVlanMap.get(nameB)?.get(termB.name) ?? []
    const speedA = portSpeedMap.get(nameA)?.get(termA.name) ?? null
    const speedB = portSpeedMap.get(nameB)?.get(termB.name) ?? null

    const conn: ConnectionData = {
      srcDev: nameA,
      srcPort: termA.name,
      srcLevel: 0,
      dstDev: nameB,
      dstPort: termB.name,
      dstLevel: 0,
      dstTag: '',
      cableType: cable.type,
      cableColor: cable.color ? `#${cable.color}` : undefined,
      cableLabel: cable.label,
      cableLength:
        cable.length && cable.length_unit ? `${cable.length}${cable.length_unit.value}` : undefined,
      speed: speedA ?? speedB,
      vlans: [...new Set([...vlansA, ...vlansB])],
    }

    if (locA !== locB) {
      crossLinks.push({
        fromLocation: locA,
        fromDevice: nameA,
        fromPort: termA.name,
        toLocation: locB,
        toDevice: nameB,
        toPort: termB.name,
        cable: conn,
      })
    } else {
      if (!internalConnections.has(locA)) internalConnections.set(locA, [])
      internalConnections.get(locA)!.push(conn)
    }
  }

  return { crossLinks, internalConnections }
}

function buildLocationGraph(
  locationId: string,
  deviceNames: Set<string>,
  deviceInfoMap: Map<string, DeviceInfo>,
  connections: ConnectionData[],
  options: HierarchicalConverterOptions,
): NetworkGraph {
  const useRoleForType = options.useRoleForType ?? true
  const colorByStatus = options.colorByStatus ?? false
  const tagMapping = { ...DEFAULT_TAG_MAPPING, ...options.tagMapping }

  const nodes: Node[] = []

  for (const deviceName of deviceNames) {
    const info = deviceInfoMap.get(deviceName)
    if (!info) continue

    const primaryTag = resolvePrimaryTag(info.tags)
    const tagConfig = tagMapping[primaryTag]
    const deviceType = resolveDeviceTypeFromInfo(info, tagConfig, useRoleForType)

    const labelLines: string[] = [`<b>${info.name}</b>`]
    if (info.ip) labelLines.push(info.ip)

    const node: Node = {
      id: info.name,
      label: labelLines,
      shape: 'rounded',
      type: deviceType as DeviceType,
      rank: tagConfig?.level,
      model: info.model?.toLowerCase(),
      vendor: info.manufacturer?.toLowerCase(),
    }

    if (colorByStatus && info.status) {
      applyStatusStyle(node, info.status)
    }

    nodes.push(node)
  }

  const links = buildLinks(connections, options.showPorts ?? true, options.colorByCableType ?? true)

  return {
    version: '1.0.0',
    name: formatLocationLabel(locationId),
    description: `Network topology for ${formatLocationLabel(locationId)}`,
    nodes,
    links,
    settings: {
      direction: 'TB',
      theme: options.theme ?? 'light',
    },
  }
}

function resolveDeviceTypeFromInfo(
  info: DeviceInfo,
  tagConfig: TagMapping | undefined,
  useRoleForType: boolean,
): string {
  if (tagConfig?.type) return tagConfig.type
  if (useRoleForType && info.role) {
    const roleType = ROLE_TO_TYPE[info.role]
    if (roleType) return roleType
  }
  return 'generic'
}

function generateMainYaml(
  locationDevices: Map<string, Set<string>>,
  crossLinks: CrossLocationLink[],
  fileBasePath: string,
  options: HierarchicalConverterOptions,
): string {
  const lines: string[] = []

  lines.push(`name: "Network Overview"`)
  lines.push(`description: "Hierarchical network topology"`)
  lines.push('')

  lines.push('settings:')
  lines.push(`  direction: TB`)
  if (options.theme) lines.push(`  theme: ${options.theme}`)
  lines.push('')

  lines.push('subgraphs:')
  let tokenIndex = 0
  for (const [locationId] of locationDevices) {
    const token = GROUPING_TOKENS[tokenIndex++ % GROUPING_TOKENS.length]

    lines.push(`  - id: ${locationId}`)
    lines.push(`    label: "${formatLocationLabel(locationId)}"`)
    lines.push(`    file: "${fileBasePath}${locationId}.yaml"`)
    lines.push('    style:')
    lines.push(`      fill: "${token}"`)
  }
  lines.push('')

  if (crossLinks.length > 0) {
    lines.push('links:')
    for (const crossLink of crossLinks) {
      lines.push('  - from:')
      lines.push(`      node: ${crossLink.fromDevice}`)
      lines.push(`      port: ${crossLink.fromPort}`)
      lines.push('    to:')
      lines.push(`      node: ${crossLink.toDevice}`)
      lines.push(`      port: ${crossLink.toPort}`)

      const bandwidth = convertSpeedToBandwidth(crossLink.cable.speed)
      if (bandwidth) lines.push(`    bandwidth: ${bandwidth}`)
      if (crossLink.cable.cableLabel) lines.push(`    label: "${crossLink.cable.cableLabel}"`)
    }
  }

  return lines.join('\n')
}
