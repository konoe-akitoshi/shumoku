/**
 * Port (Interface) definitions for network devices
 */

export enum PortType {
  Ethernet = 'ethernet',
  Fiber = 'fiber',
  Virtual = 'virtual',
  Tunnel = 'tunnel',
  Wireless = 'wireless',
  Management = 'management',
}

export enum PortSpeed {
  Speed10M = '10M',
  Speed100M = '100M',
  Speed1G = '1G',
  Speed10G = '10G',
  Speed25G = '25G',
  Speed40G = '40G',
  Speed100G = '100G',
  Speed400G = '400G',
}

export enum PortStatus {
  Up = 'up',
  Down = 'down',
  AdminDown = 'admin-down',
  Testing = 'testing',
}

export enum PortMode {
  Access = 'access',
  Trunk = 'trunk',
  Hybrid = 'hybrid',
}

export interface Port {
  /**
   * Unique identifier for the port
   */
  id: string

  /**
   * Device ID this port belongs to
   */
  deviceId: string

  /**
   * Port name (e.g., "GigabitEthernet0/0/1", "eth0")
   */
  name: string

  /**
   * Port type
   */
  type: PortType

  /**
   * Port speed
   */
  speed?: PortSpeed | string

  /**
   * Operational status
   */
  status?: PortStatus

  /**
   * VLAN configuration
   */
  vlan?: {
    mode?: PortMode
    access?: number
    trunk?: number[]
    native?: number
  }

  /**
   * IP addressing
   */
  ip?: {
    address?: string
    subnet?: string
    secondary?: Array<{ address: string; subnet: string }>
  }

  /**
   * Physical location on device
   */
  location?: {
    slot?: number
    module?: number
    port?: number
  }

  /**
   * Additional metadata
   */
  metadata?: {
    description?: string
    mtu?: number
    duplex?: 'full' | 'half' | 'auto'
    [key: string]: unknown
  }
}