/**
 * NetBox API Client
 */

import { createHttpClient, type HttpClient, HttpError, paginate } from '@shumoku/plugin-sdk'
import { directCableId } from './paths.js'
import type {
  FetchFilters,
  NetBoxAsn,
  NetBoxCable,
  NetBoxCircuit,
  NetBoxCircuitTermination,
  NetBoxClientOptions,
  NetBoxCluster,
  NetBoxClusterType,
  NetBoxData,
  NetBoxDevice,
  NetBoxDeviceRole,
  NetBoxFhrpAssignment,
  NetBoxFhrpGroup,
  NetBoxInterface,
  NetBoxIPAddress,
  NetBoxL2vpn,
  NetBoxL2vpnTermination,
  NetBoxLocation,
  NetBoxPrefix,
  NetBoxProvider,
  NetBoxProviderNetwork,
  NetBoxSite,
  NetBoxTag,
  NetBoxTunnel,
  NetBoxTunnelGroup,
  NetBoxTunnelTermination,
  NetBoxVirtualChassis,
  NetBoxVirtualCircuit,
  NetBoxVirtualCircuitTermination,
  NetBoxVirtualMachine,
  NetBoxVlan,
  NetBoxVMInterface,
  NetBoxVrf,
  NetBoxWirelessLink,
} from './types.js'
import { emptyNetBoxData } from './types.js'

/** A query value: one, or several that NetBox ORs together. */
export type QueryValue = string | number | boolean | readonly string[] | undefined

/** Query parameters for filtering API requests (`site=hq`, `status__n=deprecated`...). */
export type QueryParams = Record<string, QueryValue>

/**
 * The fields each call asks for (`?fields=`, NetBox 4.0+). `?brief=true` is never used: brief
 * drops the nested objects the mapping reads.
 */
const FIELDS = {
  devices: [
    'id',
    'name',
    'status',
    'role',
    'device_type',
    'platform',
    'site',
    'location',
    'rack',
    'primary_ip4',
    'primary_ip6',
    'cluster',
    'virtual_chassis',
    'vc_position',
    'serial',
    'asset_tag',
    'description',
    'url',
    'interface_count',
    'front_port_count',
    'rear_port_count',
  ],
  interfaces: [
    'id',
    'name',
    'device',
    'type',
    'enabled',
    'mgmt_only',
    'speed',
    'mode',
    'untagged_vlan',
    'tagged_vlans',
    'parent',
    'lag',
    'primary_mac_address',
    'cable',
    'wireless_link',
    'link_peers',
    'link_peers_type',
    'connected_endpoints',
    'connected_endpoints_type',
    'connected_endpoints_reachable',
  ],
  cables: ['id', 'type', 'label', 'length', 'length_unit'],
  sites: ['id', 'name', 'slug', 'asns'],
  locations: ['id', 'name', 'slug', 'parent', 'site'],
  virtualChassis: ['id', 'name', 'master', 'members'],
  clusters: ['id', 'name', 'type', 'scope_type', 'scope_id'],
  virtualMachines: [
    'id',
    'name',
    'status',
    'site',
    'cluster',
    'device',
    'role',
    'platform',
    'primary_ip4',
    'primary_ip6',
    'vcpus',
    'memory',
    'disk',
    'description',
    'url',
  ],
  vmInterfaces: [
    'id',
    'name',
    'virtual_machine',
    'mode',
    'untagged_vlan',
    'tagged_vlans',
    'parent',
    'primary_mac_address',
  ],
  vlans: ['id', 'vid', 'name'],
  vrfs: ['id', 'name'],
  prefixes: ['id', 'prefix', 'vrf', 'vlan', 'status', 'scope_type', 'scope_id'],
  ipAddresses: ['id', 'address', 'vrf', 'role', 'assigned_object_type', 'assigned_object_id'],
  asns: ['id', 'asn', 'sites'],
  fhrpGroups: ['id', 'name', 'protocol', 'group_id', 'ip_addresses'],
  fhrpAssignments: ['id', 'group', 'interface_type', 'interface_id', 'priority'],
  providers: ['id', 'name', 'slug', 'asns'],
  providerNetworks: ['id', 'name', 'provider'],
  circuits: ['id', 'cid', 'provider', 'type', 'status', 'commit_rate'],
  circuitTerminations: [
    'id',
    'circuit',
    'term_side',
    'termination_type',
    'termination_id',
    'port_speed',
    'cable',
    'link_peers',
    'link_peers_type',
  ],
  virtualCircuits: ['id', 'cid', 'provider_network', 'status'],
  virtualCircuitTerminations: ['id', 'virtual_circuit', 'role', 'interface'],
  tunnelGroups: ['id', 'name', 'slug'],
  tunnels: ['id', 'name', 'status', 'group', 'encapsulation'],
  tunnelTerminations: ['id', 'tunnel', 'role', 'termination_type', 'termination_id'],
  l2vpns: ['id', 'name', 'slug', 'type', 'status'],
  l2vpnTerminations: ['id', 'l2vpn', 'assigned_object_type', 'assigned_object_id'],
  wirelessLinks: [
    'id',
    'interface_a',
    'interface_b',
    'ssid',
    'status',
    'distance',
    'distance_unit',
  ],
} as const

