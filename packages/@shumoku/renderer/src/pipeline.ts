/**
 * Unified render pipeline for Shumoku diagrams
 *
 * Provides shared logic for icon dimension resolution and layout computation,
 * ensuring consistent rendering across all entry points (CLI, Playground, etc.)
 */

import {
  buildHierarchicalSheets,
  HierarchicalLayout,
  type HierarchicalLayoutOptions,
  type LayoutResult,
  type NetworkGraph,
} from '@shumoku/core'
import {
  resolveIconDimensionsForGraph,
  type ResolvedIconDimensions,
} from './cdn-icons.js'
import * as html from './html/index.js'
import type { SheetData } from './html/index.js'
import { collectIconUrls, SVGRenderer } from './svg.js'

/**
 * Prepared render data containing resolved icon dimensions and computed layout
 */
export interface PreparedRender {
  /** Original network graph */
  graph: NetworkGraph
  /** Computed layout result */
  layout: LayoutResult
  /** Resolved icon dimensions (null if no CDN icons used) */
  iconDimensions: ResolvedIconDimensions | null
}

/**
 * Options for prepareRender
 */
export interface PrepareOptions {
  /** Pre-computed layout result. If provided, layout computation is skipped. */
  layout?: LayoutResult
  /** Pre-resolved icon dimensions. If provided, icon resolution is skipped. */
  iconDimensions?: ResolvedIconDimensions
  /** Options for HierarchicalLayout (ignored if layout is provided) */
  layoutOptions?: Omit<HierarchicalLayoutOptions, 'iconDimensions'>
}

/**
 * Options for SVG rendering
 */
export interface SVGRenderOptions {
  /** Render mode */
  renderMode?: 'static' | 'interactive'
}

/**
 * Options for HTML rendering
 */
export interface HTMLRenderOptions {
  /** Page title */
  title?: string
  /** Show branding footer */
  branding?: boolean
  /** Show toolbar */
  toolbar?: boolean
}


/**
 * Prepare for rendering: resolve icon dimensions and compute layout.
 *
 * This is the shared entry point that ensures consistent icon handling
 * and layout computation across all render targets.
 *
 * @example
 * ```typescript
 * const prepared = await prepareRender(graph)
 * const svgContent = await renderSvg(prepared)
 * const htmlContent = renderHtml(prepared)
 * ```
 */
export async function prepareRender(
  graph: NetworkGraph,
  options?: PrepareOptions,
): Promise<PreparedRender> {
  // 1. Resolve icon dimensions (skip if already provided)
  let iconDimensions = options?.iconDimensions ?? null
  if (!iconDimensions) {
    const iconUrls = collectIconUrls(graph)
    if (iconUrls.length > 0) {
      iconDimensions = await resolveIconDimensionsForGraph(iconUrls)
    }
  }

  // 2. Compute layout (skip if already provided)
  let layout = options?.layout
  if (!layout) {
    const layoutEngine = new HierarchicalLayout({
      ...options?.layoutOptions,
      iconDimensions: iconDimensions?.byKey,
    })
    layout = await layoutEngine.layoutAsync(graph)
  }

  return { graph, layout, iconDimensions }
}

/**
 * Render SVG from prepared data
 */
export async function renderSvg(
  prepared: PreparedRender,
  options?: SVGRenderOptions,
): Promise<string> {
  const renderer = new SVGRenderer({
    renderMode: options?.renderMode ?? 'static',
    iconDimensions: prepared.iconDimensions?.byUrl,
  })
  return renderer.render(prepared.graph, prepared.layout)
}

/**
 * Render standalone HTML page from prepared data
 */
export function renderHtml(prepared: PreparedRender, options?: HTMLRenderOptions): string {
  return html.render(prepared.graph, prepared.layout, {
    ...options,
    iconDimensions: prepared.iconDimensions?.byUrl,
  })
}

/**
 * Render hierarchical HTML with multiple sheets from prepared data.
 *
 * Automatically builds sheet data from subgraphs if sheets Map is not provided.
 */
export async function renderHtmlHierarchical(
  prepared: PreparedRender,
  options?: HTMLRenderOptions & {
    /** Pre-built sheets map. If not provided, sheets are built from subgraphs. */
    sheets?: Map<string, SheetData>
  },
): Promise<string> {
  let sheets = options?.sheets

  // Build sheets from subgraphs if not provided
  if (!sheets) {
    const layoutEngine = new HierarchicalLayout({
      iconDimensions: prepared.iconDimensions?.byKey,
    })
    sheets = await buildHierarchicalSheets(prepared.graph, prepared.layout, layoutEngine)
  }

  // Use simple render if only root sheet
  if (sheets.size <= 1) {
    return renderHtml(prepared, options)
  }

  return html.renderHierarchical(sheets, {
    ...options,
    iconDimensions: prepared.iconDimensions?.byUrl,
  })
}

// ============================================================================
// Convenience functions (one-liner API)
// ============================================================================

/**
 * Render network graph directly to SVG string.
 * Convenience function that combines prepareRender + renderSvg.
 *
 * @example
 * ```typescript
 * const svgContent = await renderGraphToSvg(graph)
 * ```
 */
export async function renderGraphToSvg(
  graph: NetworkGraph,
  options?: PrepareOptions & SVGRenderOptions,
): Promise<string> {
  const prepared = await prepareRender(graph, options)
  return renderSvg(prepared, options)
}

/**
 * Render network graph directly to HTML string.
 * Convenience function that combines prepareRender + renderHtml.
 *
 * @example
 * ```typescript
 * const htmlContent = await renderGraphToHtml(graph)
 * ```
 */
export async function renderGraphToHtml(
  graph: NetworkGraph,
  options?: PrepareOptions & HTMLRenderOptions,
): Promise<string> {
  const prepared = await prepareRender(graph, options)
  return renderHtml(prepared, options)
}

/**
 * Render network graph directly to hierarchical HTML string.
 * Convenience function that combines prepareRender + renderHtmlHierarchical.
 *
 * @example
 * ```typescript
 * const htmlContent = await renderGraphToHtmlHierarchical(graph)
 * ```
 */
export async function renderGraphToHtmlHierarchical(
  graph: NetworkGraph,
  options?: PrepareOptions & HTMLRenderOptions,
): Promise<string> {
  const prepared = await prepareRender(graph, options)
  return renderHtmlHierarchical(prepared, options)
}
