// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Re-export everything from core (includes models, parser, plugin-types, etc.)
export * from '@shumoku/core'
// Re-export renderer-svg
export type {
  HTMLRendererOptions,
  InteractiveInstance,
  InteractiveOptions,
} from '@shumoku/renderer-svg'
export { svg } from '@shumoku/renderer-svg'
// Re-export renderer-html (selectively to avoid SheetData conflict with core)
export {
  render,
  renderHierarchical,
  setIIFE,
  getIIFE,
  initInteractive,
  renderHtml,
  renderHtmlHierarchical,
  renderGraphToHtml,
  renderGraphToHtmlHierarchical,
} from '@shumoku/renderer-html'
export { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
