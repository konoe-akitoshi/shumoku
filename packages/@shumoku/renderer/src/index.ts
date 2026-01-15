/**
 * @shumoku/renderer - SVG and HTML renderers for network diagrams
 */

import * as html from './html/index.js'
// Namespace exports
import * as svg from './svg.js'

export { svg, html }

// Re-export SheetData for hierarchical rendering
export type { SheetData } from './html/index.js'
// Types
export type {
  DataAttributeOptions,
  DeviceInfo,
  EndpointInfo,
  HTMLRendererOptions,
  InteractiveInstance,
  InteractiveOptions,
  LinkInfo,
  PortInfo,
  RenderMode,
} from './types.js'
