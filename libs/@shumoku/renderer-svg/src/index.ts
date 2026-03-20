// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/renderer-svg - SVG renderer for network diagrams
 */

import * as svg from './svg.js'

export { svg }
export { SVGRenderer } from './svg.js'

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
  EmbeddableRenderOptions,
  EmbeddableRenderOutput,
  PreparedRender,
  PrepareOptions,
  SVGRenderOptions,
} from './pipeline.js'
// Unified render pipeline
export {
  prepareRender,
  renderEmbeddable,
  renderGraphToSvg,
  renderSvg,
} from './pipeline.js'
// Re-export collectIconUrls for server-side icon dimension resolution
export { collectIconUrls } from './svg.js'
// Brand
export { BRANDING_ICON_SVG, LOGO_PATHS, LOGO_VIEWBOX } from './brand.js'
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
