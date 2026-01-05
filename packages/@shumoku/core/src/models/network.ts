/**
 * Main network graph definition
 */

import type { Device } from './device'
import type { Port } from './port'
import type { Link } from './link'
import type { Module } from './module'

export type LayoutType = 'hierarchical' | 'bento' | 'force' | 'manual'
export type ThemeType = 'modern' | 'dark' | 'blueprint' | 'custom'

export interface NetworkSettings {
  /**
   * Layout algorithm to use
   */
  layout?: LayoutType

  /**
   * Visual theme
   */
  theme?: ThemeType

  /**
   * Custom theme configuration
   */
  customTheme?: Record<string, unknown>

  /**
   * Animation settings
   */
  animation?: {
    enabled?: boolean
    duration?: number
    easing?: string
  }

  /**
   * Interaction settings
   */
  interaction?: {
    zoomEnabled?: boolean
    panEnabled?: boolean
    selectEnabled?: boolean
    multiSelectEnabled?: boolean
    hoverEnabled?: boolean
  }

  /**
   * Performance settings
   */
  performance?: {
    /**
     * Level of detail settings
     */
    lod?: {
      enabled?: boolean
      thresholds?: {
        labels?: number
        details?: number
      }
    }
    /**
     * Maximum number of devices to render
     */
    maxDevices?: number
  }

  /**
   * Grid settings for layout
   */
  grid?: {
    size?: number
    snap?: boolean
    visible?: boolean
  }
}

export interface NetworkMetadata {
  /**
   * Organization name
   */
  organization?: string

  /**
   * Location
   */
  location?: string

  /**
   * Last updated timestamp
   */
  lastUpdated?: string

  /**
   * Version
   */
  version?: string

  /**
   * Author
   */
  author?: string

  /**
   * Custom properties
   */
  [key: string]: unknown
}

export interface NetworkDefinitions {
  /**
   * VLAN definitions
   */
  vlans?: Array<{
    id: number
    name: string
    description?: string
    subnet?: string
    color?: string
  }>

  /**
   * Custom device types
   */
  deviceTypes?: Record<string, {
    icon?: string
    defaultColor?: string
    defaultShape?: string
  }>

  /**
   * Link types
   */
  linkTypes?: Record<string, {
    defaultStyle?: Record<string, unknown>
  }>
}

export interface NetworkGraph {
  /**
   * Schema version
   */
  version: string

  /**
   * Network name
   */
  name?: string

  /**
   * Network description
   */
  description?: string

  /**
   * All devices in the network
   */
  devices: Device[]

  /**
   * All ports
   */
  ports: Port[]

  /**
   * All links
   */
  links: Link[]

  /**
   * Modules for grouping
   */
  modules?: Module[]

  /**
   * Global settings
   */
  settings?: NetworkSettings

  /**
   * Global definitions
   */
  definitions?: NetworkDefinitions

  /**
   * Metadata
   */
  metadata?: NetworkMetadata
}