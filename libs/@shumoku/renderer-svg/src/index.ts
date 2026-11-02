// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/renderer-svg - SVG renderer for network diagrams
 */

// The drawing: a model as an SVG string, by the kit, with the layout of `drawNetwork`
export {
  drawNetworkScene,
  type NetworkSvgOptions,
  renderNetworkSvg,
  renderSceneSvg,
} from '@shumoku/renderer/static'
// Brand
export { BRANDING_ICON_SVG, LOGO_PATHS, LOGO_VIEWBOX } from './brand.js'
export { renderGraphToSvg } from './graph.js'
export type { IconDimensions } from './icon-dims.js'
// Icon dimension/fetch utilities (URL icons)
export {
  clearIconCache,
  DEFAULT_ICON_FETCH_TIMEOUT,
  fetchIconAsDataUrl,
  fetchImageDimensions,
  resolveAllIconDimensions,
} from './icon-dims.js'
export { collectIconUrls } from './icon-urls.js'
// Deprecated root exports retained until the legacy compatibility unit is removed.
// New compatibility consumers should use the explicit `./legacy` subpath.
export { LegacySVGRenderer, SVGRenderer, svg } from './legacy.js'
// Layout preparation the old HTML renderer still reads (goes with it)
export type { PreparedRender, PrepareOptions } from './pipeline.js'
export { generateThemeCSS, prepareRender } from './pipeline.js'
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
