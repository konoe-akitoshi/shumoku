// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Block-internal layout.
 *
 * Each block's members are placed inside the block's local
 * coordinate frame (origin at top-left). The outer tidy-tree
 * later translates the whole block to its absolute position.
 *
 * Three internal-layout variants:
 *
 *   1. **Single member** — block is one node; position it at
 *      its centre. The block size equals the node size.
 *
 *   2. **Multi-root subtree row** ({@link
 *      layoutBlockInternal | default}) — each intra-root sits
 *      at the top of its own subtree column; subtrees stack
 *      horizontally, descendants fan out beneath their roots
 *      via {@link layoutWrappedSubtree}.
 *
 *   3. **Emitter with side chain** ({@link
 *      layoutEmitterWithSideChain}) — when the block's single
 *      intra-root also emits a tree-edge *outside* the block,
 *      the root sits at the top centre with the in-block chain
 *      hanging off to the right. The block then pads
 *      symmetrically on the left so the root lands at the
 *      block's horizontal centre — that way the outer tidy-
 *      tree places downstream child blocks directly below the
 *      root, and any wire from the root's bottom port runs
 *      straight down through the empty left gutter without
 *      passing through chain members.
 *
 * All three return the same shape: positions in local coords
 * + block bbox width and height.
 */

import { DEFAULT_NODE_SIZE } from './constants.js'
import {
  horizontalSiblingGap,
  type PortsBySideMap,
  rootToChainHorizontalGap,
  verticalLayerGap,
} from './port-extent.js'
import { deriveSpacing, type Spacing } from './spacing.js'
import type { InternalLayout, Position, Size } from './types.js'

/**
 * Lay out a block's members.
 *
 * - `memberIds`: ordered list of block members (order is
 *   used only as a tiebreaker for deterministic output).
 * - `parents`: primary-parent map for the whole graph.
 *   Children inside the block are detected as `parents.get(m)`
 *   being in `memberSet`.
 * - `sizeById`: per-node footprint size.
 * - `rootIsExternalEmitter`: when true, switch to the emitter-
 *   with-side-chain variant. Caller can compute this once via
 *   {@link ../blocks.ts | findExternalEmitterBlocks}.
 * - `spacing`: concrete gap values from {@link ./spacing.ts |
 *   deriveSpacing}. Optional; absent argument falls back to the
 *   default derivation (em = 12, port-label reach from core
 *   constants).
 */
export function layoutBlockInternal(
  memberIds: readonly string[],
  parents: Map<string, string>,
  sizeById: Map<string, Size>,
  rootIsExternalEmitter = false,
  spacing: Spacing = deriveSpacing(),
  portsBySideById?: PortsBySideMap,
): InternalLayout {
  if (memberIds.length === 1) return layoutSingleMember(memberIds[0], sizeById)

  const memberSet = new Set(memberIds)
  const intraChildren = buildIntraChildrenMap(memberIds, memberSet, parents)
  const intraRoots = findIntraRoots(memberIds, memberSet, parents)

  if (rootIsExternalEmitter && intraRoots.length === 1) {
    const rootId = intraRoots[0]
    if (rootId !== undefined) {
      return layoutEmitterWithSideChain(rootId, intraChildren, sizeById, spacing, portsBySideById)
    }
  }

  return layoutMultiRootRow(intraRoots, intraChildren, sizeById, spacing, portsBySideById)
}

/** Trivial layout for a single-node block. */
export function layoutSingleMember(
  id: string | undefined,
  sizeById: Map<string, Size>,
): InternalLayout {
  if (id === undefined) return { positions: new Map(), width: 0, height: 0 }
  const sz = sizeById.get(id) ?? DEFAULT_NODE_SIZE
  const positions = new Map<string, Position>()
  positions.set(id, { x: sz.width / 2, y: sz.height / 2 })
  return { positions, width: sz.width, height: sz.height }
}

/**
 * Width past which a multi-root block stops growing as one row
 * and wraps into a grid. Sized so a typical fan-out (a switch
 * with ~12 downstream peers, ≈ 12 × 250px) still reads as one
 * left-to-right row, but a subgraph holding dozens of unlinked
 * members (the common shape of an auto-discovered "uncategorised"
 * group) wraps into a compact block instead of a multi-thousand-
 * px strip that drags the whole canvas sideways.
 */
