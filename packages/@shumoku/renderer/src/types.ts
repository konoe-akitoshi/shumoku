/**
 * Renderer Types
 * Types for SVG and interactive renderers
 */

/**
 * Render mode for SVG output
 * - 'static': Pure SVG without interactive data attributes (default)
 * - 'interactive': SVG with data attributes for runtime interactivity
 */
export type RenderMode = 'static' | 'interactive'

/**
 * Options for data attributes in interactive mode
 */
export interface DataAttributeOptions {
  /** Include device data attributes (type, vendor, model, etc.) */
  device?: boolean
  /** Include link data attributes (bandwidth, vlan, endpoints) */
  link?: boolean
  /** Include full metadata as JSON in data-*-json attributes */
  metadata?: boolean
}

/**
 * Device information extracted from data attributes
 * Used by interactive runtime
 */
export interface DeviceInfo {
  id: string
  label: string | string[]
  type?: string
  vendor?: string
  model?: string
  service?: string
  resource?: string
  metadata?: Record<string, unknown>
  ports?: PortInfo[]
}

/**
 * Port information for device modals
 */
export interface PortInfo {
  id: string
  label: string
  deviceId: string
  connectedTo?: {
    device: string
    port?: string
  }
}

/**
 * Link endpoint information
 */
export interface EndpointInfo {
  device: string
  port?: string
  ip?: string
}

/**
 * Link information extracted from data attributes
 * Used by interactive runtime
 */
export interface LinkInfo {
  id: string
  from: EndpointInfo
  to: EndpointInfo
  bandwidth?: string
  vlan?: number[]
  redundancy?: string
  label?: string | string[]
}

/**
 * Options for initializing interactive features
 */
export interface InteractiveOptions {
  /** SVG element or selector */
  target: SVGElement | Element | string
  /** Modal configuration */
  modal?: { enabled?: boolean }
  /** Tooltip configuration */
  tooltip?: { enabled?: boolean }
  /** Pan/Zoom configuration */
  panZoom?: {
    enabled?: boolean
    minScale?: number
    maxScale?: number
  }
}

/**
 * Interactive runtime instance
 */
export interface InteractiveInstance {
  /** Destroy the instance and clean up event listeners */
  destroy: () => void
  /** Show modal for a device (placeholder) */
  showDeviceModal: (deviceId: string) => void
  /** Hide modal (placeholder) */
  hideModal: () => void
  /** Show tooltip for a link (placeholder) */
  showLinkTooltip: (linkId: string, x: number, y: number) => void
  /** Hide tooltip */
  hideTooltip: () => void
  /** Reset view to fit content */
  resetView: () => void
  /** Get current scale */
  getScale: () => number
}

/**
 * Options for HTML renderer
 */
export interface HTMLRendererOptions {
  /** Page title (defaults to network name or 'Network Diagram') */
  title?: string
  /** Show branding link (defaults to true) */
  branding?: boolean
  /** Show toolbar with zoom controls (defaults to true) */
  toolbar?: boolean
}
