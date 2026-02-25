/**
 * SVG render pipeline for Shumoku diagrams
 *
 * Provides shared logic for icon dimension resolution and layout computation,
 * ensuring consistent rendering across all entry points (CLI, Playground, etc.)
 */

import {
  HierarchicalLayout,
  type HierarchicalLayoutOptions,
  type LayoutResult,
  type NetworkGraph,
} from '@shumoku/core'
import { type ResolvedIconDimensions, resolveIconDimensionsForGraph } from './cdn-icons.js'
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
 * Prepare for rendering: resolve icon dimensions and compute layout.
 *
 * This is the shared entry point that ensures consistent icon handling
 * and layout computation across all render targets.
 *
 * @example
 * ```typescript
 * const prepared = await prepareRender(graph)
 * const svgContent = await renderSvg(prepared)
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
