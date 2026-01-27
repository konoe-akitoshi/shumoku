/**
 * Unified render pipeline for Shumoku diagrams
 *
 * Provides shared logic for icon dimension resolution and layout computation,
 * ensuring consistent rendering across all entry points (CLI, Playground, etc.)
 */

import {
  buildHierarchicalSheets,
  darkTheme,
  HierarchicalLayout,
  type HierarchicalLayoutOptions,
  type LayoutResult,
  lightTheme,
  type NetworkGraph,
  type SurfaceToken,
} from '@shumoku/core'
import { type ResolvedIconDimensions, resolveIconDimensionsForGraph } from './cdn-icons.js'
import type { SheetData } from './html/index.js'
import * as html from './html/index.js'
import { getNavigationStyles } from './html/navigation.js'
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
 * Options for embeddable rendering
 */
export interface EmbeddableRenderOptions {
  /** Enable hierarchical navigation features */
  hierarchical?: boolean
  /** Include zoom toolbar controls */
  toolbar?: boolean
}

/**
 * Embeddable render output - SVG with separate CSS and setup info
 */
export interface EmbeddableRenderOutput {
  /** Interactive SVG content with data attributes for tooltips/hover */
  svg: string
  /** CSS styles for interactivity (hover, tooltips, etc.) */
  css: string
  /** Container ID for the SVG (used by init script) */
  containerId: string
  /** Whether hierarchical navigation is enabled */
  hierarchical: boolean
  /** ViewBox info for the SVG */
  viewBox: { x: number; y: number; width: number; height: number }
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

/**
 * Render embeddable output: SVG + CSS for embedding in external applications.
 *
 * Unlike renderHtml which returns a complete HTML page, this returns
 * structured output that can be embedded in frameworks like React, Vue, Svelte.
 *
 * Usage:
 * 1. Insert the SVG into a container element
 * 2. Add the CSS to a style tag or stylesheet
 * 3. Call initInteractive({ target: containerElement }) to enable interactivity
 *
 * @example
 * ```typescript
 * import { prepareRender, renderEmbeddable, initInteractive } from '@shumoku/renderer'
 *
 * const prepared = await prepareRender(graph)
 * const output = renderEmbeddable(prepared)
 *
 * // In your component:
 * container.innerHTML = output.svg
 * styleTag.textContent = output.css
 * initInteractive({ target: container })
 * ```
 */
export function renderEmbeddable(
  prepared: PreparedRender,
  options?: EmbeddableRenderOptions,
): EmbeddableRenderOutput {
  const hierarchical = options?.hierarchical ?? hasHierarchicalContent(prepared.graph)

  // Render SVG with interactive mode (includes data attributes)
  const renderer = new SVGRenderer({
    renderMode: 'interactive',
    iconDimensions: prepared.iconDimensions?.byUrl,
  })
  const svg = renderer.render(prepared.graph, prepared.layout)

  // Build CSS for interactivity
  const css = generateEmbeddableCSS(hierarchical, options?.toolbar ?? false)

  // Compute viewBox from layout bounds with padding
  const bounds = prepared.layout.bounds
  const padding = 40
  const viewBox = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }

  return {
    svg,
    css,
    containerId: 'shumoku-container',
    hierarchical,
    viewBox,
  }
}

/**
 * Check if graph has hierarchical content (subgraphs with files)
 */
function hasHierarchicalContent(graph: NetworkGraph): boolean {
  if (!graph.subgraphs) return false
  return graph.subgraphs.some((sg) => 'file' in sg && sg.file)
}

/**
 * Generate CSS variable definitions for a theme
 */
