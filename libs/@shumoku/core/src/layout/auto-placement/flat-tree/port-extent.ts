// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Port-aware gap computation.
 *
 * The engine's spacing module exposes WORST-CASE gap values
 * (`spacing.internalNodeGap`, `internalRootGap`,
 * `internalLayerGap`) — each baked with an assumption about
 * how many of the facing sides typically carry a port. The
 * helpers in this module replace those assumptions with
 * concrete per-node port-side information when the caller
 * has it.
 *
 * Inputs (`PortsBySide`) come from
 * `network-layout.ts:decidePortSides` — already computed
 * before the engine runs, so plumbing is "pass the existing
 * map through".
 *
 * If the caller passes no port info, the helpers in this
 * module fall back to the legacy constants exactly. That
 * keeps every existing snapshot stable while letting the
 * wrapper opt in to tighter gaps incrementally.
 *
 * The classification is **monotone**: more ports on facing
 * sides → larger gap; fewer ports → smaller gap. There is no
 * scenario in which adding port information yields a gap
 * larger than the worst-case fallback.
 */

import type { Spacing } from './spacing.js'

/**
 * Number of ports on each side of a node. Source: the
 * direction-aware port placement pass in
 * `network-layout.ts:decidePortSides`.
 */
export interface PortsBySide {
  top: number
  bottom: number
  left: number
  right: number
}

/** A per-node ports-by-side map. */
export type PortsBySideMap = ReadonlyMap<string, PortsBySide>

/** One of a node's four sides. */
export type Side = 'top' | 'bottom' | 'left' | 'right'

/**
 * What occupies a given side of a node from the layout's
 * perspective. `hasPort=true` means the side carries at least
 * one port (with its label extending outward).
 */
export interface SideExtent {
  hasPort: boolean
  /**
   * Override of the reach value when `hasPort=true`. Defaults
   * to `spacing.portLabelOuterReach`. Use this when the caller
   * has measured a specific label width.
   */
  extent?: number
}

function hasPortOnSide(
  nodeId: string,
  side: Side,
  ports: PortsBySideMap | undefined,
): boolean | undefined {
  if (!ports) return undefined
  const bySide = ports.get(nodeId)
  if (!bySide) return undefined
  return bySide[side] > 0
}

/**
 * Gap between two horizontally-adjacent nodes (left and right)
 * sized from the actual ports on the facing sides. Falls back
 * to `spacing.internalNodeGap` when port info is absent — the
 * legacy "one label might face the other" value, preserved for
 * snapshot stability.
 */
export function horizontalSiblingGap(
  leftId: string,
  rightId: string,
  spacing: Spacing,
  ports?: PortsBySideMap,
): number {
  const leftRight = hasPortOnSide(leftId, 'right', ports)
  const rightLeft = hasPortOnSide(rightId, 'left', ports)
  if (leftRight === undefined || rightLeft === undefined) return spacing.internalNodeGap
  return gapBetween({ hasPort: leftRight }, { hasPort: rightLeft }, spacing)
}

/**
 * Gap between two vertically-stacked nodes (upper above lower)
 * sized from the upper's bottom-side and the lower's top-side
 * port presence. Falls back to `spacing.internalLayerGap` when
 * port info is absent — the legacy "labels on both facing
 * sides" worst case.
 */
export function verticalLayerGap(
  upperId: string,
  lowerId: string,
  spacing: Spacing,
  ports?: PortsBySideMap,
): number {
  const upperBottom = hasPortOnSide(upperId, 'bottom', ports)
  const lowerTop = hasPortOnSide(lowerId, 'top', ports)
  if (upperBottom === undefined || lowerTop === undefined) return spacing.internalLayerGap
  return gapBetween({ hasPort: upperBottom }, { hasPort: lowerTop }, spacing)
}

/**
 * Gap between an emitter root and its side-chain head (root's
 * right side ↔ chain head's left side). Falls back to
 * `spacing.internalRootGap` when port info is absent — the
 * legacy "one label might face the other" value.
 */
export function rootToChainHorizontalGap(
  rootId: string,
  chainHeadId: string,
  spacing: Spacing,
  ports?: PortsBySideMap,
): number {
  const rootRight = hasPortOnSide(rootId, 'right', ports)
  const chainLeft = hasPortOnSide(chainHeadId, 'left', ports)
  if (rootRight === undefined || chainLeft === undefined) return spacing.internalRootGap
  return gapBetween({ hasPort: rootRight }, { hasPort: chainLeft }, spacing)
}

/**
 * The bedrock primitive: the gap that must separate two
 * adjacent nodes whose facing sides are described by `right`
 * (LEFT node's right side) and `left` (RIGHT node's left side).
 *
 *   gap = right.reach + left.reach + labelClearance
 *
 * where each `reach` is `portLabelOuterReach` if the side has
 * a port, else 0.
 *
 * For a vertical pair, pass the upper node's bottom-side info
 * as `right` and the lower node's top-side info as `left` —
 * the math is the same; the names just refer to which node is
 * "first" along the gap axis.
 */
export function gapBetween(right: SideExtent, left: SideExtent, spacing: Spacing): number {
  const a = right.hasPort ? (right.extent ?? spacing.portLabelOuterReach) : 0
  const b = left.hasPort ? (left.extent ?? spacing.portLabelOuterReach) : 0
  return a + b + spacing.labelClearance
}
