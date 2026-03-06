// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * NetBox API Client
 */

import type {
  NetBoxCableResponse,
  NetBoxCircuitResponse,
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
 * Custom error class for NetBox API errors
 */
export class NetBoxApiError extends Error {
  readonly status: number
  readonly statusText: string
  readonly body: string
  readonly url: string

  constructor(status: number, statusText: string, body: string, url: string) {
    const truncatedBody = body.length > 500 ? `${body.slice(0, 500)}...` : body
    super(
      `NetBox API error ${status} ${statusText} for ${url}\n${truncatedBody}`,
    )
    this.name = 'NetBoxApiError'
    this.status = status
    this.statusText = statusText
    this.body = body
    this.url = url
  }
}

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

export class NetBoxClient {
  private baseUrl: string
  private token: string
  private timeout: number
  private debug: boolean
  private insecure: boolean

  constructor(options: NetBoxClientOptions) {
    // Remove trailing slash from URL
    this.baseUrl = options.url.replace(/\/$/, '')
    this.token = options.token
    this.timeout = options.timeout ?? 30000
    this.debug = options.debug ?? false
    this.insecure = options.insecure ?? false

    // Note: insecure mode is applied per-request via tls option in fetch()
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
    const url = process.env.NETBOX_URL
    const token = process.env.NETBOX_TOKEN

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
   * Make GET request to NetBox Circuits API
   */
  private async getCircuits<T>(endpoint: string, params?: QueryParams): Promise<T> {
    return this.get<T>(`circuits/${endpoint}`, params)
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
   * Make GET request to NetBox API
   */
  private async get<T>(path: string, params?: QueryParams): Promise<T> {
    const queryString = this.buildQueryString(params)
    const url = `${this.baseUrl}/api/${path}/?${queryString}`

    this.log(`Request: GET ${url}`)
    if (params && Object.keys(params).length > 0) {
      this.log('Query params:', params)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const startTime = Date.now()
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Token ${this.token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
        ...(this.insecure && { tls: { rejectUnauthorized: false } }),
      })
      const elapsed = Date.now() - startTime

      this.log(`Response: ${response.status} ${response.statusText} (${elapsed}ms)`)

      if (!response.ok) {
        const errorBody = await response.text()
        this.log('Error response body:', errorBody)
        throw new NetBoxApiError(response.status, response.statusText, errorBody, url)
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        const body = await response.text()
        throw new NetBoxApiError(
          response.status,
          `Unexpected content-type: ${contentType}`,
          body,
          url,
        )
      }

      const data = (await response.json()) as T

      // Validate paginated response structure
      if (typeof data === 'object' && data !== null) {
        if ('count' in data) {
          this.log(`Response data: ${(data as { count: number }).count} items`)
        }
        if (!('results' in data)) {
          throw new NetBoxApiError(
            response.status,
            'Unexpected response structure (missing "results" field)',
            JSON.stringify(data).slice(0, 1000),
            url,
          )
        }
      }

      return data
    } catch (err) {
      if (err instanceof NetBoxApiError) throw err
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`NetBox API request timed out after ${this.timeout}ms: ${url}`)
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
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
   * Fetch circuits with optional filtering
   */
  async fetchCircuits(params?: QueryParams): Promise<NetBoxCircuitResponse> {
    return this.getCircuits<NetBoxCircuitResponse>('circuits', params)
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
    circuits: NetBoxCircuitResponse
  }> {
    const results = await Promise.allSettled([
      this.fetchDevices(),
      this.fetchInterfaces(),
      this.fetchCables(),
      this.fetchCircuits(),
    ])

    const labels = ['devices', 'interfaces', 'cables', 'circuits'] as const
    const errors: string[] = []
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'rejected') {
        errors.push(`${labels[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
      }
    }
    if (errors.length > 0) {
      throw new Error(`Failed to fetch from NetBox:\n${errors.join('\n')}`)
    }

    return {
      devices: (results[0] as PromiseFulfilledResult<NetBoxDeviceResponse>).value,
      interfaces: (results[1] as PromiseFulfilledResult<NetBoxInterfaceResponse>).value,
      cables: (results[2] as PromiseFulfilledResult<NetBoxCableResponse>).value,
      circuits: (results[3] as PromiseFulfilledResult<NetBoxCircuitResponse>).value,
    }
  }

  /**
   * Fetch all data including virtual machines
   */
  async fetchAllWithVMs(): Promise<{
    devices: NetBoxDeviceResponse
    interfaces: NetBoxInterfaceResponse
    cables: NetBoxCableResponse
    circuits: NetBoxCircuitResponse
    virtualMachines: NetBoxVirtualMachineResponse
    vmInterfaces: NetBoxVMInterfaceResponse
  }> {
    const results = await Promise.allSettled([
      this.fetchDevices(),
      this.fetchInterfaces(),
      this.fetchCables(),
      this.fetchCircuits(),
      this.fetchVirtualMachines(),
      this.fetchVMInterfaces(),
    ])

    const labels = [
      'devices', 'interfaces', 'cables', 'circuits', 'virtualMachines', 'vmInterfaces',
    ] as const
    const errors: string[] = []
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'rejected') {
        errors.push(`${labels[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
      }
    }
    if (errors.length > 0) {
      throw new Error(`Failed to fetch from NetBox:\n${errors.join('\n')}`)
    }

    return {
      devices: (results[0] as PromiseFulfilledResult<NetBoxDeviceResponse>).value,
      interfaces: (results[1] as PromiseFulfilledResult<NetBoxInterfaceResponse>).value,
      cables: (results[2] as PromiseFulfilledResult<NetBoxCableResponse>).value,
      circuits: (results[3] as PromiseFulfilledResult<NetBoxCircuitResponse>).value,
      virtualMachines: (results[4] as PromiseFulfilledResult<NetBoxVirtualMachineResponse>).value,
      vmInterfaces: (results[5] as PromiseFulfilledResult<NetBoxVMInterfaceResponse>).value,
    }
  }
}
