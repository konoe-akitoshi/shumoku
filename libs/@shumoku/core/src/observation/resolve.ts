// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { SourceNetwork } from '../models/network-model.js'
import { fromNetworkGraph } from '../models/network-model-from-graph.js'
import { toNetworkGraph } from '../models/network-model-graph.js'
import type { NetworkGraph } from '../models/types.js'
import { resolveNetwork } from './resolve-network.js'
import type { ResolvedGraph, ResolveOptions, SnapshotEntry } from './types.js'

/**
 * Resolve the project's own graph against source snapshots, for callers that still hold graphs:
 * each graph is split into its configuration and layers, merged by `resolveNetwork`, and drawn
 * again. New callers should hold models and call `resolveNetwork` directly.
 */
export function resolve(
  authored: NetworkGraph,
  snapshots: SnapshotEntry[],
  options: ResolveOptions = {},
): ResolvedGraph {
  const merged = resolveNetwork(
    fromNetworkGraph(authored),
    snapshots.map(({ graph, ...snap }) => ({ ...snap, source: graph ? sourceOf(graph) : null })),
    options,
  )
  return {
    ...toNetworkGraph(merged),
    version: authored.version,
    ...(authored.pins && { pins: authored.pins }),
  }
}

function sourceOf(graph: NetworkGraph): SourceNetwork {
  const { config, ...layers } = fromNetworkGraph(graph)
  return { network: config, ...layers }
}
