// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The pure half of a bake: resolve the sources into one model, filter what the display hides,
 * and draw. `derive-worker.ts` runs it in a Worker; this file has no Worker in it so it can be
 * called, and tested, directly.
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
import type { DeriveResult } from './topology.js'

export interface DeriveRequest {
  project: NetworkModel
  snapshots: SourceSnapshot[]
  scope?: ScopeFilter
  hideDisconnected: boolean
}

/**
 * Resolves and draws. The drawing reads the model, not the graph: the order a person put siblings
 * in (`drawing.order`) rides through `resolveNetwork` and is read by the engine itself, so the
 * Server's picture of a model is the Editor's.
 */
export function derive(
  req: DeriveRequest,
  onStage: (stage: 'resolve' | 'layout') => void = () => {},
): DeriveResult {
  onStage('resolve')
  const merged = resolveNetwork(req.project, req.snapshots, { scope: req.scope })
  const resolvedGraph = toNetworkGraph(merged)
  const graph = req.hideDisconnected ? filterDisconnected(resolvedGraph) : resolvedGraph
  // The nodes the display filter dropped are dropped from the model that is drawn as well.
  const kept = new Set(graph.nodes.map((n) => n.id))
  const drawn: NetworkModel = req.hideDisconnected
    ? {
        ...merged,
        config: { ...merged.config, nodes: merged.config.nodes.filter((n) => kept.has(n.id)) },
      }
    : merged

  onStage('layout')
  const scene = drawNetworkScene(drawn)
  return { graph, scene }
}
