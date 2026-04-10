// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Renderer component (Svelte)
export { default as ShumokuRenderer } from './components/ShumokuRenderer.svelte'

// Static SVG rendering (CLI, PNG, SSR)
export { renderGraphToSvg, renderSvgString } from './static'

// Utilities for consuming apps
export { themeToColors, type RenderColors } from './lib/render-colors'
export {
  computePortLabelPosition,
  getNodeLabel,
  getVlanStroke,
  pointsToPathD,
  screenToSvg,
  svgPointToContainer,
  svgRectToContainer,
  svgToScreen,
} from './lib/svg-coords'
