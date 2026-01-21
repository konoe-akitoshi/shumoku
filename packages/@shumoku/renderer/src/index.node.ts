/**
 * @shumoku/renderer - SVG, HTML, and PNG renderers for network diagrams
 * Node.js entry point (includes PNG support)
 */

import * as html from './html/index.js'
import * as png from './png.js'
import * as svg from './svg.js'

export { svg, html, png }

// Unified render pipeline (with PNG support)
export {
  prepareRender,
  renderGraphToHtml,
  renderGraphToHtmlHierarchical,
  renderGraphToPng,
  renderGraphToSvg,
  renderHtml,
  renderHtmlHierarchical,
  renderPng,
  renderSvg,
} from './pipeline.node.js'
export type {
  HTMLRenderOptions,
  PNGRenderOptions,
  PreparedRender,
  PrepareOptions,
  SVGRenderOptions,
} from './pipeline.node.js'

// CDN icon utilities
export {
  clearIconCache,
  DEFAULT_CDN_CONFIG,
  fetchCDNIcon,
  fetchImageDimensions,
  getCDNIconUrl,
  getIconExtension,
  hasCDNIcons,
  resolveAllIconDimensions,
  resolveIconDimensions,
  resolveIconDimensionsForGraph,
} from './cdn-icons.js'
export type { CDNConfig, IconDimensions, ResolvedIconDimensions } from './cdn-icons.js'

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
