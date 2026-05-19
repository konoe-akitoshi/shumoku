// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout engine — small, boring policy authority.
 *
 * See `apps/editor/docs/design/layout-engine-architecture.md`
 * for the design philosophy. Briefly:
 *
 *   - `LayoutRules` answers sizing / separation / framing
 *     questions deterministically. No state, no algorithm.
 *   - `PlacementPolicy` answers `tryPlace` / `snapTo` for
 *     manual placement. Uses `LayoutRules` internally.
 *   - `TextMeasurer` is injectable; default is canvas-based.
 *
 * `createEngine` composes these. Both auto-placement and the
 * editor's manual-placement consume the same engine instance,
 * so layout and drag-snap stay consistent.
 */

import { createPlacementPolicy, type PlacementPolicy } from './placement.js'
import { createLayoutRules, type LayoutRules } from './rules.js'
import { deriveSpacing } from './spacing.js'
import { createDefaultTextMeasurer } from './text-measurer.js'
import type { EngineConfig, TextMeasurer } from './types.js'

/**
 * Composed engine. Implements both `LayoutRules` (sizing /
 * separation / framing) and `PlacementPolicy` (manual
 * placement). The injected `TextMeasurer` is exposed on
 * `.text` so renderers can call it directly when computing
 * label-background widths.
 */
export interface LayoutEngine extends LayoutRules, PlacementPolicy {
  readonly text: TextMeasurer
}

/**
 * Build an engine instance. Stateless across queries (every
 * call returns the same answer for the same input given the
 * same config). Memoization is allowed inside; the
 * `fingerprint` is the cache key.
 */
export function createEngine(config: EngineConfig = {}): LayoutEngine {
  const text = config.textMeasurer ?? createDefaultTextMeasurer()
  const spacing = deriveSpacing(config.metrics ?? {})
  const rules = createLayoutRules(spacing, text, config.metrics ?? {}, config.density ?? 'normal')
  const placement = createPlacementPolicy(rules)
  return {
    // LayoutRules
    nodeBodySize: rules.nodeBodySize,
    nodeFootprint: rules.nodeFootprint,
    nodeObstacle: rules.nodeObstacle,
    minSeparation: rules.minSeparation,
    subgraphPadding: rules.subgraphPadding,
    subgraphLabelHeight: rules.subgraphLabelHeight,
    metrics: rules.metrics,
    fingerprint: rules.fingerprint,
    spacing: rules.spacing,
    text: rules.text,
    // PlacementPolicy — note `tryPlace` is `function` (not
    // arrow) inside createPlacementPolicy so we re-bind it
    // here through the closure object.
    tryPlace: placement.tryPlace.bind(placement),
    snapTo: placement.snapTo.bind(placement),
  }
}

export type { LayoutRules } from './rules.js'
export type { PlacementPolicy } from './placement.js'
export { deriveSpacing, type Spacing } from './spacing.js'
export type {
  EngineConfig,
  LayoutMetrics,
  Node,
  NodeWithPosition,
  PlacementConflict,
  PlacementResult,
  PortInfo,
  PortsBySide,
  Position,
  Rect,
  Side,
  Size,
  TextMeasurer,
} from './types.js'
