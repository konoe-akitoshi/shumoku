/**
 * Browser-specific pipeline extensions
 *
 * PNG rendering is not supported in browsers - these stubs throw errors
 */

import type { NetworkGraph } from '@shumoku/core'
import type { PreparedRender, PrepareOptions } from './pipeline.js'

// Re-export everything from base pipeline
export * from './pipeline.js'

/**
 * Options for PNG rendering (not supported in browsers)
 */
export interface PNGRenderOptions {
  /** Scale factor (default: 2) */
  scale?: number
}

/**
 * Render PNG from prepared data (NOT SUPPORTED IN BROWSERS)
 *
 * @throws Error - PNG rendering requires Node.js with @resvg/resvg-js
 */
export async function renderPng(
  _prepared: PreparedRender,
  _options?: PNGRenderOptions,
): Promise<Buffer> {
  throw new Error(
    'PNG rendering is not supported in browsers. ' +
      'Use Node.js with @resvg/resvg-js for PNG rendering, ' +
      'or use Canvas API for browser-based PNG export.',
  )
}

/**
 * Render network graph directly to PNG buffer (NOT SUPPORTED IN BROWSERS)
 *
 * @throws Error - PNG rendering requires Node.js with @resvg/resvg-js
 */
export async function renderGraphToPng(
  _graph: NetworkGraph,
  _options?: PrepareOptions & PNGRenderOptions,
): Promise<Buffer> {
  throw new Error(
    'PNG rendering is not supported in browsers. ' +
      'Use Node.js with @resvg/resvg-js for PNG rendering, ' +
      'or use Canvas API for browser-based PNG export.',
  )
}
