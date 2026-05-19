// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shared types for the layout engine.
 *
 * See `apps/editor/docs/design/layout-engine-architecture.md`
 * for the design philosophy. Briefly: engine is a small,
 * boring rule authority. Algorithms consume rules; rules do
 * not vend algorithms.
 */

import type { Direction, Node } from '../../models/types.js'

// ─────────────────────────────────────────────────────────────
// Primitive geometry
// ─────────────────────────────────────────────────────────────

export interface Size {
  width: number
  height: number
}

export interface Position {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type Side = 'top' | 'bottom' | 'left' | 'right'

// ─────────────────────────────────────────────────────────────
// Port-side info
// ─────────────────────────────────────────────────────────────

/**
 * One port's identity, as far as the layout engine cares.
 * The label is what the engine measures to size port lanes;
 * the id lets algorithms map this entry back to the original
 * `Node.ports[]` member.
 */
export interface PortInfo {
  id: string
  label?: string
}

/**
 * Per-side port lists. The engine consumes this to size node
 * footprints. It does NOT decide which side each port lives
 * on — that's an algorithm-coupled decision and lives in
 * auto-placement.
 */
export interface PortsBySide {
  top: PortInfo[]
  bottom: PortInfo[]
  left: PortInfo[]
  right: PortInfo[]
}

// ─────────────────────────────────────────────────────────────
// Layout metrics (renderer-supplied measurements)
// ─────────────────────────────────────────────────────────────

/**
 * Renderer-supplied measurements that drive engine spacing.
 *
 * All fields are optional. When a field is absent the engine
 * falls back to a value that matches the historical default
 * (em = 12, port-label reach = the core `PORT_LABEL_OUTER_REACH`
 * constant). Pass the relevant fields when you want the layout
 * to track the renderer's actual geometry.
 */
export interface LayoutMetrics {
  /**
   * Outer extent of a port-label box, measured from the port
   * centre along the port's outward normal. Defaults to the
   * core `PORT_LABEL_OUTER_REACH` constant.
   */
  portLabelOuterReach?: number
  /**
   * Base font em-size in pixels. Drives `labelClearance` and
   * the default subgraph label-band height. Defaults to 12.
   */
  fontEmSize?: number
  /**
   * Pre-measured subgraph label band height. Overrides the
   * em-based derivation. Use this when the renderer has
   * already measured the actual rendered label text.
   */
  subgraphLabelHeight?: number
}

// ─────────────────────────────────────────────────────────────
// Placement policy (manual placement)
// ─────────────────────────────────────────────────────────────

/**
 * An occupant of the canvas — what `PlacementPolicy.tryPlace`
 * checks against when deciding whether a candidate position
 * is valid. Just the fields the engine needs: identity, where
 * it sits, and how much room it claims.
 */
export interface NodeWithPosition {
  id: string
  position: Position
  footprint: Rect
}

/**
 * One conflict surfaced by `tryPlace` — the candidate
 * placement would overlap with `withNodeId`'s footprint by
 * `overlap`.
 */
export interface PlacementConflict {
  withNodeId: string
  overlap: Rect
}

/**
 * Structured result of `PlacementPolicy.tryPlace`. The editor
 * surfaces the conflicts to show why a placement is invalid,
 * and uses `snapped` when offering a nearby valid position.
 */
export interface PlacementResult {
  valid: boolean
  requested: Position
  snapped: Position
  footprint: Rect
  /** Empty when `valid` is true. */
  conflicts: PlacementConflict[]
}

// ─────────────────────────────────────────────────────────────
// Engine config
// ─────────────────────────────────────────────────────────────

/**
 * Engine config. Direction is NOT here — it's only consumed
 * by auto-placement (for port-side assignment and final
 * rotation). Rules are direction-neutral by construction.
 */
export interface EngineConfig {
  metrics?: LayoutMetrics
  /** Density preset. Currently a no-op; reserved for future tuning. */
  density?: 'compact' | 'normal' | 'comfortable'
  /** Inject a TextMeasurer; default = canvas-based. */
  textMeasurer?: TextMeasurer
}

// ─────────────────────────────────────────────────────────────
// TextMeasurer
// ─────────────────────────────────────────────────────────────

/**
 * Text width source. Injected into the engine so renderers
 * with authoritative font metrics can supply their own — the
 * SVG renderer in a browser knows the actual sub-pixel widths;
 * the CLI renderer doesn't, and the default approximation is
 * fine for it.
 */
export interface TextMeasurer {
  /**
   * Width in SVG units of `text` rendered at the engine's
   * configured font for `kind`.
   *
   *   body     — the primary node label (`.node-label`, 14 px)
   *   port     — a port label             (`.port-label`,  9 px)
   *   subgraph — a subgraph title         (`.subgraph-label`, 11 px)
   */
  measure(text: string, kind: 'body' | 'port' | 'subgraph'): number
}

// ─────────────────────────────────────────────────────────────
// Re-export the domain Node so callers don't have to import
// from two places when working with the engine.
// ─────────────────────────────────────────────────────────────

export type { Direction, Node }