/** Ids per request when a list is fetched for chosen devices, so the URL stays short. */
const ID_CHUNK = 50

/**
 * Resolve the Authorization scheme + credential for a NetBox API token.
 *
 * NetBox 4.5 introduced v2 tokens (`nbt_<id>.<secret>`, sent as
 * `Authorization: Bearer …`) alongside legacy v1 tokens (`Authorization: Token
 * …`); v1 is removed in 4.7. The token detail page renders the full "example
 * usage" Authorization header, so users routinely paste `Token <token>` /
 * `Bearer <token>` verbatim — which would otherwise double the scheme
 * (`Authorization: Token Token …`) and return HTTP 403.
 *
 * So: strip a leading scheme + surrounding whitespace, then pick the scheme
 * from the credential shape (mirrors pynetbox's `_is_v2_token`: `nbt_` prefix
 * with a `.` separator → v2). Stripping is safe because a real credential never
 * starts with `Token `/`Bearer `; re-detecting from the credential also
 * self-corrects a wrongly-copied scheme.
 */
export function resolveNetboxAuth(raw: string | undefined): {
  token: string
  scheme: 'Token' | 'Bearer'
} {
  const token = (raw ?? '').trim().replace(/^(token|bearer)\s+/i, '')
  const isV2 = token.startsWith('nbt_') && token.slice(4).includes('.')
  return { token, scheme: isV2 ? 'Bearer' : 'Token' }
}

/** The filters that pick devices, as NetBox query parameters. */
export function deviceQuery(filters: FetchFilters = {}): QueryParams {
  const query: QueryParams = {}
  const put = (key: string, values: readonly string[] | undefined) => {
    if (values && values.length > 0) query[key] = values
  }
  put('site', filters.site)
  put('tag', filters.tag)
  put('role', filters.role)
  put('role__n', filters.excludeRole)
  put('tag__n', filters.excludeTag)
  put('tenant', filters.tenant)
  return query
}

/** The most requests a client has out to NetBox at once. */
const MAX_IN_FLIGHT = 4

export class NetBoxClient {
  private baseUrl: string
  private debug: boolean
  /** Shared SDK client: timeout, Node-compatible insecure TLS, typed errors,
   *  no credential logging. Replaces the hand-rolled fetch + Bun-only tls. */
  private http: HttpClient
  /** Families already reported as unavailable, so a sync logs each once. */
  private readonly unavailable = new Set<string>()
  /** Requests in flight, and the ones waiting for a turn. */
  private inFlight = 0
  private readonly waiting: (() => void)[] = []