const MULTI_ROOT_WRAP_MIN_WIDTH = 3000

/**
 * Target aspect (width ÷ height) for the wrapped grid. Slightly
 * wider than square to suit landscape viewports.
 */
const MULTI_ROOT_WRAP_ASPECT = 1.6

/**
 * Default block layout: each intra-root sits at the top of its
 * own subtree column. Columns sit side-by-side in a single row
 * while the row stays within {@link MULTI_ROOT_WRAP_MIN_WIDTH};
 * past that the columns wrap into a roughly-square grid so a
 * subgraph full of unlinked members renders as a compact block
 * rather than one runaway-wide strip. The wrap is purely
 * geometric — every member keeps its own subtree layout, only
 * the column-to-column placement changes.
 */
function layoutMultiRootRow(
  intraRoots: readonly string[],
  intraChildren: Map<string, string[]>,
  sizeById: Map<string, Size>,
  spacing: Spacing,
  portsBySideById?: PortsBySideMap,
): InternalLayout {
  // Lay out each intra-root's subtree once; reused by both the
  // single-row and the wrapped-grid placement below.
  const columns = intraRoots.map((root) => ({
    root,
    layout: layoutWrappedSubtree(root, intraChildren, sizeById, spacing, portsBySideById),
  }))

  // Gap between consecutive columns. Uses port info if available;
  // otherwise falls back to the legacy `internalRootGap`
  // (one-label-could-face-the-other assumption).
  const gapBefore = (idx: number): number => {
    const prev = columns[idx - 1]
    const curr = columns[idx]
    if (!prev || !curr) return 0
    return rootToChainHorizontalGap(prev.root, curr.root, spacing, portsBySideById)
  }

  // Width the columns would occupy as a single row — also the
  // legacy output when it stays within budget.
  let singleRowWidth = 0
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i]
    if (!c) continue
    singleRowWidth += (i > 0 ? gapBefore(i) : 0) + c.layout.width
  }

  const positions = new Map<string, Position>()

  if (singleRowWidth <= MULTI_ROOT_WRAP_MIN_WIDTH) {
    // ── Single row (output identical to the pre-wrap engine) ──
    let cursorX = 0
    let totalHeight = 0
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i]
      if (!c) continue
      cursorX += i > 0 ? gapBefore(i) : 0
      for (const [id, pos] of c.layout.positions) {
        positions.set(id, { x: pos.x + cursorX, y: pos.y })
      }
      cursorX += c.layout.width
      if (c.layout.height > totalHeight) totalHeight = c.layout.height
    }
    return { positions, width: Math.max(0, cursorX), height: totalHeight }
  }

  // ── Wrapped grid (shelf packing) ──
  // Target a roughly-square block so the subgraph hull stays
  // compact. `targetWidth` only bounds where a row wraps; rows
  // may be jagged because subtree heights vary.
  const totalArea = columns.reduce((sum, c) => sum + c.layout.width * c.layout.height, 0)
  const targetWidth = Math.max(
    MULTI_ROOT_WRAP_MIN_WIDTH,
    Math.sqrt(totalArea * MULTI_ROOT_WRAP_ASPECT),
  )
  const rowGap = spacing.internalLayerGap
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0
  let maxWidth = 0
  let isRowStart = true
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i]
    if (!c) continue
    const gap = isRowStart ? 0 : gapBefore(i)
    // Wrap before placing when this column would overflow the row.
    if (!isRowStart && cursorX + gap + c.layout.width > targetWidth) {
      cursorY += rowHeight + rowGap
      cursorX = 0
      rowHeight = 0
      isRowStart = true
    }
    const x = cursorX + (isRowStart ? 0 : gapBefore(i))
    for (const [id, pos] of c.layout.positions) {
      positions.set(id, { x: pos.x + x, y: pos.y + cursorY })
    }
    cursorX = x + c.layout.width
    if (cursorX > maxWidth) maxWidth = cursorX
    if (c.layout.height > rowHeight) rowHeight = c.layout.height
    isRowStart = false
  }
  return { positions, width: maxWidth, height: cursorY + rowHeight }
}

