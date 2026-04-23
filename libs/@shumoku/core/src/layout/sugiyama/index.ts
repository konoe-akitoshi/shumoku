// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sugiyama-style layered layout pipeline.
 *
 * `layoutNetwork` delegates its internals to `layoutCompound` here;
 * callers outside core rarely need these primitives directly, but they
 * are exported for testability and so other layout-engine experiments
 * can reuse the individual phases without vendoring the whole module.
 *
 * Shared geometric types (`Position`, `Bounds`, `Size`, `Direction`)
 * live in `@shumoku/core/models` rather than being redefined here.
 */

export type { LayoutFlatOptions, LayoutFlatResult } from './compose.js'
export { layoutFlat } from './compose.js'
export type {
  CompoundLayoutOptions,
  CompoundLayoutResult,
  CompoundNode,
  CompoundSubgraph,
} from './compound.js'
export { layoutCompound } from './compound.js'
export type { AssignCoordinatesOptions } from './coords.js'
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
