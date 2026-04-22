// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared types for the Sugiyama-style layered layout pipeline.
 *
 * The pipeline runs in four phases:
 *   1. Cycle removal       — DFS back edges get reversed so the graph is a DAG
 *   2. Layer assignment    — longest-path ranking gives each node an integer layer
 *   3. Crossing reduction  — barycenter ordering within each layer
 *   4. Coordinate assignment — layer + order → absolute x/y
 *
 * Each phase operates on the minimal data it needs; phases pass a growing
 * intermediate structure (Edge[] → LayerAssignment → LayerOrder → Positions).
 */

export type NodeId = string
export type EdgeId = string

/**
 * An edge between two nodes. `reversed` is set by the cycle-removal phase
 * when a back edge has been flipped so the graph is a DAG — downstream
 * phases lay out the edge as if it went source→target but renderers can
 * use the flag to draw it the original direction.
 */
export interface Edge {
  id: EdgeId
  source: NodeId
  target: NodeId
  reversed?: boolean
}

/**
 * Output of the cycle-removal phase. `dag` is the edge list with back
 * edges already reversed (so `source` precedes `target` in any topo
 * order); `reversed` tracks which original edges were flipped.
 */
export interface CycleRemovalResult {
  dag: Edge[]
  reversed: Set<EdgeId>
}

/**
 * Output of the layer-assignment phase.
 *   layers[i] = ordered list of node ids at layer i (i=0 is the source layer)
 *   layerOf maps each node id → layer index
 */
export interface LayerAssignment {
  layers: NodeId[][]
  layerOf: Map<NodeId, number>
}
