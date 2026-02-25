/**
 * @shumoku/renderer-svg - SVG, pipeline, CDN icons, and PNG for network diagrams
 * Node.js entry point (includes PNG support)
 */

import * as png from './png.js'
import * as svg from './svg.js'

export { svg, png }

// Brand constants (used by renderer-html)
export { BRANDING_ICON_SVG } from './brand.js'
export type { CDNConfig, IconDimensions, ResolvedIconDimensions } from './cdn-icons.js'
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
export type {
  PNGRenderOptions,
  PreparedRender,
  PrepareOptions,
  SVGRenderOptions,
} from './pipeline.node.js'
// Unified render pipeline (with PNG support)
export {
  prepareRender,
  renderGraphToPng,
  renderGraphToSvg,
  renderPng,
  renderSvg,
} from './pipeline.node.js'
// SVG renderer class and utilities
export { collectIconUrls, SVGRenderer } from './svg.js'
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
