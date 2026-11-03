// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Derivation worker — runs the CPU-heavy half of a topology parse
 * (resolve → display filter → drawing) in a Bun Worker so the serving event
 * loop stays responsive. A large drawing can take minutes; on the main thread
 * that froze every API request (the "Loading topology..." hang after a big
 * Sync).
 *
 * Pure compute: all inputs arrive via postMessage (no DB access here), the
 * result goes back the same way.
 *
 * Protocol (worker → host):
 *   { type: 'progress', stage: 'resolve' | 'layout' }
 *   { type: 'result', graph, scene }
 *   { type: 'error', message }
 */

import {
  type NetworkModel,
  resolveNetwork,
  type ScopeFilter,
  type SourceSnapshot,
  toNetworkGraph,
} from '@shumoku/core'
import { drawNetworkScene } from '@shumoku/renderer/static'
import { filterDisconnected } from './display-filter.js'

export interface DeriveRequest {
  project: NetworkModel
  snapshots: SourceSnapshot[]
  scope?: ScopeFilter
  hideDisconnected: boolean
}

declare var self: Worker

self.onmessage = (event: MessageEvent) => {
  const req = event.data as DeriveRequest
  try {
    self.postMessage({ type: 'progress', stage: 'resolve' })
    const merged = resolveNetwork(req.project, req.snapshots, { scope: req.scope })
    const resolvedGraph = toNetworkGraph(merged)
    const graph = req.hideDisconnected ? filterDisconnected(resolvedGraph) : resolvedGraph
    // The drawing reads the model, not the graph: the nodes the display filter dropped are dropped
    // from the model it draws as well.
    const kept = new Set(graph.nodes.map((n) => n.id))
    const drawn: NetworkModel = req.hideDisconnected
      ? {
          ...merged,
          config: { ...merged.config, nodes: merged.config.nodes.filter((n) => kept.has(n.id)) },
        }
      : merged

    self.postMessage({ type: 'progress', stage: 'layout' })
    const scene = drawNetworkScene(drawn)

    self.postMessage({ type: 'result', graph, scene })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
