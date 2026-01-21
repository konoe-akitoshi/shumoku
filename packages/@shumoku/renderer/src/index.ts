/**
 * @shumoku/renderer - SVG and HTML renderers for network diagrams
 * Browser entry point (PNG throws error)
 */

import * as html from './html/index.js'
import * as png from './png.browser.js'
import * as svg from './svg.js'

export { svg, html, png }

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
// Re-export SheetData for hierarchical rendering
export type { SheetData } from './html/index.js'
export type {
  EmbeddableRenderOptions,
  EmbeddableRenderOutput,
  HTMLRenderOptions,
  PNGRenderOptions,
  PreparedRender,
  PrepareOptions,
  SVGRenderOptions,
} from './pipeline.browser.js'
// Unified render pipeline (PNG throws in browser, use Canvas API instead)
export {
  prepareRender,
  renderEmbeddable,
  renderGraphToHtml,
  renderGraphToHtmlHierarchical,
  renderGraphToPng,
  renderGraphToSvg,
  renderHtml,
  renderHtmlHierarchical,
  renderPng,
  renderSvg,
} from './pipeline.browser.js'
// Re-export initInteractive for manual initialization
export { initInteractive } from './html/index.js'
// Re-export collectIconUrls for server-side icon dimension resolution
export { collectIconUrls } from './svg.js'
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
