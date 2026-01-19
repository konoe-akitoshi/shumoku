/**
 * PNG renderer - converts SVG to PNG using resvg
 */

import { Resvg } from '@resvg/resvg-js'

export interface PngOptions {
  /** Scale factor (default: 2) */
  scale?: number
  /** Load system fonts (default: true) */
  loadSystemFonts?: boolean
}

/**
 * Convert SVG string to PNG buffer
 */
export function renderToPng(svgString: string, options: PngOptions = {}): Buffer {
  const scale = options.scale ?? 2
  const loadSystemFonts = options.loadSystemFonts ?? true

  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts },
  })

  const pngData = resvg.render()
  return pngData.asPng()
}