  /**
   * Runs a request when fewer than `MAX_IN_FLIGHT` are out. A sync asks for some thirty lists;
   * sent all at once they hold as many NetBox workers and database connections, which a
   * production NetBox serving people too should not be asked for.
   */
  private async limited<R>(request: () => Promise<R>): Promise<R> {
    // A finished request hands its turn straight to the next one waiting, so none slips past.
    if (this.inFlight >= MAX_IN_FLIGHT) await new Promise<void>((r) => this.waiting.push(r))
    else this.inFlight++
    try {
      return await request()
    } finally {
      const next = this.waiting.shift()
      if (next) next()
      else this.inFlight--
    }
  }

  constructor(options: NetBoxClientOptions) {
    // Remove trailing slash from URL
    this.baseUrl = options.url.replace(/\/$/, '')
    // Pick Token (v1) vs Bearer (v2) and tolerate a pasted scheme prefix.
    const { token, scheme } = resolveNetboxAuth(options.token)
    this.debug = options.debug ?? false
    this.http = createHttpClient({
      baseUrl: this.baseUrl,
      auth: { type: 'token', token, scheme },
      timeoutMs: options.timeout ?? 30000,
      insecure: options.insecure ?? false,
      defaultHeaders: { Accept: 'application/json' },
      debug: this.debug ? (m) => this.log(m) : undefined,
    })
  }

  /**
   * Log debug information
   */
  private log(message: string, data?: unknown): void {
    if (!this.debug) return
    console.log(`[DEBUG] ${message}`)
    if (data !== undefined) {
      console.log(JSON.stringify(data, null, 2))
    }
  }

