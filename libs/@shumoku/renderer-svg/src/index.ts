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
// Icon fetch (URL icons, embedded by the PNG renderer)
export { clearIconCache, DEFAULT_ICON_FETCH_TIMEOUT, fetchIconAsDataUrl } from './icon-fetch.js'
export { generateThemeCSS } from './theme-css.js'
// Types
export type { InteractiveInstance, InteractiveOptions } from './types.js'
