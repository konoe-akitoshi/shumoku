/**
 * NetBox API Types
 * Based on NetBox REST API responses
 */

import type { LegendSettings, LinkBandwidth, LinkType } from '@shumoku/core/models'

// ============================================
// NetBox API Response Types
// ============================================

export interface NetBoxTag {
  slug: string
  name: string
}

export interface NetBoxDeviceType {
  model: string
  manufacturer?: {
    name: string
    slug: string
  }
}

export interface NetBoxDeviceStatus {
  value: 'active' | 'planned' | 'staged' | 'failed' | 'offline' | 'inventory' | 'decommissioning'
  label: string
}

export interface NetBoxDevice {
  id: number
  name: string | null
  tags: NetBoxTag[]
  device_type?: NetBoxDeviceType
  primary_ip4?: {
    address: string
  }
  primary_ip6?: {
    address: string
  }
  serial?: string
  status?: NetBoxDeviceStatus
  role?: {
    name: string
    slug: string
  }
  site?: {
    id: number
    name: string
    slug: string
  }
  location?: {
    id: number
    name: string
    slug: string
  }
  rack?: {
    id: number
    name: string
  }
}

export interface NetBoxDeviceResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxDevice[]
}

export interface NetBoxVlan {
  vid: number
  name: string
}

export interface NetBoxInterface {
  id: number
  name: string
  device: {
    id: number
    name: string
  }
  type?: {
    value: string // e.g., '1000base-t', '10gbase-x-sfpp', '25gbase-x-sfp28'
    label: string
  }
  enabled: boolean
  mac_address?: string
  mtu?: number
  mode?: {
    value: string // 'access', 'tagged', 'tagged-all'
    label: string
  }
  untagged_vlan: NetBoxVlan | null
  tagged_vlans: NetBoxVlan[]
  speed: number | null // kbps
  duplex?: {
    value: string // 'half', 'full', 'auto'
    label: string
  } | null
  description?: string
  cable?: {
    id: number
    label: string
  }
  connected_endpoints?: Array<{
    id: number
    name: string
    device: {
      id: number
      name: string
    }
  }>
}

export interface NetBoxInterfaceResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxInterface[]
}

export interface NetBoxTermination {
  object: {
    name: string
    device: {
      id: number
      name: string | null
    }
  }
}

export interface NetBoxCable {
  id: number
  type: string
  a_terminations: NetBoxTermination[]
  b_terminations: NetBoxTermination[]
  status?: {
    value: string
    label: string
  }
  label?: string
  color?: string // Hex color without #
  length?: number
  length_unit?: {
    value: string // 'm', 'cm', 'ft', 'in'
    label: string
  }
  description?: string
}

export interface NetBoxCableResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxCable[]
}

// ============================================
// Virtual Machine Types
// ============================================

export interface NetBoxCluster {
  id: number
  name: string
  slug: string
}

export interface NetBoxVirtualMachineStatus {
  value: 'active' | 'planned' | 'staged' | 'failed' | 'offline' | 'decommissioning'
  label: string
}

export interface NetBoxVirtualMachine {
  id: number
  name: string
  status: NetBoxVirtualMachineStatus
  cluster?: NetBoxCluster
  primary_ip4?: {
    address: string
  }
  primary_ip6?: {
    address: string
  }
  vcpus?: number
  memory?: number // MB
  disk?: number // GB
  role?: {
    id: number
    name: string
    slug: string
  }
  tags: NetBoxTag[]
}

export interface NetBoxVirtualMachineResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxVirtualMachine[]
}

export interface NetBoxVMInterface {
  id: number
  name: string
  virtual_machine: {
    id: number
    name: string
  }
  enabled: boolean
  mac_address?: string
  untagged_vlan?: NetBoxVlan
  tagged_vlans: NetBoxVlan[]
}

export interface NetBoxVMInterfaceResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxVMInterface[]
}

// ============================================
// Prefix/IPAM Types
// ============================================

export interface NetBoxPrefix {
  id: number
  prefix: string // CIDR notation e.g. "10.0.0.0/24"
  site?: {
    id: number
    name: string
    slug: string
  }
  vlan?: NetBoxVlan
  role?: {
    id: number
    name: string
    slug: string
  }
  description: string
  is_pool: boolean
  status: {
    value: 'active' | 'reserved' | 'deprecated' | 'container'
    label: string
  }
}

export interface NetBoxPrefixResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxPrefix[]
}

export interface NetBoxIPAddress {
  id: number
  address: string // CIDR notation e.g. "10.0.0.1/24"
  status: {
    value: 'active' | 'reserved' | 'deprecated' | 'dhcp' | 'slaac'
    label: string
  }
  assigned_object?: {
    id: number
    name: string
    device?: {
      id: number
      name: string
    }
    virtual_machine?: {
      id: number
      name: string
    }
  }
  dns_name?: string
}

export interface NetBoxIPAddressResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxIPAddress[]
}

// ============================================
// Site and Location Types (Phase 4)
// ============================================