/**
 * Place a subtree rooted at `rootId`: root at the top, direct
 * children in a single row beneath, deeper descendants
 * recursively. No row wrapping — subgraph hulls grow horizontally
 * with fan-out, matching how a network engineer reads "this
 * switch has N APs" left-to-right.
 */
export function layoutWrappedSubtree(
  rootId: string,
  childrenOf: Map<string, string[]>,
  sizeById: Map<string, Size>,
  spacing: Spacing = deriveSpacing(),
  portsBySideById?: PortsBySideMap,
): InternalLayout {
  const positions = new Map<string, Position>()
  const rootSize = sizeById.get(rootId) ?? DEFAULT_NODE_SIZE

  const kids = childrenOf.get(rootId) ?? []
  const childLayouts = kids.map((c) => ({
    id: c,
    layout: layoutWrappedSubtree(c, childrenOf, sizeById, spacing, portsBySideById),
  }))

  if (childLayouts.length === 0) {
    positions.set(rootId, { x: rootSize.width / 2, y: rootSize.height / 2 })
    return { positions, width: rootSize.width, height: rootSize.height }
  }

  // Pairwise sibling gaps. Uses port info when available;
  // falls back to legacy `internalNodeGap` per pair.
  const siblingGaps: number[] = []
  for (let i = 1; i < childLayouts.length; i++) {
    const prev = childLayouts[i - 1]
    const curr = childLayouts[i]
    if (!prev || !curr) {
      siblingGaps.push(spacing.internalNodeGap)
      continue
    }
    siblingGaps.push(horizontalSiblingGap(prev.id, curr.id, spacing, portsBySideById))
  }
  const bandWidth = childLayouts.reduce(
    (sum, c, idx) => sum + c.layout.width + (idx > 0 ? (siblingGaps[idx - 1] ?? 0) : 0),
    0,
  )
  const rowHeight = childLayouts.reduce((m, c) => Math.max(m, c.layout.height), 0)
  const subtreeWidth = Math.max(rootSize.width, bandWidth)
  positions.set(rootId, { x: subtreeWidth / 2, y: rootSize.height / 2 })

  // Vertical gap from root.bottom to the row of children. We
  // use the worst-case child (any child with a top-port forces
  // the full reach) so the layer height respects every
  // descendant's port labels. Falls back to
  // `spacing.internalLayerGap` when no port info is supplied.
  const layerGap = (() => {
    // If port info is absent we want the legacy constant
    // exactly, not the gapBetween(true, true) value (which
    // matches by construction but explicit is clearer).
    if (!portsBySideById) return spacing.internalLayerGap
    // Compute the worst child top-side reach.
    let worstChildGap = 0
    for (const c of childLayouts) {
      worstChildGap = Math.max(
        worstChildGap,
        verticalLayerGap(rootId, c.id, spacing, portsBySideById),
      )
    }
    return worstChildGap
  })()
  const cursorY = rootSize.height + layerGap
  let cursorX = (subtreeWidth - bandWidth) / 2
  for (let idx = 0; idx < childLayouts.length; idx++) {
    const c = childLayouts[idx]
    if (!c) continue
    for (const [id, pos] of c.layout.positions) {
      positions.set(id, { x: pos.x + cursorX, y: pos.y + cursorY })
    }
    cursorX += c.layout.width + (siblingGaps[idx] ?? 0)
  }

  return { positions, width: subtreeWidth, height: cursorY + rowHeight }
}

/**
 * Emitter-on-top, chain-on-side layout. The root sits at top
 * centre; in-block descendants form a vertical column hanging
 * off the right side of the root; the block is padded
 * symmetrically on the left so the root sits at the block's
 * horizontal centre.
 *
 * The padded-left "gutter" stays empty — the outer tidy-tree
 * places any downstream child block directly below the root,
 * so the transit wire runs straight down through this gutter
 * without crossing any chain member.
 */
