/**
 * Location-based grouping for network topology
 * Inspired by KiCAD's hierarchical sheets approach
 */

export type LocationType = 'building' | 'floor' | 'room' | 'rack' | 'cabinet' | 'zone' | 'custom'

export interface LocationPosition {
  x: number
  y: number
  width?: number
  height?: number
}

export interface LocationConnector {
  /**
   * Unique identifier for the connector
   */
  id: string

  /**
   * Display name/label for the connector
   */
  label: string

  /**
   * Direction of the connector (where it appears on the location boundary)
   */
  direction: 'top' | 'bottom' | 'left' | 'right'

  /**
   * Position along the edge (0-1)
   */
  position?: number

  /**
   * Type of connection
   */
  type?: 'uplink' | 'downlink' | 'peer' | 'trunk' | 'custom'

  /**
   * Connected to which location's connector
   */
  connectedTo?: {
    locationId: string
    connectorId: string
  }

  /**
   * Visual style
   */
  style?: {
    color?: string
    strokeWidth?: number
    symbol?: 'arrow' | 'circle' | 'square' | 'diamond'
  }

  /**
   * Metadata
   */
  metadata?: Record<string, unknown>
}

export interface Location {
  /**
   * Unique identifier
   */
  id: string

  /**
   * Display name
   */
  name: string

  /**
   * Location type
   */
  type: LocationType

  /**
   * Parent location ID (for hierarchical structure)
   */
  parentId?: string

  /**
   * Device IDs contained in this location
   */
  deviceIds: string[]

  /**
   * Child location IDs
   */
  childLocationIds?: string[]

  /**
   * Connectors for inter-location links
   * These act like KiCAD's hierarchical pins
   */
  connectors?: LocationConnector[]

  /**
   * Position in the layout
   */
  position?: LocationPosition

  /**
   * Visual style
   */
  style?: {
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    borderStyle?: 'solid' | 'dashed' | 'dotted'
    borderRadius?: number
    opacity?: number
    showLabel?: boolean
    labelPosition?: 'top' | 'inside' | 'bottom'
  }

  /**
   * Layout settings for devices within this location
   */
  internalLayout?: {
    type?: 'grid' | 'hierarchical' | 'circular' | 'manual'
    padding?: number
    spacing?: number
  }

  /**
   * Metadata
   */
  metadata?: {
    address?: string
    description?: string
    capacity?: number
    powerRating?: string
    coolingType?: string
    [key: string]: unknown
  }
}

/**
 * Inter-location link (trunk line between locations)
 */
export interface LocationLink {
  /**
   * Unique identifier
   */
  id: string

  /**
   * Source location connector
   */
  from: {
    locationId: string
    connectorId: string
  }

  /**
   * Target location connector
   */
  to: {
    locationId: string
    connectorId: string
  }

  /**
   * Link properties
   */
  properties?: {
    bandwidth?: string
    mediaType?: 'fiber' | 'copper' | 'wireless'
    distance?: string
    redundancy?: boolean
  }

  /**
   * Visual style
   */
  style?: {
    color?: string
    strokeWidth?: number
    strokeStyle?: 'solid' | 'dashed' | 'dotted'
    animated?: boolean
  }

  /**
   * Metadata
   */
  metadata?: Record<string, unknown>
}
