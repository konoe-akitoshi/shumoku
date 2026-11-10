// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { fromNetworkGraph, type NetworkGraph } from '@shumoku/core'
import { type NetworkSvgOptions, renderNetworkSvg } from '@shumoku/renderer/static'

/**
 * Render a network graph to an SVG string. The graph is split into a model and drawn by the
 * drawing engine (`renderNetworkSvg`); a graph's theme setting is honoured unless `theme` is given.
 */
export async function renderGraphToSvg(
  graph: NetworkGraph,
  options: NetworkSvgOptions = {},
): Promise<string> {
  return renderNetworkSvg(fromNetworkGraph(graph).model, options)
}
