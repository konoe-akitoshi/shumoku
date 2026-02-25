/**
 * @shumoku/renderer-html - HTML renderer with interactive features for network diagrams
 */

import * as html from './html/index.js'

export { html }

// Re-export SheetData for hierarchical rendering
export type { SheetData } from './html/index.js'
// Re-export initInteractive for manual initialization
export { initInteractive } from './html/index.js'
// Re-export navigation types
export type { NavigationState, SheetInfo } from './html/index.js'
// Re-export interactive types
export type { InteractiveInstance, InteractiveOptions } from './html/index.js'

// HTML pipeline functions
export type {
  EmbeddableRenderOptions,
  EmbeddableRenderOutput,
  HTMLRenderOptions,
} from './pipeline.js'
export {
  renderEmbeddable,
  renderGraphToHtml,
  renderGraphToHtmlHierarchical,
  renderHtml,
  renderHtmlHierarchical,
} from './pipeline.js'

// IIFE string
export { INTERACTIVE_IIFE } from './iife-string.js'