  /**
   * Create client from environment variables
   */
  static fromEnv(): NetBoxClient {
    const url = process.env['NETBOX_URL']
    const token = process.env['NETBOX_TOKEN']

    if (!url) {
      throw new Error('NETBOX_URL environment variable is required')
    }
    if (!token) {
      throw new Error('NETBOX_TOKEN environment variable is required')
    }

    return new NetBoxClient({ url, token })
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params?: QueryParams, fields?: readonly string[]): string {
    const searchParams = new URLSearchParams({ limit: '0' })

    if (fields && fields.length > 0) searchParams.set('fields', fields.join(','))
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue
        if (typeof value === 'object') {
          for (const v of value) searchParams.append(key, v)
        } else {
          searchParams.set(key, String(value))
        }
      }
    }

    return searchParams.toString()
  }

  /**
   * GET a list endpoint, following `next` to the end. `limit=0` asks for everything, but
   * installs past MAX_PAGE_SIZE still page. The shared client handles auth, timeout and
   * Node-compatible insecure TLS, throws a typed HttpError on non-2xx, and never logs
   * credentials.
   */
  private async list<T>(
    path: string,
    params?: QueryParams,
    fields?: readonly string[],
  ): Promise<T[]> {
    const firstPath = `/api/${path}/?${this.buildQueryString(params, fields)}`
    this.log(`Request: GET ${firstPath}`)
    const results = await paginate<T>(
      firstPath,
      async (pathOrUrl) => {
        const page = await this.limited(() =>
          this.http.json<{ results?: T[]; next?: string | null }>(pathOrUrl),
        )
        return { items: page.results ?? [], next: page.next ?? null }
      },
      { onTruncated: (pages) => this.log(`pagination cap hit at ${pages} pages for ${path}`) },
    )
    this.log(`Response: ${results.length} items for ${path}`)
    return results
  }

  /** The same list for many ids at once, in requests short enough for a URL. */
  private async listByIds<T>(
    path: string,
    key: string,
    ids: readonly number[],
    fields?: readonly string[],
    params: QueryParams = {},
  ): Promise<T[]> {
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      chunks.push(ids.slice(i, i + ID_CHUNK).map(String))
    }
    const pages = await Promise.all(
      chunks.map((chunk) => this.list<T>(path, { ...params, [key]: chunk }, fields)),
    )
    return pages.flat()
  }

  /**
   * A family of facts an instance may not have: another app that is switched off, or a token
   * without access to it. It is dropped, once logged, and the sync goes on with the rest.
   */
  private async optional<T>(family: string, load: () => Promise<T[]>): Promise<T[]> {
    try {
      return await load()
    } catch (error) {
      if (error instanceof HttpError && (error.status === 403 || error.status === 404)) {
        if (!this.unavailable.has(family)) {
          this.unavailable.add(family)
          console.warn(`[NetBox] Skipping ${family} (HTTP ${error.status})`)
        }
        return []
      }
      throw error
    }
  }

  // ============================================
  // Single lists
  // ============================================

  fetchDevices(params?: QueryParams): Promise<NetBoxDevice[]> {
    return this.list('dcim/devices', params, FIELDS.devices)
  }

  fetchInterfaces(params?: QueryParams): Promise<NetBoxInterface[]> {
    return this.list('dcim/interfaces', params, FIELDS.interfaces)
  }

  fetchCables(params?: QueryParams): Promise<NetBoxCable[]> {
    return this.list('dcim/cables', params, FIELDS.cables)
  }

  fetchSites(params?: QueryParams): Promise<NetBoxSite[]> {
    return this.list('dcim/sites', params, FIELDS.sites)
  }

  fetchLocations(params?: QueryParams): Promise<NetBoxLocation[]> {
    return this.list('dcim/locations', params, FIELDS.locations)
  }

  fetchVirtualChassis(params?: QueryParams): Promise<NetBoxVirtualChassis[]> {
    return this.list('dcim/virtual-chassis', params, FIELDS.virtualChassis)
  }

  fetchTags(): Promise<NetBoxTag[]> {
    return this.list('extras/tags')
  }

  fetchDeviceRoles(): Promise<NetBoxDeviceRole[]> {
    return this.list('dcim/device-roles')
  }

  fetchClusters(params?: QueryParams): Promise<NetBoxCluster[]> {
    return this.list('virtualization/clusters', params, FIELDS.clusters)
  }

  fetchClusterTypes(): Promise<NetBoxClusterType[]> {
    return this.list('virtualization/cluster-types')
  }

  fetchVirtualMachines(params?: QueryParams): Promise<NetBoxVirtualMachine[]> {
    return this.list('virtualization/virtual-machines', params, FIELDS.virtualMachines)
  }

  fetchVMInterfaces(params?: QueryParams): Promise<NetBoxVMInterface[]> {
    return this.list('virtualization/interfaces', params, FIELDS.vmInterfaces)
  }

  fetchVlans(params?: QueryParams): Promise<NetBoxVlan[]> {
    return this.list('ipam/vlans', params, FIELDS.vlans)
  }

  fetchVrfs(params?: QueryParams): Promise<NetBoxVrf[]> {
    return this.list('ipam/vrfs', params, FIELDS.vrfs)
  }

  fetchPrefixes(params?: QueryParams): Promise<NetBoxPrefix[]> {
    return this.list('ipam/prefixes', params, FIELDS.prefixes)
  }

  fetchIPAddresses(params?: QueryParams): Promise<NetBoxIPAddress[]> {
    return this.list('ipam/ip-addresses', params, FIELDS.ipAddresses)
  }

  fetchAsns(): Promise<NetBoxAsn[]> {
    return this.list('ipam/asns', undefined, FIELDS.asns)
  }

  fetchFhrpGroups(): Promise<NetBoxFhrpGroup[]> {
    return this.list('ipam/fhrp-groups', undefined, FIELDS.fhrpGroups)
  }

  fetchFhrpAssignments(): Promise<NetBoxFhrpAssignment[]> {
    return this.list('ipam/fhrp-group-assignments', undefined, FIELDS.fhrpAssignments)
  }

  fetchProviders(): Promise<NetBoxProvider[]> {
    return this.list('circuits/providers', undefined, FIELDS.providers)
  }

  fetchProviderNetworks(): Promise<NetBoxProviderNetwork[]> {
    return this.list('circuits/provider-networks', undefined, FIELDS.providerNetworks)
  }

  fetchCircuits(): Promise<NetBoxCircuit[]> {
    return this.list('circuits/circuits', undefined, FIELDS.circuits)
  }

  fetchCircuitTerminations(): Promise<NetBoxCircuitTermination[]> {
    return this.list('circuits/circuit-terminations', undefined, FIELDS.circuitTerminations)
  }

  fetchVirtualCircuits(): Promise<NetBoxVirtualCircuit[]> {
    return this.list('circuits/virtual-circuits', undefined, FIELDS.virtualCircuits)
  }

  fetchVirtualCircuitTerminations(): Promise<NetBoxVirtualCircuitTermination[]> {
    return this.list(
      'circuits/virtual-circuit-terminations',
      undefined,
      FIELDS.virtualCircuitTerminations,
    )
  }

  fetchTunnelGroups(): Promise<NetBoxTunnelGroup[]> {
    return this.list('vpn/tunnel-groups', undefined, FIELDS.tunnelGroups)
  }

  fetchTunnels(): Promise<NetBoxTunnel[]> {
    return this.list('vpn/tunnels', undefined, FIELDS.tunnels)
  }

  fetchTunnelTerminations(): Promise<NetBoxTunnelTermination[]> {
    return this.list('vpn/tunnel-terminations', undefined, FIELDS.tunnelTerminations)
  }

  fetchL2vpns(): Promise<NetBoxL2vpn[]> {
    return this.list('vpn/l2vpns', undefined, FIELDS.l2vpns)
  }

  fetchL2vpnTerminations(): Promise<NetBoxL2vpnTermination[]> {
    return this.list('vpn/l2vpn-terminations', undefined, FIELDS.l2vpnTerminations)
  }

  fetchWirelessLinks(): Promise<NetBoxWirelessLink[]> {
    return this.list('wireless/wireless-links', undefined, FIELDS.wirelessLinks)
  }

  // ============================================
  // Everything a topology sync reads
  // ============================================

  /**
   * Fetch what the mapping reads. Devices and interfaces are required; every other family
   * degrades to nothing when its app is off or the token cannot read it.
   *
   * Statuses are not filtered here: a device left out for being planned has to be known as
   * such, or a cable path that reaches it would bring it back as an unknown far end.
   */
  async fetchTopologyData(filters: FetchFilters = {}): Promise<NetBoxData> {
    const scope = deviceQuery(filters)
    const scoped = Object.keys(scope).length > 0

    const devices = await this.fetchDevices(scope)
    const deviceIds = devices.map((d) => d.id)

    const [interfaces, virtualMachines] = await Promise.all([
      scoped
        ? this.listByIds<NetBoxInterface>(
            'dcim/interfaces',
            'device_id',
            deviceIds,
            FIELDS.interfaces,
          )
        : this.fetchInterfaces(),
      this.optional('virtual machines', () => this.fetchVirtualMachines(vmQuery(scope))),
    ])
    const vmIds = virtualMachines.map((vm) => vm.id)

    // A cable's type and length are read for the paths that are one cable and nothing else.
    const cableIds = [
      ...new Set(
        interfaces.flatMap((i) => {
          const id = directCableId(i)
          return id === undefined ? [] : [id]
        }),
      ),
    ]

    const [
      cables,
      sites,
      locations,
      virtualChassis,
      clusters,
      vmInterfaces,
      vlans,
      vrfs,
      prefixes,
      deviceIps,
      vmIps,
      asns,
      fhrpGroups,
      fhrpAssignments,
      providers,
      providerNetworks,
      circuits,
      circuitTerminations,
      virtualCircuits,
      virtualCircuitTerminations,
      tunnelGroups,
      tunnels,
      tunnelTerminations,
      l2vpns,
      l2vpnTerminations,
      wirelessLinks,
    ] = await Promise.all([
      this.optional('cables', () =>
        this.listByIds<NetBoxCable>('dcim/cables', 'id', cableIds, FIELDS.cables),
      ),
      this.optional('sites', () => this.fetchSites()),
      this.optional('locations', () => this.fetchLocations()),
      this.optional('virtual chassis', () => this.fetchVirtualChassis()),
      this.optional('clusters', () => this.fetchClusters()),
      this.optional('VM interfaces', () =>
        scoped
          ? this.listByIds<NetBoxVMInterface>(
              'virtualization/interfaces',
              'virtual_machine_id',
              vmIds,
              FIELDS.vmInterfaces,
            )
          : this.fetchVMInterfaces(),
      ),
      this.optional('VLANs', () => this.fetchVlans()),
      this.optional('VRFs', () => this.fetchVrfs()),
      this.optional('prefixes', () => this.fetchPrefixes({ status__n: 'deprecated' })),
      this.optional('IP addresses', () =>
        scoped
          ? this.listByIds<NetBoxIPAddress>(
              'ipam/ip-addresses',
              'device_id',
              deviceIds,
              FIELDS.ipAddresses,
              { assigned_to_interface: true },
            )
          : this.fetchIPAddresses({ assigned_to_interface: true }),
      ),
      scoped
        ? this.optional('VM IP addresses', () =>
            this.listByIds<NetBoxIPAddress>(
              'ipam/ip-addresses',
              'virtual_machine_id',
              vmIds,
              FIELDS.ipAddresses,
              { assigned_to_interface: true },
            ),
          )
        : Promise.resolve<NetBoxIPAddress[]>([]),
      this.optional('ASNs', () => this.fetchAsns()),
      this.optional('FHRP groups', () => this.fetchFhrpGroups()),
      this.optional('FHRP assignments', () => this.fetchFhrpAssignments()),
      this.optional('providers', () => this.fetchProviders()),
      this.optional('provider networks', () => this.fetchProviderNetworks()),
      this.optional('circuits', () => this.fetchCircuits()),
      this.optional('circuit terminations', () => this.fetchCircuitTerminations()),
      this.optional('virtual circuits', () => this.fetchVirtualCircuits()),
      this.optional('virtual circuit terminations', () => this.fetchVirtualCircuitTerminations()),
      this.optional('tunnel groups', () => this.fetchTunnelGroups()),
      this.optional('tunnels', () => this.fetchTunnels()),
      this.optional('tunnel terminations', () => this.fetchTunnelTerminations()),
      this.optional('L2VPNs', () => this.fetchL2vpns()),
      this.optional('L2VPN terminations', () => this.fetchL2vpnTerminations()),
      this.optional('wireless links', () => this.fetchWirelessLinks()),
    ])

    // A VIP belongs to an FHRP group, not to an interface, so the call above leaves it out.
    const known = new Set([...deviceIps, ...vmIps].map((ip) => ip.id))
    const vipIds = fhrpGroups
      .flatMap((g) => g.ip_addresses ?? [])
      .map((ip) => ip.id)
      .filter((id) => !known.has(id))
    const vips = await this.optional('FHRP addresses', () =>
      this.listByIds<NetBoxIPAddress>('ipam/ip-addresses', 'id', vipIds, FIELDS.ipAddresses),
    )

    return {
      ...emptyNetBoxData(),
      devices,
      interfaces,
      cables,
      sites,
      locations,
      virtualChassis,
      clusters,
      virtualMachines,
      vmInterfaces,
      vlans,
      vrfs,
      prefixes,
      ipAddresses: [
        ...new Map([...deviceIps, ...vmIps, ...vips].map((ip) => [ip.id, ip])).values(),
      ],
      asns,
      fhrpGroups,
      fhrpAssignments,
      providers,
      providerNetworks,
      circuits,
      circuitTerminations,
      virtualCircuits,
      virtualCircuitTerminations,
      tunnelGroups,
      tunnels,
      tunnelTerminations,
      l2vpns,
      l2vpnTerminations,
      wirelessLinks,
    }
  }
}

/** The device filters a VM answers to: its site, tags and role. */
function vmQuery(scope: QueryParams): QueryParams {
  const query: QueryParams = {}
  for (const key of ['site', 'tag', 'tag__n', 'role', 'role__n', 'tenant']) {
    const value = scope[key]
    if (value !== undefined) query[key] = value
  }
  return query
}
