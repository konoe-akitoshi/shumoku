/**
 * PNG Renderer
 * Renders NetworkGraph to PNG (Node.js only)
 */

import type { LayoutResult, NetworkGraph } from '@shumoku/core'
import { Resvg } from '@resvg/resvg-js'
import * as svg from './svg.js'

export interface PngOptions {
  /** Scale factor for output resolution (default: 2) */
  scale?: number
  /** Load system fonts (default: true) */
  loadSystemFonts?: boolean
}

/**
 * Render NetworkGraph to PNG buffer
 */
export function render(
  graph: NetworkGraph,
  layout: LayoutResult,
  options: PngOptions = {},
): Buffer {
  const scale = options.scale ?? 2
  const loadSystemFonts = options.loadSystemFonts ?? true

  const svgString = svg.render(graph, layout)
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts },
  })

  return resvg.render().asPng()
}
