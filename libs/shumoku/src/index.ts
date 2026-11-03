// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Re-export everything from core (includes models, parser, plugin-types, etc.)
export * from '@shumoku/core'
// Re-export renderer-html
export {
  getIIFE,
  initInteractive,
  render,
  renderGraphToHtml,
  renderHtml,
  renderSceneHtml,
  setIIFE,
} from '@shumoku/renderer-html'
export { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
// Re-export renderer-svg: the drawing as SVG, and the interactive runtime's types
export {
  drawNetworkScene,
  type InteractiveInstance,
  type InteractiveOptions,
  renderGraphToSvg,
  renderNetworkSvg,
  renderSceneSvg,
} from '@shumoku/renderer-svg'