function generateThemeVars(theme: typeof lightTheme): string {
  const rc = theme.colors
  const defaultSurface = rc.surfaces['surface-1']
  const portFill = theme.variant === 'dark' ? '#64748b' : '#334155'
  const portStroke = theme.variant === 'dark' ? '#94a3b8' : '#0f172a'
  const portLabelBg = theme.variant === 'dark' ? '#0f172a' : '#0f172a'
  const surfaceTokens: SurfaceToken[] = [
    'surface-1', 'surface-2', 'surface-3',
    'accent-blue', 'accent-green', 'accent-red', 'accent-amber', 'accent-purple',
  ]

  const lines = [
    `--shumoku-bg: ${rc.background};`,
    `--shumoku-surface: ${defaultSurface.fill};`,
    `--shumoku-text: ${rc.text};`,
    `--shumoku-text-secondary: ${rc.textSecondary};`,
    `--shumoku-border: ${defaultSurface.stroke};`,
    `--shumoku-node-fill: ${rc.surface};`,
    `--shumoku-node-stroke: ${rc.textSecondary};`,
    `--shumoku-link-stroke: ${rc.textSecondary};`,
    `--shumoku-subgraph-label: ${defaultSurface.text};`,
    `--shumoku-port-fill: ${portFill};`,
    `--shumoku-port-stroke: ${portStroke};`,
    `--shumoku-port-label-bg: ${portLabelBg};`,
    `--shumoku-port-label-color: #ffffff;`,
    `--shumoku-endpoint-label-bg: ${rc.background};`,
    `--shumoku-endpoint-label-stroke: ${defaultSurface.stroke};`,
  ]

  for (const t of surfaceTokens) {
    const s = rc.surfaces[t]
    lines.push(`--shumoku-${t}-fill: ${s.fill};`)
    lines.push(`--shumoku-${t}-stroke: ${s.stroke};`)
    lines.push(`--shumoku-${t}-text: ${s.text};`)
  }

  return lines.map((l) => `  ${l}`).join('\n')
}

/**
 * Generate CSS for embeddable SVG interactivity
 */
function generateEmbeddableCSS(hierarchical: boolean, toolbar: boolean): string {
  const themeCSS = `
/* Shumoku Theme Variables */
:root {
${generateThemeVars(lightTheme)}
}
.dark {
${generateThemeVars(darkTheme)}
}
`

  const baseCSS = `
/* Shumoku Embeddable Styles */
.shumoku-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  background: white;
  background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
  background-size: 16px 16px;
}
.shumoku-container.dragging { cursor: grabbing; }
.shumoku-container > svg { width: 100%; height: 100%; display: block; }

/* Node interactivity */
.node { cursor: pointer; }
.node rect,
.node circle,
.node polygon { transition: filter 0.15s ease, stroke 0.15s ease; }
.node:hover rect,
.node:hover circle,
.node:hover polygon {
  filter: drop-shadow(0 4px 12px rgba(59, 130, 246, 0.5));
  stroke: #3b82f6 !important;
  stroke-width: 2px !important;
}

/* Port interactivity */
.port { cursor: pointer; }
.port rect { transition: filter 0.15s; }
.port:hover rect { filter: brightness(1.1); }

/* Link interactivity */
.link-hit-area { cursor: pointer; }
.link { transition: stroke-width 0.15s ease, filter 0.15s ease; }
.link-group:hover .link {
  stroke-width: 4px !important;
  filter: drop-shadow(0 0 6px currentColor);
}

/* Subgraph interactivity */
.subgraph[data-has-sheet] { cursor: pointer; }
.subgraph[data-has-sheet] > rect { transition: filter 0.15s; }
.subgraph[data-has-sheet]:hover > rect {
  filter: brightness(1.05) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
}

/* Spotlight highlight overlay */
.shumoku-spotlight-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

/* Tooltip styles */
.shumoku-tooltip {
  position: absolute;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.95);
  color: white;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  border-radius: 6px;
  pointer-events: none;
  z-index: 1000;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  white-space: pre-wrap;
}
.shumoku-tooltip::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(15, 23, 42, 0.95);
}
`

  const toolbarCSS = toolbar
    ? `
/* Toolbar styles */
.shumoku-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}
.shumoku-toolbar-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}
.shumoku-toolbar button {
  padding: 6px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  color: #6b7280;
  transition: all 0.15s;
}
.shumoku-toolbar button:hover {
  background: #f3f4f6;
  color: #374151;
}
.shumoku-zoom-text {
  min-width: 50px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}
`
    : ''

  const navCSS = hierarchical ? getNavigationStyles() : ''

  return themeCSS + baseCSS + toolbarCSS + navCSS
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
