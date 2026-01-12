/**
 * NetBox to Shumoku NetworkGraph Converter
 */

import type {
  NetworkGraph,
  Node,
  Link,
  Subgraph,
  DeviceType,
  LinkEndpoint,
} from '@shumoku/core/models'
import type {
  NetBoxDeviceResponse,
  NetBoxInterfaceResponse,
  NetBoxCableResponse,
  NetBoxVirtualMachineResponse,
  NetBoxVMInterfaceResponse,
  NetBoxTag,
  ConverterOptions,
  TagMapping,
  DeviceData,
  ConnectionData,
  GroupBy,
  DeviceStatusValue,
} from './types.js'
import {
  DEFAULT_TAG_MAPPING,
  TAG_PRIORITY,
  CABLE_STYLES,
  ROLE_TO_TYPE,
  DEVICE_STATUS_STYLES,
  convertSpeedToBandwidth,
} from './types.js'

/**
 * Subgraph style colors by level
 */
const SUBGRAPH_STYLES: Record<number, { fill: string; stroke: string }> = {
  0: { fill: '#E3F2FD', stroke: '#1565C0' },  // OCX - Blue
  1: { fill: '#E8F5E9', stroke: '#2E7D32' },  // ONU - Green
  2: { fill: '#FFF3E0', stroke: '#E65100' },  // Router - Orange
  3: { fill: '#FFF8E1', stroke: '#F9A825' },  // Core Switch - Yellow
  4: { fill: '#F3E5F5', stroke: '#7B1FA2' },  // Edge Switch - Purple
  5: { fill: '#FFEBEE', stroke: '#C62828' },  // Server/AP - Red
  6: { fill: '#ECEFF1', stroke: '#546E7A' },  // Console - Gray
}

/**
 * Convert NetBox data to Shumoku NetworkGraph
 */
