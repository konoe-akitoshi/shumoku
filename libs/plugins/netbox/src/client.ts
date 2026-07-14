/**
 * NetBox API Client
 */

import { createHttpClient, type HttpClient, paginate } from '@shumoku/plugin-sdk'
import type {
  NetBoxCableResponse,
  NetBoxCircuitResponse,
  NetBoxCircuitTerminationResponse,
  NetBoxClientOptions,
  NetBoxDeviceResponse,
  NetBoxDeviceRoleResponse,
  NetBoxInterfaceResponse,
  NetBoxIPAddressResponse,
  NetBoxLocationResponse,
  NetBoxPrefixResponse,
  NetBoxSiteResponse,
  NetBoxTagResponse,
  NetBoxVirtualMachineResponse,
  NetBoxVMInterfaceResponse,
} from './types.js'

/**
 * Query parameters for filtering API requests
 */
export interface QueryParams {
  site?: string | string[] // Filter by site slug(s)
  site_id?: number // Filter by site ID
  location?: string | string[] // Filter by location slug(s)
  location_id?: number // Filter by location ID
  role?: string | string[] // Filter by role slug(s)
  role__n?: string | string[] // Exclude by role slug(s)
  status?: string // Filter by status (active, planned, staged, failed, offline)
  tag?: string | string[] // Filter by tag slug(s)
  tag__n?: string | string[] // Exclude by tag slug(s)
  manufacturer?: string // Filter by manufacturer slug
  device_type?: string | string[] // Filter by device type slug(s)
  device_type__n?: string | string[] // Exclude by device type slug(s)
  q?: string // Search query
}

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