export interface NetBoxSite {
  id: number
  name: string
  slug: string
  status: {
    value: string
    label: string
  }
  region?: {
    id: number
    name: string
    slug: string
  }
  description: string
}

export interface NetBoxSiteResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxSite[]
}

export interface NetBoxLocation {
  id: number
  name: string
  slug: string
  site: {
    id: number
    name: string
    slug: string
  }
  parent?: {
    id: number
    name: string
    slug: string
  }
  description: string
}

export interface NetBoxLocationResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxLocation[]
}

export interface NetBoxTagFull {
  id: number
  name: string
  slug: string
  color: string
  description: string
}

export interface NetBoxTagResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxTagFull[]
}

export interface NetBoxDeviceRole {
  id: number
  name: string
  slug: string
  color: string
  description: string
}

export interface NetBoxDeviceRoleResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxDeviceRole[]
}

// ============================================
// Tag Mapping Configuration
// ============================================

export type DeviceTypeString =
  | 'router'
  | 'l3-switch'
  | 'l2-switch'
  | 'server'
  | 'access-point'
  | 'firewall'
  | 'load-balancer'
  | 'generic'

export interface TagMapping {
  type: DeviceTypeString
  level: number
  subgraph: string
}

/**
 * Default tag to device type/level mapping
 * Based on network-topology hierarchy
 */
export const DEFAULT_TAG_MAPPING: Record<string, TagMapping> = {
  ocx: { type: 'l3-switch', level: 0, subgraph: 'OCX' },
  onu: { type: 'router', level: 1, subgraph: 'ONU' },
  router: { type: 'router', level: 2, subgraph: 'Router' },
  'core-switch': { type: 'l3-switch', level: 3, subgraph: 'Core Switch' },
  'edge-switch': { type: 'l2-switch', level: 4, subgraph: 'Edge Switch' },
  server: { type: 'server', level: 5, subgraph: 'Server' },
  ap: { type: 'access-point', level: 5, subgraph: 'AP' },
  'console-server': { type: 'server', level: 6, subgraph: 'Console Server' },
}

/**
 * Tag priority order for resolving primary tag
 */
export const TAG_PRIORITY = [
  'ocx',
  'onu',
  'router',
  'core-switch',
  'edge-switch',
  'server',
  'console-server',
  'ap',
]

// ============================================
// Cable Type Styles
// ============================================

export interface CableStyle {
  color: string
  type?: LinkType // 'dashed' for DAC/AOC, undefined for solid
}

/**
 * Cable type to style mapping
 * Based on fiber/copper standards
 */
export const CABLE_STYLES: Record<string, CableStyle> = {
  // Fiber - solid lines
  'mmf-om3': { color: '#10b981' }, // Green - OM3 multimode
  'mmf-om4': { color: '#06b6d4' }, // Cyan - OM4 multimode
  smf: { color: '#eab308' }, // Yellow - singlemode
  'smf-os1': { color: '#eab308' }, // Yellow - OS1 singlemode
  'smf-os2': { color: '#f59e0b' }, // Amber - OS2 singlemode
  // Copper - solid lines
  cat5e: { color: '#6b7280' }, // Gray - Cat5e
  cat6: { color: '#3b82f6' }, // Blue - Cat6
  cat6a: { color: '#8b5cf6' }, // Purple - Cat6a
  cat7: { color: '#ec4899' }, // Pink - Cat7
  cat8: { color: '#f43f5e' }, // Rose - Cat8
  // DAC/AOC - dashed lines
  'dac-passive': { color: '#f97316', type: 'dashed' }, // Orange
  'dac-active': { color: '#ef4444', type: 'dashed' }, // Red
  aoc: { color: '#ec4899', type: 'dashed' }, // Pink
}

// Legacy compatibility
export const CABLE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(CABLE_STYLES).map(([k, v]) => [k, v.color]),
)

// ============================================
// Speed to Bandwidth Conversion
// ============================================

/**
 * Convert interface speed (kbps) to LinkBandwidth
 * @param speedKbps Speed in kbps from NetBox
 * @returns LinkBandwidth or undefined
 */
export function convertSpeedToBandwidth(speedKbps: number | null): LinkBandwidth | undefined {
  if (!speedKbps) return undefined

  const speedGbps = speedKbps / 1_000_000

  if (speedGbps >= 100) return '100G'
  if (speedGbps >= 40) return '40G'
  if (speedGbps >= 25) return '25G'
  if (speedGbps >= 10) return '10G'
  return '1G'
}

// ============================================
// Device Role Mapping
// ============================================

/**
 * Map NetBox device role slugs to Shumoku device types
 */
export const ROLE_TO_TYPE: Record<string, DeviceTypeString> = {
  router: 'router',
  'core-router': 'router',
  'border-router': 'router',
  'edge-router': 'router',
  switch: 'l2-switch',
  'access-switch': 'l2-switch',
  'distribution-switch': 'l3-switch',
  'core-switch': 'l3-switch',
  firewall: 'firewall',
  server: 'server',
  'virtual-machine': 'server',
  'access-point': 'access-point',
  'wireless-ap': 'access-point',
  ap: 'access-point',
  'load-balancer': 'load-balancer',
}