export function convertToNetworkGraph(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  options: ConverterOptions = {}
): NetworkGraph {
  const tagMapping = { ...DEFAULT_TAG_MAPPING, ...options.tagMapping }
  // Support both legacy groupByTag and new groupBy option
  const groupBy: GroupBy = options.groupBy ??
    (options.groupByTag === false ? 'none' : 'tag')
  const showPorts = options.showPorts ?? true
  const colorByCableType = options.colorByCableType ?? true
  const useRoleForType = options.useRoleForType ?? true
  const colorByStatus = options.colorByStatus ?? false

  // 1. Build device tag map and info map
  const deviceTagMap = new Map<string, string>()
  const deviceInfoMap = new Map<string, {
    model?: string
    manufacturer?: string
    ip?: string
    role?: string
    site?: string
    location?: string
    status?: DeviceStatusValue
  }>()
  for (const device of deviceResp.results) {
    deviceTagMap.set(device.name, resolvePrimaryTag(device.tags))
    deviceInfoMap.set(device.name, {
      model: device.device_type?.model,
      manufacturer: device.device_type?.manufacturer?.name,
      ip: device.primary_ip4?.address?.split('/')[0] ?? device.primary_ip6?.address?.split('/')[0],
      role: device.role?.slug,
      site: device.site?.slug,
      location: device.location?.slug,
      status: device.status?.value,
    })
  }

  // 2. Build port VLAN and speed maps
  const portVlanMap = new Map<string, Map<string, number[]>>()
  const portSpeedMap = new Map<string, Map<string, number | null>>()
  for (const iface of interfaceResp.results) {
    const devName = iface.device.name
    const portName = iface.name

    if (!portVlanMap.has(devName)) {
      portVlanMap.set(devName, new Map())
    }
    if (!portSpeedMap.has(devName)) {
      portSpeedMap.set(devName, new Map())
    }

    // Collect VLANs
    const vlans = new Set<number>()
    if (iface.untagged_vlan?.vid) {
      vlans.add(iface.untagged_vlan.vid)
    }
    for (const tv of iface.tagged_vlans) {
      vlans.add(tv.vid)
    }

    portVlanMap.get(devName)!.set(portName, Array.from(vlans))
    portSpeedMap.get(devName)!.set(portName, iface.speed)
  }

  // 3. Build devices and connections from cables
  const devices = new Map<string, DeviceData>()
  const connections: ConnectionData[] = []

  for (const cable of cableResp.results) {
    if (cable.a_terminations.length === 0 || cable.b_terminations.length === 0) {
      continue
    }

    const termA = cable.a_terminations[0].object
    const termB = cable.b_terminations[0].object

    const nameA = termA.device.name
    const nameB = termB.device.name
    const tagA = deviceTagMap.get(nameA) ?? 'other'
    const tagB = deviceTagMap.get(nameB) ?? 'other'

    // Register devices with port info
    const infoA = deviceInfoMap.get(nameA)
    const infoB = deviceInfoMap.get(nameB)
    const vlansA = portVlanMap.get(nameA)?.get(termA.name) ?? []
    const vlansB = portVlanMap.get(nameB)?.get(termB.name) ?? []
    const speedA = portSpeedMap.get(nameA)?.get(termA.name) ?? null
    const speedB = portSpeedMap.get(nameB)?.get(termB.name) ?? null

    registerDevice(devices, nameA, tagA, termA.name, vlansA, speedA, infoA)
    registerDevice(devices, nameB, tagB, termB.name, vlansB, speedB, infoB)

    // Collect VLANs from both endpoints
    const combinedVlans = [...new Set([...vlansA, ...vlansB])]
    // Use the higher speed (more reliable) or the first available
    const linkSpeed = speedA ?? speedB

    const levelA = getLevelByTag(tagA, tagMapping)
    const levelB = getLevelByTag(tagB, tagMapping)

    // Normalize direction: lower level -> higher level
    let conn: ConnectionData
    if (levelA <= levelB) {
      conn = {
        srcDev: nameA,
        srcPort: termA.name,
        srcLevel: levelA,
        dstDev: nameB,
        dstPort: termB.name,
        dstLevel: levelB,
        dstTag: tagB,
        cableType: cable.type,
        speed: linkSpeed,
        vlans: combinedVlans,
      }
    } else {
      conn = {
        srcDev: nameB,
        srcPort: termB.name,
        srcLevel: levelB,
        dstDev: nameA,
        dstPort: termA.name,
        dstLevel: levelA,
        dstTag: tagA,
        cableType: cable.type,
        speed: linkSpeed,
        vlans: combinedVlans,
      }
    }
    connections.push(conn)
  }

  // 4. Build NetworkGraph
  const subgraphs: Subgraph[] = buildSubgraphsByGroupBy(devices, tagMapping, groupBy)
  const nodes: Node[] = buildNodes(devices, tagMapping, groupBy, useRoleForType, colorByStatus)
  const links: Link[] = buildLinks(connections, showPorts, colorByCableType)

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
    },
  }
}

/**
 * Resolve primary tag from tags list based on priority
 */
function resolvePrimaryTag(tags: NetBoxTag[]): string {
  const tagSet = new Set(tags.map(t => t.slug))

  for (const priority of TAG_PRIORITY) {
    if (tagSet.has(priority)) {
      return priority
    }
  }

  if (tags.length > 0) {
    return tags[0].slug
  }

  return 'other'
}

/**
 * Get hierarchy level by tag
 */
function getLevelByTag(tag: string, mapping: Record<string, TagMapping>): number {
  return mapping[tag]?.level ?? 99
}

/**
 * Register a device in the devices map
 */
