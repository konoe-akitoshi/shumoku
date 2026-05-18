// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Static fallback constants for the flat-tree engine.
 *
 * Every spacing value the pipeline reads at runtime is computed
 * by {@link ./spacing.ts | deriveSpacing}. The only static
 * constant left here is the fallback node footprint — used when
 * `sizeById` is missing an entry and no other source can supply
 * a measured size. Make that a literal because there is, by
 * definition, no "real" measurement to derive it from.
 */

/** Fallback node footprint when `sizeById` is missing the entry. */
export const DEFAULT_NODE_SIZE = { width: 80, height: 60 } as const