export class NetBoxClient {
  private baseUrl: string
  private debug: boolean
  /** Shared SDK client: timeout, Node-compatible insecure TLS, typed errors,
   *  no credential logging. Replaces the hand-rolled fetch + Bun-only tls. */
  private http: HttpClient

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
  private buildQueryString(params?: QueryParams): string {
    const searchParams = new URLSearchParams({ limit: '0' })

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue
        if (Array.isArray(value)) {
          for (const v of value) {
            searchParams.append(key, String(v))
          }
        } else {
          searchParams.set(key, String(value))
        }
      }
    }

    return searchParams.toString()
  }

  /**
   * Make GET request to NetBox DCIM API
   */
  private async getDcim<T>(endpoint: string, params?: QueryParams): Promise<T> {
    return this.get<T>(`dcim/${endpoint}`, params)
  }

  /**
   * Make GET request to NetBox Virtualization API
   */
  private async getVirtualization<T>(endpoint: string, params?: QueryParams): Promise<T> {
    return this.get<T>(`virtualization/${endpoint}`, params)
  }

  /**
   * Make GET request to NetBox IPAM API
   */
  private async getIpam<T>(endpoint: string, params?: QueryParams): Promise<T> {
    return this.get<T>(`ipam/${endpoint}`, params)
  }

  /**
   * Make GET request to NetBox Extras API
   */
  private async getExtras<T>(endpoint: string, params?: QueryParams): Promise<T> {
    return this.get<T>(`extras/${endpoint}`, params)
  }

  /**
   * Make GET request to NetBox Circuits API
   */
  private async getCircuits<T>(endpoint: string, params?: QueryParams): Promise<T> {
    return this.get<T>(`circuits/${endpoint}`, params)
  }

  /**
   * Make GET request to NetBox API
   */
  private async get<T>(path: string, params?: QueryParams): Promise<T> {
    // NetBox list endpoints are paginated ({ count, next, results }). `limit=0`
    // asks for everything, but installs past MAX_PAGE_SIZE still page — so
    // follow `next` to exhaustion (the previous code took only the first page).
    // httpClient handles auth / timeout / Node-compatible insecure TLS and
    // throws a typed HttpError on non-2xx; credentials are never logged.
    const firstPath = `/api/${path}/?${this.buildQueryString(params)}`
    this.log(`Request: GET ${firstPath}`)
    const results = await paginate<unknown>(
      firstPath,
      async (pathOrUrl) => {
        const page = await this.http.json<{ results?: unknown[]; next?: string | null }>(pathOrUrl)
        return { items: page.results ?? [], next: page.next ?? null }
      },
      { onTruncated: (pages) => this.log(`pagination cap hit at ${pages} pages for ${path}`) },
    )
    this.log(`Response: ${results.length} items for ${path}`)
    return { count: results.length, next: null, results } as T
  }

  /**
   * Fetch devices with optional filtering
   */
  async fetchDevices(params?: QueryParams): Promise<NetBoxDeviceResponse> {
    return this.getDcim<NetBoxDeviceResponse>('devices', params)
  }

  /**
   * Fetch interfaces with optional filtering
   */
  async fetchInterfaces(params?: QueryParams): Promise<NetBoxInterfaceResponse> {
    return this.getDcim<NetBoxInterfaceResponse>('interfaces', params)
  }

  /**
   * Fetch cables
   */
  async fetchCables(): Promise<NetBoxCableResponse> {
    return this.getDcim<NetBoxCableResponse>('cables')
  }

  /**
   * Fetch circuits (transport supplied by a provider — dark fiber, uplinks…).
   * Carries status/type/provider; the device each end lands on is joined from
   * {@link fetchCircuitTerminations}.
   */
  async fetchCircuits(): Promise<NetBoxCircuitResponse> {
    return this.getCircuits<NetBoxCircuitResponse>('circuits')
  }

  /**
   * Fetch circuit-terminations. Each carries `link_peers` — the device
   * interface it is cabled to — which is how a circuit link is reattached to a
   * real device.
   */
  async fetchCircuitTerminations(): Promise<NetBoxCircuitTerminationResponse> {
    return this.getCircuits<NetBoxCircuitTerminationResponse>('circuit-terminations')
  }

  /**
   * Fetch sites with optional filtering
   */
  async fetchSites(params?: QueryParams): Promise<NetBoxSiteResponse> {
    return this.getDcim<NetBoxSiteResponse>('sites', params)
  }

  /**
   * Fetch locations with optional filtering
   */
  async fetchLocations(params?: QueryParams): Promise<NetBoxLocationResponse> {
    return this.getDcim<NetBoxLocationResponse>('locations', params)
  }

  /**
   * Fetch tags
   */
  async fetchTags(): Promise<NetBoxTagResponse> {
    return this.getExtras<NetBoxTagResponse>('tags')
  }

  /**
   * Fetch device roles
   */
  async fetchDeviceRoles(): Promise<NetBoxDeviceRoleResponse> {
    return this.getDcim<NetBoxDeviceRoleResponse>('device-roles')
  }

  /**
   * Fetch virtual machines with optional filtering
   */
  async fetchVirtualMachines(params?: QueryParams): Promise<NetBoxVirtualMachineResponse> {
    return this.getVirtualization<NetBoxVirtualMachineResponse>('virtual-machines', params)
  }

  /**
   * Fetch VM interfaces with optional filtering
   */
  async fetchVMInterfaces(params?: QueryParams): Promise<NetBoxVMInterfaceResponse> {
    return this.getVirtualization<NetBoxVMInterfaceResponse>('interfaces', params)
  }

  /**
   * Fetch IP prefixes with optional filtering
   */
  async fetchPrefixes(params?: QueryParams): Promise<NetBoxPrefixResponse> {
    return this.getIpam<NetBoxPrefixResponse>('prefixes', params)
  }

  /**
   * Fetch IP addresses with optional filtering
   */
  async fetchIPAddresses(params?: QueryParams): Promise<NetBoxIPAddressResponse> {
    return this.getIpam<NetBoxIPAddressResponse>('ip-addresses', params)
  }

  /**
   * Fetch all data needed for topology generation
   */
  async fetchAll(): Promise<{
    devices: NetBoxDeviceResponse
    interfaces: NetBoxInterfaceResponse
    cables: NetBoxCableResponse
  }> {
    const [devices, interfaces, cables] = await Promise.all([
      this.fetchDevices(),
      this.fetchInterfaces(),
      this.fetchCables(),
    ])

    return { devices, interfaces, cables }
  }

  /**
   * Fetch all data including virtual machines
   */
  async fetchAllWithVMs(): Promise<{
    devices: NetBoxDeviceResponse
    interfaces: NetBoxInterfaceResponse
    cables: NetBoxCableResponse
    virtualMachines: NetBoxVirtualMachineResponse
    vmInterfaces: NetBoxVMInterfaceResponse
  }> {
    const [devices, interfaces, cables, virtualMachines, vmInterfaces] = await Promise.all([
      this.fetchDevices(),
      this.fetchInterfaces(),
      this.fetchCables(),
      this.fetchVirtualMachines(),
      this.fetchVMInterfaces(),
    ])

    return { devices, interfaces, cables, virtualMachines, vmInterfaces }
  }
}
