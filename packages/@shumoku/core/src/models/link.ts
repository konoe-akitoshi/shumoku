/**
 * Link (Connection) definitions between network devices
 */

export enum LinkType {
  Physical = 'physical',
  Logical = 'logical',
  Tunnel = 'tunnel',
  Wireless = 'wireless',
  Virtual = 'virtual',
}

export enum LinkStatus {
  Up = 'up',
  Down = 'down',
  Degraded = 'degraded',
  Unknown = 'unknown',
}

export interface LinkEndpoint {
  /**
   * Device ID
   */
  deviceId: string

  /**
   * Optional port ID
   */
  portId?: string

  /**
   * Optional interface name (if portId not available)
   */
  interface?: string
}

export interface LinkRedundancy {
  /**
   * Redundancy group identifier
   */
  group: string

  /**
   * Role in redundancy group
   */
  role: 'primary' | 'backup' | 'load-balanced'

  /**
   * Priority (lower is higher priority)
   */
  priority?: number
}

export interface LinkMetrics {
  /**
   * Current bandwidth utilization (0-100)
   */
  utilization?: number

  /**
   * Latency in milliseconds
   */
  latency?: number

  /**
   * Packet loss percentage
   */
  packetLoss?: number

  /**
   * Jitter in milliseconds
   */
  jitter?: number
}

export interface LinkStyle {
  /**
   * Use curved lines
   */
  curved?: boolean

  /**
   * Line color
   */
  color?: string

  /**
   * Line style
   */
  dashed?: boolean

  /**
   * Line thickness
   */
  thickness?: number

  /**
   * Animation style
   */
  animation?: 'flow' | 'pulse' | 'none'

  /**
   * Label position
   */
  labelPosition?: 'start' | 'middle' | 'end'
}

export interface Link {
  /**
   * Unique identifier for the link
   */
  id: string

  /**
   * Source endpoint
   */
  source: LinkEndpoint

  /**
   * Target endpoint
   */
  target: LinkEndpoint

  /**
   * Link type
   */
  type: LinkType

  /**
   * Bandwidth capacity
   */
  bandwidth?: string

  /**
   * Current status
   */
  status?: LinkStatus

  /**
   * Redundancy configuration
   */
  redundancy?: LinkRedundancy

  /**
   * Real-time metrics
   */
  metrics?: LinkMetrics

  /**
   * Visual styling
   */
  style?: LinkStyle

  /**
   * Additional metadata
   */
  metadata?: {
    description?: string
    circuit?: string
    provider?: string
    cost?: number
    [key: string]: unknown
  }
}