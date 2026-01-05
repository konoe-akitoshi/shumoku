/**
 * Device (Node) definitions for network topology
 */

export enum DeviceType {
  Router = 'router',
  L3Switch = 'l3-switch',
  L2Switch = 'l2-switch',
  Firewall = 'firewall',
  LoadBalancer = 'load-balancer',
  Server = 'server',
  AccessPoint = 'access-point',
  VirtualMachine = 'vm',
  Container = 'container',
  Cloud = 'cloud',
  Internet = 'internet',
  Unknown = 'unknown',
}

export enum DeviceRole {
  Core = 'core',
  Distribution = 'distribution',
  Access = 'access',
  Edge = 'edge',
  Management = 'management',
}

export enum DeviceStatus {
  Up = 'up',
  Down = 'down',
  Maintenance = 'maintenance',
  Unknown = 'unknown',
}

export interface DevicePosition {
  x: number | 'auto'
  y: number | 'auto'
  locked?: boolean
}

export interface DeviceMetadata {
  manufacturer?: string
  model?: string
  serial?: string
  assetTag?: string
  location?: string
  rackUnit?: number
  [key: string]: unknown
}

export interface Device {
  /**
   * Unique identifier for the device
   */
  id: string

  /**
   * Display name of the device
   */
  name: string

  /**
   * Device type (router, switch, etc.)
   */
  type: DeviceType

  /**
   * Network role (core, distribution, access)
   */
  role?: DeviceRole

  /**
   * Current status
   */
  status?: DeviceStatus

  /**
   * Position in the diagram
   */
  position?: DevicePosition

  /**
   * Optional icon override
   */
  icon?: string

  /**
   * Additional metadata
   */
  metadata?: DeviceMetadata

  /**
   * Custom styling
   */
  style?: {
    color?: string
    shape?: 'rectangle' | 'circle' | 'hexagon'
    size?: { width: number; height: number }
  }
}