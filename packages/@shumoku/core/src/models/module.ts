/**
 * Module definitions for grouping network elements
 */

export interface ModuleLayout {
  /**
   * Grid column position (0-based)
   */
  column?: number

  /**
   * Grid row position (0-based)
   */
  row?: number

  /**
   * Grid span
   */
  span?: {
    columns: number
    rows: number
  }

  /**
   * Preferred aspect ratio
   */
  aspectRatio?: number
}

export interface ModuleStyle {
  /**
   * Background color
   */
  backgroundColor?: string

  /**
   * Border color
   */
  borderColor?: string

  /**
   * Border width
   */
  borderWidth?: number

  /**
   * Border radius
   */
  borderRadius?: number

  /**
   * Padding inside module
   */
  padding?: number | { top: number; right: number; bottom: number; left: number }

  /**
   * Shadow settings
   */
  shadow?: {
    color: string
    blur: number
    offsetX?: number
    offsetY?: number
  }

  /**
   * Opacity (0-1)
   */
  opacity?: number
}

export interface Module {
  /**
   * Unique identifier for the module
   */
  id: string

  /**
   * Display name
   */
  name: string

  /**
   * Optional description
   */
  description?: string

  /**
   * Devices contained in this module (device IDs)
   */
  devices: string[]

  /**
   * Sub-modules (nested grouping)
   */
  modules?: string[]

  /**
   * Module type/category
   */
  type?: 'datacenter' | 'campus' | 'branch' | 'cloud' | 'dmz' | 'custom'

  /**
   * Layout hints for Bento Grid
   */
  layout?: ModuleLayout

  /**
   * Visual styling
   */
  style?: ModuleStyle

  /**
   * Collapsed state (for UI)
   */
  collapsed?: boolean

  /**
   * Icon to display
   */
  icon?: string

  /**
   * Additional metadata
   */
  metadata?: {
    location?: string
    owner?: string
    criticality?: 'low' | 'medium' | 'high' | 'critical'
    [key: string]: unknown
  }
}