export function layoutEmitterWithSideChain(
  rootId: string,
  intraChildren: Map<string, string[]>,
  sizeById: Map<string, Size>,
  spacing: Spacing = deriveSpacing(),
  portsBySideById?: PortsBySideMap,
): InternalLayout {
  const rootSize = sizeById.get(rootId) ?? DEFAULT_NODE_SIZE
  const chain = walkFirstChildChain(rootId, intraChildren)

  // No chain → degenerate to a single-member block. Otherwise
  // the empty chain column would inflate the block width with
  // a gutter for a chain that isn't there.
  if (chain.length === 0) return layoutSingleMember(rootId, sizeById)

  const positions = new Map<string, Position>()
  const rootLocalX = rootSize.width / 2
  positions.set(rootId, { x: rootLocalX, y: rootSize.height / 2 })

  // Horizontal root-to-chain gap from the actual ports on
  // root.right and the chain head's left side. For network
  // topologies these are usually BOTH empty (root has bottom
  // ports for chain edge, chain head has top ports), so the
  // gap shrinks to just one `labelClearance`. Falls back to
  // legacy `internalRootGap` when no port info is supplied.
  const chainHead = chain[0]
  const horizGap = chainHead
    ? rootToChainHorizontalGap(rootId, chainHead, spacing, portsBySideById)
    : spacing.internalRootGap

  // Chain column anchored at the right edge of the root. Each
  // vertical layer gap sized from the bottom-↔-top facing
  // ports of the two members it sits between.
  const chainColumnLeft = rootSize.width + horizGap
  let chainMaxRight = chainColumnLeft
  let cursorY = rootSize.height
  let prevId: string = rootId
  for (const m of chain) {
    const ms = sizeById.get(m) ?? DEFAULT_NODE_SIZE
    cursorY += verticalLayerGap(prevId, m, spacing, portsBySideById)
    positions.set(m, { x: chainColumnLeft + ms.width / 2, y: cursorY + ms.height / 2 })
    cursorY += ms.height
    chainMaxRight = Math.max(chainMaxRight, chainColumnLeft + ms.width)
    prevId = m
  }

  // Pad left so the root sits at the block's horizontal centre.
  const rightExtent = chainMaxRight - rootLocalX
  const halfWidth = Math.max(rightExtent, rootLocalX)
  const blockWidth = halfWidth * 2
  const shiftX = halfWidth - rootLocalX
  if (shiftX > 0) {
    for (const [id, pos] of positions) {
      positions.set(id, { x: pos.x + shiftX, y: pos.y })
    }
  }
  const blockHeight = Math.max(rootSize.height, cursorY)
  return { positions, width: blockWidth, height: blockHeight }
}

/**
 * Walk the in-block first-child chain rooted at `rootId`. Each
 * step picks the first entry of the intra-children list. For a
 * pure chain (one child per member) this yields the full chain;
 * for branching subtrees the engine doesn't reach this code
 * path because such blocks aren't external-emitter blocks (see
 * {@link ../blocks.ts | findExternalEmitterBlocks}).
 */
function walkFirstChildChain(rootId: string, intraChildren: Map<string, string[]>): string[] {
  const chain: string[] = []
  let cur: string | undefined = (intraChildren.get(rootId) ?? [])[0]
  while (cur !== undefined) {
    chain.push(cur)
    cur = (intraChildren.get(cur) ?? [])[0]
  }
  return chain
}

/**
 * Build a map from each in-block parent to its in-block
 * children only. Cross-block edges are dropped — the outer
 * tidy-tree handles those.
 */
function buildIntraChildrenMap(
  memberIds: readonly string[],
  memberSet: ReadonlySet<string>,
  parents: Map<string, string>,
): Map<string, string[]> {
  const intra = new Map<string, string[]>()
  for (const id of memberIds) intra.set(id, [])
  for (const id of memberIds) {
    const p = parents.get(id)
    if (p && memberSet.has(p)) intra.get(p)?.push(id)
  }
  return intra
}

/**
 * Members whose tree-parent is outside the block (or absent).
 * These are the block's structural "entry points" from the
 * outer tree's perspective.
 */
function findIntraRoots(
  memberIds: readonly string[],
  memberSet: ReadonlySet<string>,
  parents: Map<string, string>,
): string[] {
  const out: string[] = []
  for (const id of memberIds) {
    const p = parents.get(id)
    if (!p || !memberSet.has(p)) out.push(id)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}
