/**
 * NetBox API types: the parts of the REST responses (NetBox 4.2 and later) that the mapping in
 * `docs/plugins/netbox-mapping.md` reads. Every field a response may leave out or null is
 * optional here, so a trimmed `?fields=` response and a full one read the same.
 */

// ============================================
// Shared shapes
// ============================================

/** A choice field: `{ value, label }`. */
export interface NetBoxChoice {
  value: string
  label?: string
}

/** A nested object as NetBox summarises it. */
export interface NetBoxRef {
  id: number
  name?: string
  slug?: string
}

export interface NetBoxVlanRef {
  id: number
  vid: number
  name?: string
}

/** The device or VM interface a nested object names. */
export interface NetBoxInterfaceRef {
  id: number
  name: string
  device?: { id: number; name: string | null }
  virtual_machine?: { id: number; name: string }
  cable?: { id: number } | null
}

// ============================================
// DCIM
// ============================================

export interface NetBoxDevice {
  id: number
  name: string | null
  url?: string
  status?: NetBoxChoice
  role?: NetBoxRef
  device_type?: {
    model?: string
    slug: string
    manufacturer?: { name?: string; slug: string }
  }
  platform?: { name: string } | null
  site?: NetBoxRef | null
  location?: NetBoxRef | null
  rack?: NetBoxRef | null
  primary_ip4?: { id?: number; address: string } | null
  primary_ip6?: { id?: number; address: string } | null
  cluster?: NetBoxRef | null
  virtual_chassis?: NetBoxRef | null
  vc_position?: number | null
  serial?: string
  asset_tag?: string | null
  description?: string
  /** Counts of what the device holds; a device with ports but no interface is a patch panel. */
  interface_count?: number
  front_port_count?: number
  rear_port_count?: number
}

/** The far end of a traced cable path: an interface, or a provider network. */
export interface NetBoxEndpoint {
  id: number
  name?: string
  device?: { id: number; name: string | null }
  cable?: { id: number } | null
}

export interface NetBoxLinkPeer extends NetBoxEndpoint {
  /** Set on a circuit termination peer. */
  circuit?: { id: number; cid: string }
}

export interface NetBoxInterface {
  id: number
  name: string
  device: { id: number; name: string | null }
  type?: NetBoxChoice
  enabled?: boolean
  mgmt_only?: boolean
  /** kbps */
  speed?: number | null
  mode?: NetBoxChoice | null
  untagged_vlan?: NetBoxVlanRef | null
  tagged_vlans?: NetBoxVlanRef[]
  parent?: NetBoxInterfaceRef | null
  lag?: NetBoxInterfaceRef | null
  primary_mac_address?: { mac_address: string } | null
  cable?: { id: number } | null
  wireless_link?: { id: number } | null
  link_peers_type?: string | null
  link_peers?: NetBoxLinkPeer[] | null
  connected_endpoints?: NetBoxEndpoint[] | null
  connected_endpoints_type?: string | null
  connected_endpoints_reachable?: boolean
}

export interface NetBoxCable {
  id: number
  type?: string | null
  label?: string
  length?: number | null
  length_unit?: NetBoxChoice | null
}

export interface NetBoxSite {
  id: number
  name: string
  slug: string
  asns?: Array<{ id: number; asn: number }>
}

export interface NetBoxLocation {
  id: number
  name: string
  slug: string
  site?: NetBoxRef | null
  parent?: NetBoxRef | null
}

export interface NetBoxVirtualChassis {
  id: number
  name: string
  master?: NetBoxRef | null
  members?: NetBoxRef[]
}

export interface NetBoxDeviceRole {
  id: number
  name: string
  slug: string
}

export interface NetBoxTag {
  id: number
  name: string
  slug: string
}

// ============================================
// Virtualization
// ============================================

export interface NetBoxClusterType {
  id: number
  name: string
  slug: string
}

export interface NetBoxCluster {
  id: number
  name: string
  type?: NetBoxRef
  scope_type?: string | null
  scope_id?: number | null
}

export interface NetBoxVirtualMachine {
  id: number
  name: string
  url?: string
  status?: NetBoxChoice
  site?: NetBoxRef | null
  cluster?: NetBoxRef | null
  device?: { id: number; name: string | null } | null
  role?: NetBoxRef | null
  platform?: { name: string } | null
  primary_ip4?: { id?: number; address: string } | null
  primary_ip6?: { id?: number; address: string } | null
  vcpus?: number | null
  memory?: number | null
  disk?: number | null
  description?: string
}

export interface NetBoxVMInterface {
  id: number
  name: string
  virtual_machine: { id: number; name: string }
  mode?: NetBoxChoice | null
  untagged_vlan?: NetBoxVlanRef | null
  tagged_vlans?: NetBoxVlanRef[]
  parent?: NetBoxInterfaceRef | null
  primary_mac_address?: { mac_address: string } | null
}

