// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * `LayoutRules` implementation — small, boring policy
 * authority. See
 * `apps/editor/docs/design/layout-engine-architecture.md`.
 *
 * Implementation watchpoint: `LayoutRules` documentation and
 * JSDoc examples must not imply the rule layer *computes* or
 * *normalizes* port-side assignment. It only *consumes* the
 * per-side port lists supplied via `PortsBySide`. Anything
 * that decides "which side this port goes on" lives in the
 * algorithm.
 */

import { nodeBodySize as bodySize, nodeFootprint as footprint } from './node-size.js'
import type { Spacing } from './spacing.js'
import type {
  LayoutMetrics,
  Node,
  PortsBySide,
  Position,
  Rect,
  Size,
  TextMeasurer,
} from './types.js'

/**
 * Spatial rule authority. Consumes per-side port lists and
 * answers sizing / separation questions deterministically.
 */
export interface LayoutRules {
  // Sizing
  /** Body size: icon + label, no port-lane allowance. */
  nodeBodySize(node: Node): Size
  /**
   * Full footprint including port-lane allowance on each side
   * that carries ports. `portsBySide` describes the state of
   * affairs supplied by the caller; the rule layer does not
   * decide which side each port belongs to.
   */
  nodeFootprint(node: Node, ctx?: { portsBySide?: PortsBySide }): Size
  /** Axis-aligned obstacle rect at a position. */
  nodeObstacle(node: Node, pos: Position, ctx?: { portsBySide?: PortsBySide }): Rect

  // Separation
  /**
   * Minimum gap between two obstacles along an axis, given
   * they otherwise overlap on the perpendicular axis. Returns
   * the configured clearance when they project to overlap on
   * the other axis, zero otherwise. Algorithms compose this
   * with their own port-aware add-ons.
   */
  minSeparation(a: Rect, b: Rect, axis: 'x' | 'y'): number

  // Subgraph framing — config accessors
  readonly subgraphPadding: number
  readonly subgraphLabelHeight: number

  // Introspection
  readonly metrics: LayoutMetrics
  /** Stable hash of config — usable as cache key. */
  readonly fingerprint: string

  // Internals exposed for the auto-placement adapter
  readonly spacing: Spacing
  readonly text: TextMeasurer
}

const EMPTY_PORTS_BY_SIDE: PortsBySide = { top: [], bottom: [], left: [], right: [] }

/**
 * Build a LayoutRules implementation from a derived `Spacing`
 * plus the injected `TextMeasurer`. Stateless query functions
 * close over these two; `fingerprint` is computed once.
 */
export function createLayoutRules(
  spacing: Spacing,
  text: TextMeasurer,
  metrics: LayoutMetrics,
  density: 'compact' | 'normal' | 'comfortable',
): LayoutRules {
  const fingerprint = computeFingerprint(metrics, density, spacing)

  return {
    nodeBodySize(node) {
      return bodySize(node, text)
    },
    nodeFootprint(node, ctx) {
      return footprint(node, ctx?.portsBySide ?? EMPTY_PORTS_BY_SIDE, text)
    },
    nodeObstacle(node, pos, ctx) {
      const size = footprint(node, ctx?.portsBySide ?? EMPTY_PORTS_BY_SIDE, text)
      return {
        x: pos.x - size.width / 2,
        y: pos.y - size.height / 2,
        width: size.width,
        height: size.height,
      }
    },
    minSeparation(a, b, axis) {
      // If the two rects project to overlap on the
      // perpendicular axis, the visible gap along `axis` must
      // be at least `labelClearance`. Otherwise (they're
      // already separated on the perpendicular axis) they can
      // touch.
      if (axis === 'x') {
        const aTop = a.y
        const aBottom = a.y + a.height
        const bTop = b.y
        const bBottom = b.y + b.height
        return aBottom <= bTop || bBottom <= aTop ? 0 : spacing.labelClearance
      }
      const aLeft = a.x
      const aRight = a.x + a.width
      const bLeft = b.x
      const bRight = b.x + b.width
      return aRight <= bLeft || bRight <= aLeft ? 0 : spacing.labelClearance
    },
    subgraphPadding: spacing.subgraphPadding,
    subgraphLabelHeight: spacing.subgraphLabelHeight,
    metrics,
    spacing,
    text,
    fingerprint,
  }
}

/**
 * Stable, deterministic hash of the rule layer's inputs. Used
 * as a cache key by algorithms / editor code that want to
 * memoize rule-query results.
 */
function computeFingerprint(
  metrics: LayoutMetrics,
  density: 'compact' | 'normal' | 'comfortable',
  spacing: Spacing,
): string {
  // Canonical JSON of the inputs is enough; rule queries are
  // pure on these.
  return JSON.stringify({
    em: metrics.fontEmSize ?? null,
    reach: metrics.portLabelOuterReach ?? null,
    sgLabel: metrics.subgraphLabelHeight ?? null,
    density,
    spacing,
  })
}
