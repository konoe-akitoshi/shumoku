// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sugiyama-style layered layout pipeline.
 *
 * This module is a parallel implementation of `layoutNetwork`, built out
 * phase by phase. It is not wired into the public `layoutNetwork` yet —
 * when the four phases are complete and validated against the existing
 * tree-based output, we will switch `layoutNetwork` to delegate here
 * and remove the legacy implementation.
 */

export type {
  AssignCoordinatesOptions,
  Direction,
  NodeSize,
  Position,
} from './coords.js'
export { assignCoordinates } from './coords.js'
export { removeCycles } from './cycles.js'
export { assignLayers } from './layers.js'
export type { ReduceCrossingsOptions } from './ordering.js'
export { reduceCrossings } from './ordering.js'
export type {
  CycleRemovalResult,
  Edge,
  EdgeId,
  LayerAssignment,
  NodeId,
} from './types.js'