// ============================================
// IPAM
// ============================================

export interface NetBoxVlan {
  id: number
  vid: number
  name: string
}

export interface NetBoxVrf {
  id: number
  name: string
}

export interface NetBoxPrefix {
  id: number
  prefix: string
  vrf?: NetBoxRef | null
  vlan?: NetBoxVlanRef | null
  status?: NetBoxChoice
  scope_type?: string | null
  scope_id?: number | null
}

export interface NetBoxIPAddress {
  id: number
  address: string
  vrf?: NetBoxRef | null
  role?: NetBoxChoice | null
  assigned_object_type?: string | null
  assigned_object_id?: number | null
}

export interface NetBoxAsn {
  id: number
  asn: number
  sites?: NetBoxRef[]
}

export interface NetBoxFhrpGroup {
  id: number
  name?: string
  protocol: string
  group_id: number
  ip_addresses?: Array<{ id: number; address: string }>
}

export interface NetBoxFhrpAssignment {
  id: number
  group: { id: number }
  interface_type: string
  interface_id: number
  priority?: number
}

// ============================================
// Circuits
// ============================================

export interface NetBoxProvider {
  id: number
  name: string
  slug: string
  asns?: Array<{ id: number; asn: number }>
}

export interface NetBoxProviderNetwork {
  id: number
  name: string
  provider?: NetBoxRef
}

export interface NetBoxCircuit {
  id: number
  cid: string
  provider?: NetBoxRef
  type?: NetBoxRef
  status?: NetBoxChoice
  /** kbps */
  commit_rate?: number | null
}

export interface NetBoxCircuitTermination {
  id: number
  circuit: { id: number; cid?: string }
  term_side?: string
  termination_type?: string | null
  termination_id?: number | null
  /** kbps */
  port_speed?: number | null
  cable?: { id: number } | null
  link_peers_type?: string | null
  link_peers?: NetBoxLinkPeer[] | null
}

export interface NetBoxVirtualCircuit {
  id: number
  cid: string
  provider_network?: NetBoxRef
  status?: NetBoxChoice
}

export interface NetBoxVirtualCircuitTermination {
  id: number
  virtual_circuit: { id: number; cid?: string }
  role?: NetBoxChoice
  interface?: NetBoxInterfaceRef
}

// ============================================
// VPN and wireless
// ============================================

export interface NetBoxTunnelGroup {
  id: number
  name: string
  slug: string
}

export interface NetBoxTunnel {
  id: number
  name: string
  status?: NetBoxChoice
  group?: NetBoxRef | null
  encapsulation?: NetBoxChoice
}

export interface NetBoxTunnelTermination {
  id: number
  tunnel: { id: number }
  role?: NetBoxChoice
  termination_type?: string | null
  termination_id?: number | null
}

export interface NetBoxL2vpn {
  id: number
  name: string
  slug: string
  type?: NetBoxChoice
  status?: NetBoxChoice
}

export interface NetBoxL2vpnTermination {
  id: number
  l2vpn: { id: number }
  assigned_object_type?: string | null
  assigned_object_id?: number | null
}

export interface NetBoxWirelessLink {
  id: number
  interface_a: NetBoxInterfaceRef
  interface_b: NetBoxInterfaceRef
  ssid?: string
  status?: NetBoxChoice
  distance?: number | null
  distance_unit?: NetBoxChoice | null
}

// ============================================
// Everything one sync reads
// ============================================

/** The recorded or fetched lists the converter maps. Families a NetBox lacks are empty. */
export interface NetBoxData {
  devices: NetBoxDevice[]
  interfaces: NetBoxInterface[]
  cables: NetBoxCable[]
  sites: NetBoxSite[]
  locations: NetBoxLocation[]
  virtualChassis: NetBoxVirtualChassis[]
  clusters: NetBoxCluster[]
  virtualMachines: NetBoxVirtualMachine[]
  vmInterfaces: NetBoxVMInterface[]
  vlans: NetBoxVlan[]
  vrfs: NetBoxVrf[]
  prefixes: NetBoxPrefix[]
  ipAddresses: NetBoxIPAddress[]
  asns: NetBoxAsn[]
  fhrpGroups: NetBoxFhrpGroup[]
  fhrpAssignments: NetBoxFhrpAssignment[]
  providers: NetBoxProvider[]
  providerNetworks: NetBoxProviderNetwork[]
  circuits: NetBoxCircuit[]
  circuitTerminations: NetBoxCircuitTermination[]
  virtualCircuits: NetBoxVirtualCircuit[]
  virtualCircuitTerminations: NetBoxVirtualCircuitTermination[]
  tunnelGroups: NetBoxTunnelGroup[]
  tunnels: NetBoxTunnel[]
  tunnelTerminations: NetBoxTunnelTermination[]
  l2vpns: NetBoxL2vpn[]
  l2vpnTerminations: NetBoxL2vpnTermination[]
  wirelessLinks: NetBoxWirelessLink[]
}

