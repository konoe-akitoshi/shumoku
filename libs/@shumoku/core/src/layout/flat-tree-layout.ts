// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Compatibility shim — the implementation moved to
 * `./flat-tree/` (one module per pipeline phase). This file
 * re-exports the public surface so existing imports keep
 * working.
 *
 * New code should import from `./flat-tree/` directly.
 */

export {
  computeSubgraphHulls,
  type FlatTreeLayoutOptions,
  type FlatTreeLayoutResult,
  layoutFlatTree,
} from './auto-placement/flat-tree/index.js'
