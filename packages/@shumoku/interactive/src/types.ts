/**
 * Types for @shumoku/interactive
 */

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
