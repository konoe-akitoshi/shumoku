// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/renderer-png - PNG renderer for network diagrams
 * Node.js only (requires @resvg/resvg-js)
 */

import type { NetworkGraph } from '@shumoku/core'
import type { PreparedRender, PrepareOptions } from '@shumoku/renderer-svg'
import { prepareRender } from '@shumoku/renderer-svg'
import * as png from './png.js'

export { png }
export type { PngOptions } from './png.js'

/**
 * Options for PNG rendering
 */
export interface PNGRenderOptions {
  /** Scale factor (default: 2) */
  scale?: number
}

/**
 * Render PNG from prepared data (Node.js only)
 *
 * Uses resvg-js for high-quality SVG to PNG conversion.
 * Automatically embeds external CDN images as base64.
 */
export async function renderPng(
  prepared: PreparedRender,
  options?: PNGRenderOptions,
): Promise<Buffer> {
  return png.render(prepared.graph, prepared.layout, {
    scale: options?.scale,
    iconDimensions: prepared.iconDimensions?.byUrl,
  })
}

/**
 * Render network graph directly to PNG buffer.
 * Convenience function that combines prepareRender + renderPng.
 */
export async function renderGraphToPng(
  graph: NetworkGraph,
  options?: PrepareOptions & PNGRenderOptions,
): Promise<Buffer> {
  const prepared = await prepareRender(graph, options)
  return renderPng(prepared, options)
}
