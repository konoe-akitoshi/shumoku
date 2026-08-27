// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/renderer-png - PNG renderer for network diagrams
 * Node.js only (requires @resvg/resvg-js)
 */

import {
  computeNetworkLayout,
  darkTheme,
  lightTheme,
  type NetworkGraph,
  type Theme,
} from '@shumoku/core'
import { type PreparedRender, type PrepareOptions, prepareRender } from '@shumoku/renderer-svg'
import * as png from './png.js'

export type { PngOptions } from './png.js'
export { png }

/**
 * Options for PNG rendering
 */
export interface PNGRenderOptions {
  /** Scale factor (default: 2) */
  scale?: number
  /** Load system fonts (default: true) */
  loadSystemFonts?: boolean
  /** Fetch timeout for external icon URLs in milliseconds (default: 3000) */
  iconTimeout?: number
  /** Theme override. Defaults to graph.settings.theme, then light. */
  theme?: Theme
}

/**
 * Graph rendering options. Legacy prepare options are accepted so existing
 * callers can migrate without a flag day.
 */
export type PNGGraphRenderOptions = PNGRenderOptions & PrepareOptions

/**
 * Render PNG from prepared data (Node.js only)
 *
 * Uses resvg-js for high-quality SVG to PNG conversion.
 * Automatically embeds external CDN images as base64.
 *
 * Prefer renderGraphToPng(graph) for new callers. Prepared data with a
 * ResolvedLayout uses the canonical static renderer; legacy LayoutResult-only
 * data remains supported as a compatibility fallback.
 */
export async function renderPng(
  prepared: PreparedRender,
  options?: PNGRenderOptions,
): Promise<Buffer> {
  if (prepared.resolved) {
    const theme =
      options?.theme ?? (prepared.graph.settings?.theme === 'dark' ? darkTheme : lightTheme)
    return png.renderResolved(prepared.resolved, { ...options, theme })
  }
  return png.render(prepared.graph, prepared.layout, {
    scale: options?.scale,
    iconDimensions: prepared.iconDimensions ?? undefined,
  })
}

/**
 * Render network graph directly to PNG buffer.
 * This is the canonical graph entry point: it computes ResolvedLayout once and
 * rasterizes the same static SVG used by the CLI, server, and Svelte renderer.
 */
export async function renderGraphToPng(
  graph: NetworkGraph,
  options: PNGGraphRenderOptions = {},
): Promise<Buffer> {
  if (options.layout || options.iconDimensions) {
    const prepared = await prepareRender(graph, options)
    return renderPng(prepared, options)
  }
  const { resolved } = await computeNetworkLayout(graph)
  const theme = options.theme ?? (graph.settings?.theme === 'dark' ? darkTheme : lightTheme)
  return png.renderResolved(resolved, { ...options, theme })
}
