// Re-export everything from core (canonical source for shared types)
export * from '@shumoku/core'
export type {
  FileResolver,
  HierarchicalParseResult,
  ParseResult,
  ParseWarning,
} from '@shumoku/parser-yaml'
// Re-export parser (excluding types already exported from core)
export {
  createMemoryFileResolver,
  createNodeFileResolver,
  HierarchicalParser,
  parser,
  YamlParser,
} from '@shumoku/parser-yaml'
export type {
  HTMLRendererOptions,
  InteractiveInstance,
  InteractiveOptions,
} from '@shumoku/renderer'
// Re-export renderer (excluding SheetData already exported from core)
export { html, svg } from '@shumoku/renderer'
export { INTERACTIVE_IIFE } from '@shumoku/renderer/iife-string'

// Import icons for side effects (auto-registration)
// Note: Icon types are already exported from @shumoku/core
import '@shumoku/icons'

// Re-export only the vendorIconSets from icons (not conflicting exports)
export { vendorIconSets } from '@shumoku/icons'
