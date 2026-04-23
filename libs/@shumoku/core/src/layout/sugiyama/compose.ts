// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Flat (non-compound) Sugiyama pipeline: the four phases composed in
 * order into a single `layoutFlat` function that takes a plain node /
 * edge set and returns positions.
 *
 *   removeCycles → assignLayers → reduceCrossings → assignCoordinates
 *
 * This is the single-container primitive — compound graphs
 * (subgraph nesting) are handled one level up in `compound.ts` by
 * recursing into each subgraph before running `layoutFlat` on the
 * parent container's direct children.
 *
 * Fixed-position enforcement is applied as a post-processing step: the
 * pipeline runs normally, then each node whose id is in `fixed` gets
 * its output position overridden with the caller-supplied hint. The
 * surrounding nodes keep their algorithm-derived positions, so the
 * result is "algorithm output, with these specific positions nailed
 * down". Strict hard-constraint layout would require feeding the pin
 * into layer/order assignment too; we defer that until a concrete
 * need arises.
 */

import { type AssignCoordinatesOptions, assignCoordinates, type Position } from './coords.js'
import { removeCycles } from './cycles.js'
import { assignLayers } from './layers.js'
import { reduceCrossings } from './ordering.js'
import type { Edge, NodeId } from './types.js'

export interface LayoutFlatOptions extends AssignCoordinatesOptions {
  /** Barycenter iterations for crossing reduction. */
  iterations?: number
  /**
   * Nodes whose output position should be forced to this map's value,
   * overriding the algorithm's choice. Typically used to keep
   * already-placed nodes put while only new or moved ones get
   * repositioned.
   */
  fixed?: Map<NodeId, Position>
}

export interface LayoutFlatResult {
  positions: Map<NodeId, Position>
  /** Layer index of each node, useful for subsequent port placement. */
  layerOf: Map<NodeId, number>
  /** Number of layers produced. */
  layerCount: number
  /** Edges that cycle removal reversed, for renderers that care. */
  reversedEdges: Set<string>
}

export function layoutFlat(
  nodes: NodeId[],
  edges: Edge[],
  options: LayoutFlatOptions = {},
): LayoutFlatResult {
  // Phase 1: break cycles so subsequent phases can assume a DAG.
  const { dag, reversed } = removeCycles(nodes, edges)

  // Phase 2: assign each node an integer layer.
  const layerAssignment = assignLayers(nodes, dag)

  // Phase 3: reorder within layers to minimise crossings.
  const ordered = reduceCrossings(layerAssignment, dag, {
    iterations: options.iterations,
  })

  // Phase 4: layers + order → absolute coordinates. Pass the DAG so
  // `assignCoordinates` can do barycenter alignment (child tracks the
  // mean x of its predecessors) instead of naively centring each layer.
  const positions = assignCoordinates(ordered, { ...options, edges: dag })

  // Optional post-process: override positions for fixed nodes. The
  // caller owns the tradeoff — fixed positions aren't fed back into
  // layer/order assignment, so adjacent layout may look "off" near a
  // pinned node if the pin disagrees with the algorithm. For small
  // `fixed` sets (e.g. "add one new node, pin everyone else") this is
  // fine; for big disagreements the caller should not expect miracles.
  if (options.fixed && options.fixed.size > 0) {
    for (const [id, pos] of options.fixed) {
      if (positions.has(id)) positions.set(id, pos)
    }
  }

  return {
    positions,
    layerOf: ordered.layerOf,
    layerCount: ordered.layers.length,
    reversedEdges: reversed,
  }
}