function registerDevice(
  devices: Map<string, DeviceData>,
  name: string,
  tag: string,
  port: string,
  vlans: number[],
  speed: number | null,
  info?: { model?: string; manufacturer?: string; ip?: string; role?: string; site?: string; location?: string; status?: DeviceStatusValue }
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

/**
 * Site/Location subgraph style colors
 */
const SITE_LOCATION_STYLES = [
  { fill: '#E3F2FD', stroke: '#1565C0' },  // Blue
  { fill: '#E8F5E9', stroke: '#2E7D32' },  // Green
  { fill: '#FFF3E0', stroke: '#E65100' },  // Orange
  { fill: '#F3E5F5', stroke: '#7B1FA2' },  // Purple
  { fill: '#FFEBEE', stroke: '#C62828' },  // Red
  { fill: '#E0F7FA', stroke: '#00838F' },  // Cyan
  { fill: '#FFF8E1', stroke: '#F9A825' },  // Yellow
  { fill: '#ECEFF1', stroke: '#546E7A' },  // Gray
]

/**
 * Build subgraphs based on groupBy option
 */
function buildSubgraphsByGroupBy(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>,
  groupBy: GroupBy
): Subgraph[] {
  if (groupBy === 'none') return []

  if (groupBy === 'tag') {
    return buildSubgraphsByTag(devices, mapping)
  }

  if (groupBy === 'site') {
    return buildSubgraphsBySite(devices)
  }

  if (groupBy === 'location') {
    return buildSubgraphsByLocation(devices)
  }

  if (groupBy === 'prefix') {
    return buildSubgraphsByPrefix(devices)
  }

  return []
}

/**
 * Build subgraphs from devices grouped by tag
 */
function buildSubgraphsByTag(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>
): Subgraph[] {
  const tagDevices = new Map<string, DeviceData[]>()

  for (const device of devices.values()) {
    const tag = device.primaryTag
    if (!tagDevices.has(tag)) {
      tagDevices.set(tag, [])
    }
    tagDevices.get(tag)!.push(device)
  }

  const subgraphs: Subgraph[] = []

  for (const [tag, devs] of tagDevices) {
    if (devs.length === 0) continue

    const tagConfig = mapping[tag]
    const level = tagConfig?.level ?? 99
    const label = tagConfig?.subgraph ?? tag

    const style = SUBGRAPH_STYLES[level] ?? { fill: '#F5F5F5', stroke: '#9E9E9E' }

    subgraphs.push({
      id: `subgraph-${tag}`,
      label,
      style: {
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: 2,
      },
    })
  }

  // Sort by level
  return subgraphs.sort((a, b) => {
    const tagA = a.id.replace('subgraph-', '')
    const tagB = b.id.replace('subgraph-', '')
    const levelA = mapping[tagA]?.level ?? 99
    const levelB = mapping[tagB]?.level ?? 99
    return levelA - levelB
  })
}

/**
 * Build subgraphs from devices grouped by site
 */
function buildSubgraphsBySite(devices: Map<string, DeviceData>): Subgraph[] {
  const siteDevices = new Map<string, DeviceData[]>()

  for (const device of devices.values()) {
    const site = device.site ?? 'unknown'
    if (!siteDevices.has(site)) {
      siteDevices.set(site, [])
    }
    siteDevices.get(site)!.push(device)
  }

  const subgraphs: Subgraph[] = []
  let styleIndex = 0

  for (const [site, devs] of siteDevices) {
    if (devs.length === 0) continue

    const style = SITE_LOCATION_STYLES[styleIndex % SITE_LOCATION_STYLES.length]
    styleIndex++

    subgraphs.push({
      id: `site-${site}`,
      label: site.charAt(0).toUpperCase() + site.slice(1).replace(/-/g, ' '),
      style: {
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: 2,
      },
    })
  }

  return subgraphs
}

/**
 * Build subgraphs from devices grouped by location
 */
function buildSubgraphsByLocation(devices: Map<string, DeviceData>): Subgraph[] {
  const locationDevices = new Map<string, DeviceData[]>()

  for (const device of devices.values()) {
    const location = device.location ?? device.site ?? 'unknown'
    if (!locationDevices.has(location)) {
      locationDevices.set(location, [])
    }
    locationDevices.get(location)!.push(device)
  }

  const subgraphs: Subgraph[] = []
  let styleIndex = 0

  for (const [location, devs] of locationDevices) {
    if (devs.length === 0) continue

    const style = SITE_LOCATION_STYLES[styleIndex % SITE_LOCATION_STYLES.length]
    styleIndex++

    subgraphs.push({
      id: `location-${location}`,
      label: location.charAt(0).toUpperCase() + location.slice(1).replace(/-/g, ' '),
      style: {
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: 2,
      },
    })
  }

  return subgraphs
}

/**
 * Prefix/subnet colors based on class/range
 */
const PREFIX_STYLES = [
  { fill: '#DBEAFE', stroke: '#2563EB' },  // Blue - Class A like
  { fill: '#D1FAE5', stroke: '#059669' },  // Green - Class B like
  { fill: '#FEF3C7', stroke: '#D97706' },  // Yellow - Class C like
  { fill: '#FCE7F3', stroke: '#DB2777' },  // Pink - Private
  { fill: '#E0E7FF', stroke: '#4F46E5' },  // Indigo
  { fill: '#F3E8FF', stroke: '#9333EA' },  // Purple
  { fill: '#FFEDD5', stroke: '#EA580C' },  // Orange
  { fill: '#ECFEFF', stroke: '#0891B2' },  // Cyan
]

/**
 * Extract /16 or /8 prefix from IP address for grouping
 */
function getNetworkPrefix(ip: string | undefined): string | null {
  if (!ip) return null

  const parts = ip.split('.')
  if (parts.length !== 4) return null

  // Extract /16 prefix (first two octets)
  return `${parts[0]}.${parts[1]}.0.0/16`
}

/**
 * Build subgraphs from devices grouped by IP prefix
 */
function buildSubgraphsByPrefix(devices: Map<string, DeviceData>): Subgraph[] {
  const prefixDevices = new Map<string, DeviceData[]>()

  for (const device of devices.values()) {
    const prefix = getNetworkPrefix(device.ip) ?? 'unknown'
    if (!prefixDevices.has(prefix)) {
      prefixDevices.set(prefix, [])
    }
    prefixDevices.get(prefix)!.push(device)
  }

  const subgraphs: Subgraph[] = []
  let styleIndex = 0

  // Sort prefixes numerically
  const sortedPrefixes = Array.from(prefixDevices.keys()).sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    const aNum = a.split('.').slice(0, 2).map(Number)
    const bNum = b.split('.').slice(0, 2).map(Number)
    return aNum[0] - bNum[0] || aNum[1] - bNum[1]
  })

  for (const prefix of sortedPrefixes) {
    const devs = prefixDevices.get(prefix)!
    if (devs.length === 0) continue

    const style = PREFIX_STYLES[styleIndex % PREFIX_STYLES.length]
    styleIndex++

    // Create label: "10.0.0.0/16" or "Subnet: 10.0.x.x"
    const label = prefix === 'unknown'
      ? 'Unknown Network'
      : `Subnet: ${prefix.replace('.0.0/16', '.x.x')}`

    subgraphs.push({
      id: `prefix-${prefix.replace(/[./]/g, '-')}`,
      label,
      style: {
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: 2,
      },
    })
  }

  return subgraphs
}

