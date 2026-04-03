// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * ELK-based Node Placement Engine
 *
 * Wraps the existing HierarchicalLayout to provide node positioning
 * through the NodePlacementEngine interface. Edge routing from ELK
 * is captured but will be replaced by LibavoidEdgeRouter in the pipeline.
 *
 * This adapter exists to enable the two-stage pipeline:
 *   ELK (node placement) → libavoid (edge routing)
 *
 * In Phase 2, this will be replaced by a custom NetworkLayoutEngine.
 */

import type { NetworkGraph } from '../models/index.js'
import { HierarchicalLayout, type HierarchicalLayoutOptions } from './hierarchical.js'
import type {
  EdgeRoutingResult,
  NodePlacementEngine,
  NodePlacementResult,
  PlacementOptions,
} from './types.js'
import { decomposeLayoutResult } from './types.js'

export class ElkNodePlacement implements NodePlacementEngine {
  private layoutEngine: HierarchicalLayout
  /**
   * ELK computes edges as part of layout. We capture them here
   * so they can be used as fallback or for comparison during migration.
   */
  private lastEdgeRouting: EdgeRoutingResult | null = null

  constructor(options?: HierarchicalLayoutOptions) {
    this.layoutEngine = new HierarchicalLayout(options)
  }

  async place(graph: NetworkGraph, options?: PlacementOptions): Promise<NodePlacementResult> {
    // Build HierarchicalLayout options from PlacementOptions
    const layoutOptions: HierarchicalLayoutOptions = {
      direction: options?.direction,
      nodeSpacing: options?.nodeSpacing,
      rankSpacing: options?.rankSpacing,
      subgraphPadding: options?.subgraphPadding,
      iconDimensions: options?.iconDimensions,
    }

    // Use a fresh engine if options differ from constructor
    const engine = options
      ? new HierarchicalLayout(layoutOptions)
      : this.layoutEngine

    // ELK computes both placement and routing in one pass
    const fullResult = await engine.layoutAsync(graph)

    // Split into placement + routing
    const { placement, routing } = decomposeLayoutResult(fullResult)

    // Cache edge routing for potential fallback use
    this.lastEdgeRouting = routing

    return placement
  }

  /**
   * Get the edge routing that ELK computed during the last place() call.
   * Useful for comparison/fallback during libavoid migration.
   */
  getLastEdgeRouting(): EdgeRoutingResult | null {
    return this.lastEdgeRouting
  }
}
