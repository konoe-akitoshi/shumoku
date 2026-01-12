/**
 * NetBox API Client
 */

import type {
  NetBoxClientOptions,
  NetBoxDeviceResponse,
  NetBoxInterfaceResponse,
  NetBoxCableResponse,
  NetBoxVirtualMachineResponse,
  NetBoxVMInterfaceResponse,
  NetBoxPrefixResponse,
  NetBoxIPAddressResponse,
} from './types.js'

export class NetBoxClient {
  private baseUrl: string
  private token: string
  private timeout: number

  constructor(options: NetBoxClientOptions) {
    // Remove trailing slash from URL
    this.baseUrl = options.url.replace(/\/$/, '')
    this.token = options.token
    this.timeout = options.timeout ?? 30000
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
   * Make GET request to NetBox DCIM API
   */
  private async getDcim<T>(endpoint: string): Promise<T> {
    return this.get<T>(`dcim/${endpoint}`)
  }

  /**
   * Make GET request to NetBox Virtualization API
   */
  private async getVirtualization<T>(endpoint: string): Promise<T> {
    return this.get<T>(`virtualization/${endpoint}`)
  }

  /**
   * Make GET request to NetBox IPAM API
   */
  private async getIpam<T>(endpoint: string): Promise<T> {
    return this.get<T>(`ipam/${endpoint}`)
  }

  /**
   * Make GET request to NetBox API
   */
  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}/api/${path}/?limit=0`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.token}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`NetBox API request failed: ${response.status} ${response.statusText}`)
      }

      return await response.json() as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Fetch all devices
   */
  async fetchDevices(): Promise<NetBoxDeviceResponse> {
    return this.getDcim<NetBoxDeviceResponse>('devices')
  }

  /**
   * Fetch all interfaces
   */
  async fetchInterfaces(): Promise<NetBoxInterfaceResponse> {
    return this.getDcim<NetBoxInterfaceResponse>('interfaces')
  }

  /**
   * Fetch all cables
   */
  async fetchCables(): Promise<NetBoxCableResponse> {
    return this.getDcim<NetBoxCableResponse>('cables')
  }

  /**
   * Fetch all virtual machines
   */
  async fetchVirtualMachines(): Promise<NetBoxVirtualMachineResponse> {
    return this.getVirtualization<NetBoxVirtualMachineResponse>('virtual-machines')
  }

  /**
   * Fetch all VM interfaces
   */
  async fetchVMInterfaces(): Promise<NetBoxVMInterfaceResponse> {
    return this.getVirtualization<NetBoxVMInterfaceResponse>('interfaces')
  }

  /**
   * Fetch all IP prefixes
   */
  async fetchPrefixes(): Promise<NetBoxPrefixResponse> {
    return this.getIpam<NetBoxPrefixResponse>('prefixes')
  }

  /**
   * Fetch all IP addresses
   */
  async fetchIPAddresses(): Promise<NetBoxIPAddressResponse> {
    return this.getIpam<NetBoxIPAddressResponse>('ip-addresses')
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