// ============================================
// VLAN Colors (for visual distinction)
// ============================================

/**
 * Generate a color for a VLAN ID
 * Uses HSL color space for visual variety
 */
export function getVlanColor(vid: number): string {
  const hue = (vid * 137) % 360 // Golden angle for distribution
  return `hsl(${hue}, 70%, 50%)`
}

// ============================================
// Device Status Styles
// ============================================

export type DeviceStatusValue =
  | 'active'
  | 'planned'
  | 'staged'
  | 'failed'
  | 'offline'
  | 'inventory'
  | 'decommissioning'

export interface DeviceStatusStyle {
  fill?: string
  stroke?: string
  strokeDasharray?: string
  opacity?: number
}

/**
 * Status-based device styling
 * - active: default (no special styling)
 * - planned: dashed border, light gray
 * - staged: yellow tint
 * - failed: red tint
 * - offline: gray, reduced opacity
 * - inventory: blue tint (in stock)
 * - decommissioning: orange tint
 */
export const DEVICE_STATUS_STYLES: Record<DeviceStatusValue, DeviceStatusStyle> = {
  active: {}, // Default styling
  planned: {
    stroke: '#9CA3AF',
    strokeDasharray: '5,5',
    opacity: 0.7,
  },
  staged: {
    fill: '#FEF3C7',
    stroke: '#F59E0B',
  },
  failed: {
    fill: '#FEE2E2',
    stroke: '#EF4444',
  },
  offline: {
    fill: '#F3F4F6',
    stroke: '#6B7280',
    opacity: 0.5,
  },
  inventory: {
    fill: '#DBEAFE',
    stroke: '#3B82F6',
    strokeDasharray: '3,3',
    opacity: 0.8,
  },
  decommissioning: {
    fill: '#FFEDD5',
    stroke: '#F97316',
    strokeDasharray: '8,4',
    opacity: 0.6,
  },
}

// ============================================
// Internal Data Structures
// ============================================

export interface DeviceData {
  name: string
  primaryTag: string
  ports: Set<string>
  portVlans: Map<string, number[]>
  portSpeeds: Map<string, number | null>
  model?: string
  manufacturer?: string
  ip?: string
  role?: string // device role slug
  site?: string // site slug
  location?: string // location slug
  status?: DeviceStatusValue // device status
}

export interface ConnectionData {
  srcDev: string
  srcPort: string
  srcLevel: number
  dstDev: string
  dstPort: string
  dstLevel: number
  dstTag: string
  cableType: string
  cableColor?: string // Hex color from cable
  cableLabel?: string // Label from cable
  cableLength?: string // Length with unit from cable
  speed: number | null // kbps from interface
  vlans: number[] // VLANs from both endpoints
}

// ============================================
// Converter Options
// ============================================

export type GroupBy = 'tag' | 'site' | 'location' | 'prefix' | 'none'

export interface ConverterOptions {
  /**
   * Custom tag mapping (merged with defaults)
   */
  tagMapping?: Record<string, TagMapping>

  /**
   * Theme for generated diagram
   */
  theme?: 'light' | 'dark'

  /**
   * Show port names on links
   */
  showPorts?: boolean

  /**
   * Show VLAN information on links
   */
  showVlans?: boolean

  /**
   * Color links by cable type
   */
  colorByCableType?: boolean

  /**
   * Group devices by tag into subgraphs
   * @deprecated Use groupBy instead
   */
  groupByTag?: boolean

  /**
   * How to group devices into subgraphs
   * - 'tag': Group by NetBox tags (default)
   * - 'site': Group by NetBox site
   * - 'location': Group by NetBox location
   * - 'none': No grouping
   */
  groupBy?: GroupBy

  /**
   * Use device role as fallback for type detection
   * When enabled, if no matching tag is found, the device role is used
   */
  useRoleForType?: boolean

  /**
   * Color devices based on their status
   * - active: default color
   * - planned: dashed border
   * - staged: yellow
   * - failed: red
   * - offline: gray
   */
  colorByStatus?: boolean

  /**
   * Include virtual machines in the topology
   * VMs are rendered as server nodes with dashed borders
   */
  includeVMs?: boolean

  /**
   * Group VMs by cluster into subgraphs
   */
  groupVMsByCluster?: boolean

  /**
   * Show legend in the diagram
   * - true: Show legend with default settings
   * - LegendSettings: Customize legend position and content
   */
  legend?: boolean | LegendSettings
}

// ============================================
// Client Options
// ============================================

export interface NetBoxClientOptions {
  /**
   * NetBox API URL (e.g., "https://netbox.example.com")
   */
  url: string

  /**
   * NetBox API token
   */
  token: string

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number

  /**
   * Enable debug output for API requests/responses
   */
  debug?: boolean

  /**
   * Skip TLS certificate verification (for self-signed certs)
   */
  insecure?: boolean
}