export function emptyNetBoxData(): NetBoxData {
  return {
    devices: [],
    interfaces: [],
    cables: [],
    sites: [],
    locations: [],
    virtualChassis: [],
    clusters: [],
    virtualMachines: [],
    vmInterfaces: [],
    vlans: [],
    vrfs: [],
    prefixes: [],
    ipAddresses: [],
    asns: [],
    fhrpGroups: [],
    fhrpAssignments: [],
    providers: [],
    providerNetworks: [],
    circuits: [],
    circuitTerminations: [],
    virtualCircuits: [],
    virtualCircuitTerminations: [],
    tunnelGroups: [],
    tunnels: [],
    tunnelTerminations: [],
    l2vpns: [],
    l2vpnTerminations: [],
    wirelessLinks: [],
  }
}

// ============================================
// Mapping options
// ============================================

/** How deep the places go: the site, the locations within it, or down to the rack. */
export type GroupDepth = 'site' | 'location' | 'rack'

export interface ConverterOptions {
  /** How deep to nest the places. Default `location`. */
  groupDepth?: GroupDepth
  /**
   * Cluster type slugs that are a cloud (`aws`, `azure`...). Such a cluster becomes a `cloud`
   * node that hosts its VMs. Nothing is inferred from names.
   */
  cloudClusterTypes?: readonly string[]
  /** The node type for a device role slug, over the built-in {@link ROLE_TO_TYPE}. */
  roleTypes?: Readonly<Record<string, string>>
  /** Device and VM statuses that are drawn. Default {@link DEFAULT_DEVICE_STATUSES}. */
  statuses?: readonly string[]
  /** Circuit and virtual circuit statuses that are drawn. Default {@link DEFAULT_CIRCUIT_STATUSES}. */
  circuitStatuses?: readonly string[]
}

/** The network as it is now: not what is planned or in stock. */
export const DEFAULT_DEVICE_STATUSES: readonly string[] = [
  'active',
  'staged',
  'offline',
  'failed',
  'decommissioning',
]

export const DEFAULT_CIRCUIT_STATUSES: readonly string[] = [
  'active',
  'offline',
  'provisioning',
  'deprovisioning',
]

/** Filters that pick which devices are fetched; they do not change the mapping. */
export interface FetchFilters {
  site?: readonly string[]
  tag?: readonly string[]
  role?: readonly string[]
  excludeRole?: readonly string[]
  excludeTag?: readonly string[]
  tenant?: readonly string[]
}

// ============================================
// Device role -> node type
// ============================================

/** Device role slugs NetBox installs commonly use. Others are named with the `roleTypes` option. */
export const ROLE_TO_TYPE: Readonly<Record<string, string>> = {
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
  'access-point': 'access-point',
  'wireless-ap': 'access-point',
  ap: 'access-point',
  'load-balancer': 'load-balancer',
}

// ============================================
// Interface speed
// ============================================

/**
 * Nominal speed (kbps) derived from a NetBox interface *type* slug.
 *
 * NetBox's `Interface.speed` is officially "the operating speed" — an optional
 * field operators rarely populate. The nominal capacity lives in `type`, a
 * required field with a closed, NetBox-maintained enum whose Ethernet entries
 * follow IEEE 802.3 naming — the leading number IS the standardized data rate
 * (`1000base-t` = 1000 Mb/s, `100gbase-x-qsfp28` = 100 Gb/s, `1.6tbase-dr8` =
 * 1.6 Tb/s). Fibre Channel (`32gfc-…`) encodes gigabits the same way.
 *
 * Returns null for entries with no fixed nominal rate (virtual / lag / bridge,
 * wireless, cellular, SONET OC-n, InfiniBand generations, …) — no rate is
 * better than a made-up one.
 */
export function nominalSpeedFromInterfaceType(type: string | undefined): number | null {
  if (!type) return null
  const tera = type.match(/^(\d+(?:\.\d+)?)tbase/)
  if (tera?.[1]) return Math.round(Number.parseFloat(tera[1]) * 1_000_000_000)
  const giga = type.match(/^(\d+(?:\.\d+)?)(?:gbase|gfc)/)
  if (giga?.[1]) return Math.round(Number.parseFloat(giga[1]) * 1_000_000)
  const mega = type.match(/^(\d+)base/)
  if (mega?.[1]) return Number.parseInt(mega[1], 10) * 1_000
  return null
}

// ============================================
// Client and plugin configuration
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

export interface NetBoxPluginConfig {
  url: string
  token: string
  /** Skip TLS certificate verification (for self-signed certs) */
  insecure?: boolean
}
