// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { graphToSource } from '../models/network-model-from-graph.js'
import { toNetworkGraph } from '../models/network-model-graph.js'
import type { NetworkGraph } from '../models/types.js'
import { resolveNetwork } from './resolve-network.js'
import type { ResolvedGraph, ResolveOptions, SnapshotEntry } from './types.js'

/**
 * Resolve the project's own graph against source snapshots, for callers that still hold graphs:
 * each graph is split into a contribution, merged by `resolveNetwork`, and the merged model is
 * drawn again with its observation record. New callers should hold contributions and call
 * `resolveNetwork` directly.
 */
export function resolve(
  authored: NetworkGraph,
  snapshots: SnapshotEntry[],
  options: ResolveOptions = {},
): ResolvedGraph {
  const { model, observation } = resolveNetwork(
    graphToSource(authored),
    snapshots.map(({ graph, ...snap }) => ({
      ...snap,
      source: graph ? graphToSource(graph) : null,
    })),
    options,
  )
  return { ...toNetworkGraph(model, observation), version: authored.version }
}
