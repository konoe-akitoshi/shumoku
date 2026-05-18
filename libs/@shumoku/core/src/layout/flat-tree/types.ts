// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shared internal types for the flat-tree layout engine.
 *
 * Most are aliases for plain shapes (so callers don't depend on
 * specific Map vs Record choices). Keep them small; complex
 * algorithm-level invariants live in the module that owns them,
 * not in the type system.
 */

import type { Bounds } from '../../models/types.js'

/** Node centre position in SVG units. */
export interface Position {
  x: number
  y: number
}

/** Node footprint size in SVG units. */
export interface Size {
  width: number
  height: number
}

/**
 * One block from the partition: an opaque group of node ids
 * that the outer tidy-tree treats as a single unit. Members of
 * a block lay out together via {@link
 * ./internal.ts | block-internal layout}.
 */
export type BlockId = string

/** Node-id → block-id reverse lookup. */
export type BlockOfNode = Map<string, BlockId>

/** Block-id → ordered list of member node ids. */
export type BlockMembers = Map<BlockId, string[]>

/** Block-id → block-id (parent relationship in the outer tree). */
export type BlockParents = Map<BlockId, BlockId>

/** Parent block-id → ordered child block-ids. */
export type BlockChildren = Map<BlockId, BlockId[]>

/**
 * Result of laying out a block's members in local coordinates
 * (origin at the block's top-left corner).
 */
export interface InternalLayout {
  /** Member node id → local (x, y) inside the block's bbox. */
  positions: Map<string, Position>
  /** Block bounding box width in SVG units. */
  width: number
  /** Block bounding box height in SVG units. */
  height: number
}

/** Final shape returned by {@link ./index.ts | layoutFlatTree}. */
export interface FlatTreeLayoutResult {
  /** Absolute node centre positions. */
  nodePositions: Map<string, Position>
  /** Each subgraph's outer rectangle (post-process hull). */
  subgraphBounds: Map<string, Bounds>
  /** Tight bounding box around everything. */
  rootBounds: Bounds
}