/**
 * Build nodes from devices
 */
function buildNodes(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>,
  groupBy: GroupBy,
  useRoleForType: boolean,
  colorByStatus: boolean = false
): Node[] {
  const nodes: Node[] = []

  for (const device of devices.values()) {
    const tagConfig = mapping[device.primaryTag]

    // Determine device type: tag config > role mapping > generic
    let deviceType = tagConfig?.type
    if (!deviceType && useRoleForType && device.role) {
      deviceType = ROLE_TO_TYPE[device.role]
    }
    deviceType = deviceType ?? 'generic'

    // Build label lines
    const labelLines: string[] = [`<b>${device.name}</b>`]

    // Add IP if available (in label since it's dynamic info)
    if (device.ip) {
      labelLines.push(device.ip)
    }

    const node: Node = {
      id: device.name,
      label: labelLines,
      shape: 'rounded',
      type: deviceType as DeviceType,
      rank: tagConfig?.level,
      model: device.model?.toLowerCase(),  // Use dedicated model field (lowercase for icon lookup)
      vendor: device.manufacturer?.toLowerCase(),  // Use vendor field
    }

    // Apply status-based styling if enabled
    if (colorByStatus && device.status) {
      const statusStyle = DEVICE_STATUS_STYLES[device.status]
      if (statusStyle && Object.keys(statusStyle).length > 0) {
        node.style = {
          ...(statusStyle.fill && { fill: statusStyle.fill }),
          ...(statusStyle.stroke && { stroke: statusStyle.stroke }),
          ...(statusStyle.strokeDasharray && { strokeDasharray: statusStyle.strokeDasharray }),
          ...(statusStyle.opacity && { opacity: statusStyle.opacity }),
        }
      }
    }

    // Set parent based on groupBy option
    if (groupBy === 'tag') {
      node.parent = `subgraph-${device.primaryTag}`
    } else if (groupBy === 'site' && device.site) {
      node.parent = `site-${device.site}`
    } else if (groupBy === 'location') {
      const loc = device.location ?? device.site
      if (loc) {
        node.parent = `location-${loc}`
      }
    } else if (groupBy === 'prefix') {
      const prefix = getNetworkPrefix(device.ip)
      if (prefix) {
        node.parent = `prefix-${prefix.replace(/[./]/g, '-')}`
      }
    }

    nodes.push(node)
  }

  return nodes
}

