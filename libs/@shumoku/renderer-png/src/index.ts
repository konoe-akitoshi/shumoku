// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/renderer-png - PNG renderer for network diagrams
 * Node.js only (requires @resvg/resvg-js)
 */

import { fromNetworkGraph, type NetworkGraph, type NetworkModel } from '@shumoku/core'
import { type NetworkSvgOptions, renderNetworkSvg } from '@shumoku/renderer/static'
import * as png from './png.js'

export type { PngOptions } from './png.js'
export { renderSvgToPng } from './png.js'
export { png }

/** Options for PNG rendering: how it is drawn, and how it is rasterized. */
export type NetworkPngOptions = NetworkSvgOptions & Omit<png.PngOptions, 'theme'>

/**
 * Render a model to a PNG buffer: the SVG `renderNetworkSvg` draws, rasterized with resvg and
 * its external icon images embedded.
 */
export async function renderNetworkPng(
  model: NetworkModel,
  options: NetworkPngOptions = {},
): Promise<Buffer> {
  const { scale, loadSystemFonts, iconTimeout, ...drawing } = options
  return png.renderSvgToPng(renderNetworkSvg(model, drawing), {
    ...(scale !== undefined && { scale }),
    ...(loadSystemFonts !== undefined && { loadSystemFonts }),
    ...(iconTimeout !== undefined && { iconTimeout }),
  })
}

/** Render a network graph to a PNG buffer: split into a model, then as `renderNetworkPng`. */
export async function renderGraphToPng(
  graph: NetworkGraph,
  options: NetworkPngOptions = {},
): Promise<Buffer> {
  return renderNetworkPng(fromNetworkGraph(graph).model, options)
}
