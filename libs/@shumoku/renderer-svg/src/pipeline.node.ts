/**
 * Node.js-specific render pipeline extensions
 *
 * Adds PNG rendering support using resvg-js
 */

import type { PreparedRender } from './pipeline.js'
import * as png from './png.js'

// Re-export everything from base pipeline
export * from './pipeline.js'

/**
 * Options for PNG rendering (Node.js only)
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
 *
 * @example
 * ```typescript
 * import { renderGraphToPng } from '@shumoku/renderer'
 * const pngBuffer = await renderGraphToPng(graph)
 * writeFileSync('output.png', pngBuffer)
 * ```
 */
export async function renderGraphToPng(
  graph: Parameters<typeof import('./pipeline.js').prepareRender>[0],
  options?: Parameters<typeof import('./pipeline.js').prepareRender>[1] & PNGRenderOptions,
): Promise<Buffer> {
  const { prepareRender } = await import('./pipeline.js')
  const prepared = await prepareRender(graph, options)
  return renderPng(prepared, options)
}
