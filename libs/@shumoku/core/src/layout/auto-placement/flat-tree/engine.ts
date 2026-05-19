// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Public facade for the flat-tree layout engine.
 *
 * Hides the 6-argument internal entry behind a small builder
 * API:
 *
 * ```ts
 * const engine = createFlatTreeEngine()
 * const result = engine.layout(graph, {
 *   sizeById,
 *   shouldFlip,
 *   direction: 'TB',
 *   pinned: new Map([['router-1', { x: 0, y: 0 }]]),
 *   metrics: { fontEmSize: 14, portLabelOuterReach: 24 },
 * })
 * ```
 *
 * `metrics` are renderer-supplied measurements that drive the
 * engine's spacing derivation (see `./spacing.ts`). Omit them
 * and the engine falls back to standalone defaults.
 *
 * Callers don't need to construct the `nodesById` map (the
 * facade does it). They still pass `sizeById` because node
 * footprint sizes come from a separate code path (the
 * renderer's port-aware computeNodeFootprint) and the engine
 * shouldn't duplicate that logic.
 */

import type { Link, NetworkGraph } from '../../../models/types.js'
import { type FlatTreeLayoutOptions, type FlatTreeLayoutResult, layoutFlatTree } from './index.js'
import type { Size } from './types.js'

export interface LayoutRequest extends FlatTreeLayoutOptions {
  /** Per-node footprint size. Required. */
  sizeById: Map<string, Size>
  /**
   * Predicate: should this link have its direction swapped
   * before being fed to the engine? Typically a wrapper
   * around the device-type heuristic in `network-layout.ts`.
   * Defaults to never flipping.
   */
  shouldFlip?: (link: Link) => boolean
}

export interface FlatTreeEngine {
  /**
   * Lay out one network graph. Returns positions, subgraph
   * bounds, the root bbox, and any diagnostics.
   */
  layout(graph: NetworkGraph, request: LayoutRequest): FlatTreeLayoutResult
}

/**
 * Construct a layout engine instance. Stateless today; the
 * factory is the seam for future per-instance state (caches,
 * incremental refinement, telemetry).
 */
export function createFlatTreeEngine(): FlatTreeEngine {
  return {
    layout(graph, request) {
      const nodesById = new Map(graph.nodes.map((n) => [n.id, n]))
      const subgraphsById = new Map((graph.subgraphs ?? []).map((s) => [s.id, s]))
      const shouldFlip = request.shouldFlip ?? (() => false)
      return layoutFlatTree(graph, nodesById, subgraphsById, request.sizeById, shouldFlip, request)
    },
  }
}
