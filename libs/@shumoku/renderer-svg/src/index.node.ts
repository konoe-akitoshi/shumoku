// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/renderer-svg - SVG and PNG renderers for network diagrams
 * Node.js entry point (includes PNG support)
 */

import * as png from './png.js'
import * as svg from './svg.js'

export { svg, png }

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
  PNGRenderOptions,
  PreparedRender,
  PrepareOptions,
  SVGRenderOptions,
} from './pipeline.node.js'
// Unified render pipeline (with PNG support)
export {
  prepareRender,
  renderEmbeddable,
  renderGraphToPng,
  renderGraphToSvg,
  renderPng,
  renderSvg,
} from './pipeline.node.js'
// Re-export collectIconUrls for server-side icon dimension resolution
export { collectIconUrls } from './svg.js'
// Types
export type {
  DataAttributeOptions,
  DeviceInfo,
  EndpointInfo,
  InteractiveInstance,
  InteractiveOptions,
  LinkInfo,
  PortInfo,
  RenderMode,
} from './types.js'