/**
 * Build links from connections
 */
function buildLinks(
  connections: ConnectionData[],
  showPorts: boolean,
  colorByCableType: boolean
): Link[] {
  return connections.map((conn, index) => {
    const from: LinkEndpoint = {
      node: conn.srcDev,
    }
    const to: LinkEndpoint = {
      node: conn.dstDev,
    }

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

    // Add bandwidth from interface speed
    const bandwidth = convertSpeedToBandwidth(conn.speed)
    if (bandwidth) {
      link.bandwidth = bandwidth
    }

    // Add VLANs from both endpoints
    if (conn.vlans.length > 0) {
      link.vlan = conn.vlans
    }

    // Apply cable type styling (color and line type)
    if (colorByCableType && conn.cableType) {
      const cableStyle = CABLE_STYLES[conn.cableType]
      if (cableStyle) {
        link.style = { stroke: cableStyle.color }
        if (cableStyle.type) {
          link.type = cableStyle.type
        }
      }
    }

    return link
  })
}

/**
 * VM node style (dashed border to distinguish from physical servers)
 */
const VM_NODE_STYLE = {
  strokeDasharray: '4,4',
  opacity: 0.9,
}

/**
 * Convert NetBox data with VMs to Shumoku NetworkGraph
 * This is an extended version that includes virtual machines
 */
export function convertToNetworkGraphWithVMs(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  vmResp: NetBoxVirtualMachineResponse,
  vmInterfaceResp: NetBoxVMInterfaceResponse,
  options: ConverterOptions = {}
): NetworkGraph {
  // First, get the base graph without VMs
  const graph = convertToNetworkGraph(deviceResp, interfaceResp, cableResp, options)

  if (!options.includeVMs) {
    return graph
  }

  const colorByStatus = options.colorByStatus ?? false
  const groupVMsByCluster = options.groupVMsByCluster ?? false

  // Build VM VLAN map from VM interfaces
  const vmVlanMap = new Map<string, number[]>()
  for (const vmIface of vmInterfaceResp.results) {
    const vmName = vmIface.virtual_machine.name
    const vlans = new Set<number>()

    if (vmIface.untagged_vlan?.vid) {
      vlans.add(vmIface.untagged_vlan.vid)
    }
    for (const tv of vmIface.tagged_vlans) {
      vlans.add(tv.vid)
    }

    if (!vmVlanMap.has(vmName)) {
      vmVlanMap.set(vmName, [])
    }
    vmVlanMap.get(vmName)!.push(...vlans)
  }

  // Create cluster subgraphs if grouping is enabled
  const clusterSubgraphs: Subgraph[] = []
  if (groupVMsByCluster) {
    const clusters = new Set<string>()
    for (const vm of vmResp.results) {
      if (vm.cluster) {
        clusters.add(vm.cluster.slug)
      }
    }

    let styleIdx = 0
    for (const clusterSlug of clusters) {
      const vm = vmResp.results.find(v => v.cluster?.slug === clusterSlug)
      const clusterName = vm?.cluster?.name ?? clusterSlug

      const style = SITE_LOCATION_STYLES[styleIdx % SITE_LOCATION_STYLES.length]
      styleIdx++

      clusterSubgraphs.push({
        id: `cluster-${clusterSlug}`,
        label: clusterName,
        style: {
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: 2,
          strokeDasharray: '4,2',  // Dashed border for VM clusters
        },
      })
    }
  }

  // Convert VMs to nodes
  const vmNodes: Node[] = vmResp.results.map(vm => {
    const labelLines: string[] = [`<b>${vm.name}</b>`]

    // Add IP if available
    const ip = vm.primary_ip4?.address?.split('/')[0] ?? vm.primary_ip6?.address?.split('/')[0]
    if (ip) {
      labelLines.push(ip)
    }

    // Add resource info (vcpus, memory)
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
      type: 'server' as DeviceType,  // VMs are displayed as servers
      style: { ...VM_NODE_STYLE },
      metadata: {
        isVirtualMachine: true,
        cluster: vm.cluster?.slug,
        vcpus: vm.vcpus,
        memory: vm.memory,
        disk: vm.disk,
      },
    }

    // Apply status styling if enabled
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

    // Set parent if grouping by cluster
    if (groupVMsByCluster && vm.cluster) {
      node.parent = `cluster-${vm.cluster.slug}`
    }

    return node
  })

  // Add VM nodes and cluster subgraphs to the graph
  graph.nodes.push(...vmNodes)

  if (clusterSubgraphs.length > 0) {
    if (!graph.subgraphs) {
      graph.subgraphs = []
    }
    graph.subgraphs.push(...clusterSubgraphs)
  }

  return graph
}

