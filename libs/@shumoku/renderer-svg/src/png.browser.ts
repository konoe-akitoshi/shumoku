/**
 * PNG Renderer - Browser stub
 * Throws error when called in browser environment
 */

import type { LayoutResult, NetworkGraph } from '@shumoku/core'

export interface PngOptions {
  /** Scale factor for output resolution (default: 2) */
  scale?: number
  /** Load system fonts (default: true) */
  loadSystemFonts?: boolean
}

/**
 * Render NetworkGraph to PNG buffer (Node.js only)
 * @throws Error when called in browser
 */
export function render(
  _graph: NetworkGraph,
  _layout: LayoutResult,
  _options: PngOptions = {},
): Buffer {
  throw new Error('PNG rendering is only available in Node.js environment')
}
