/**
 * @shumoku/renderer-svg - SVG renderer, pipeline, CDN icons, and PNG for network diagrams
 * Browser entry point (PNG throws error)
 */

import * as png from './png.browser.js'
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
} from './pipeline.browser.js'
// Unified render pipeline (PNG throws in browser, use Canvas API instead)
export {
  prepareRender,
  renderGraphToPng,
  renderGraphToSvg,
  renderPng,
  renderSvg,
} from './pipeline.browser.js'
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