/**
 * Generate YAML string from NetworkGraph
 */
export function toYaml(graph: NetworkGraph): string {
  const lines: string[] = []

  lines.push(`name: "${graph.name ?? 'Network Topology'}"`)
  if (graph.description) {
    lines.push(`description: "${graph.description}"`)
  }
  lines.push('')

  // Settings
  if (graph.settings) {
    lines.push('settings:')
    if (graph.settings.direction) {
      lines.push(`  direction: ${graph.settings.direction}`)
    }
    if (graph.settings.theme) {
      lines.push(`  theme: ${graph.settings.theme}`)
    }
    lines.push('')
  }

  // Subgraphs
  if (graph.subgraphs && graph.subgraphs.length > 0) {
    lines.push('subgraphs:')
    for (const sg of graph.subgraphs) {
      lines.push(`  - id: ${sg.id}`)
      lines.push(`    label: "${sg.label}"`)
      if (sg.style) {
        lines.push('    style:')
        if (sg.style.fill) lines.push(`      fill: "${sg.style.fill}"`)
        if (sg.style.stroke) lines.push(`      stroke: "${sg.style.stroke}"`)
        if (sg.style.strokeWidth) lines.push(`      strokeWidth: ${sg.style.strokeWidth}`)
      }
    }
    lines.push('')
  }

  // Nodes
  lines.push('nodes:')
  for (const node of graph.nodes) {
    lines.push(`  - id: ${node.id}`)

    if (Array.isArray(node.label)) {
      lines.push('    label:')
      for (const line of node.label) {
        lines.push(`      - "${line}"`)
      }
    } else {
      lines.push(`    label: "${node.label}"`)
    }

    if (node.type) {
      lines.push(`    type: ${node.type}`)
    }
    if (node.vendor) {
      lines.push(`    vendor: ${node.vendor}`)
    }
    if (node.model) {
      lines.push(`    model: ${node.model}`)
    }
    if (node.parent) {
      lines.push(`    parent: ${node.parent}`)
    }
    if (node.rank !== undefined) {
      lines.push(`    rank: ${node.rank}`)
    }
  }
  lines.push('')

  // Links
  lines.push('links:')
  for (const link of graph.links) {
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

    // Add bandwidth
    if (link.bandwidth) {
      lines.push(`    bandwidth: ${link.bandwidth}`)
    }

    // Add link type (solid, dashed, etc.)
    if (link.type) {
      lines.push(`    type: ${link.type}`)
    }

    // Add VLANs
    if (link.vlan && link.vlan.length > 0) {
      lines.push(`    vlan: [${link.vlan.join(', ')}]`)
    }

    // Add style
    if (link.style?.stroke) {
      lines.push('    style:')
      lines.push(`      stroke: "${link.style.stroke}"`)
    }
  }

  return lines.join('\n')
}
