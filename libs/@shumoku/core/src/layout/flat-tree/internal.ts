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
): InternalLayout {
  if (memberIds.length === 1) return layoutSingleMember(memberIds[0], sizeById)

  const memberSet = new Set(memberIds)
  const intraChildren = buildIntraChildrenMap(memberIds, memberSet, parents)
  const intraRoots = findIntraRoots(memberIds, memberSet, parents)

  if (rootIsExternalEmitter && intraRoots.length === 1) {
    const rootId = intraRoots[0]
    if (rootId !== undefined) {
      return layoutEmitterWithSideChain(rootId, intraChildren, sizeById, spacing)
    }
  }

  return layoutMultiRootRow(intraRoots, intraChildren, sizeById, spacing)
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
 * Default block layout: each intra-root sits at the top of its
 * own subtree column; subtree columns sit side-by-side
 * separated by `INTERNAL_ROOT_GAP`.
 */
function layoutMultiRootRow(
  intraRoots: readonly string[],
  intraChildren: Map<string, string[]>,
  sizeById: Map<string, Size>,
  spacing: Spacing,
): InternalLayout {
  const positions = new Map<string, Position>()
  let cursorX = 0
  let totalHeight = 0
  for (const root of intraRoots) {
    const sub = layoutWrappedSubtree(root, intraChildren, sizeById, spacing)
    for (const [id, pos] of sub.positions) {
      positions.set(id, { x: pos.x + cursorX, y: pos.y })
    }
    cursorX += sub.width + spacing.internalRootGap
    if (sub.height > totalHeight) totalHeight = sub.height
  }
  if (intraRoots.length > 0) cursorX -= spacing.internalRootGap
  return { positions, width: Math.max(0, cursorX), height: totalHeight }
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
): InternalLayout {
  const positions = new Map<string, Position>()
  const rootSize = sizeById.get(rootId) ?? DEFAULT_NODE_SIZE

  const kids = childrenOf.get(rootId) ?? []
  const childLayouts = kids.map((c) => ({
    id: c,
    layout: layoutWrappedSubtree(c, childrenOf, sizeById, spacing),
  }))

  if (childLayouts.length === 0) {
    positions.set(rootId, { x: rootSize.width / 2, y: rootSize.height / 2 })
    return { positions, width: rootSize.width, height: rootSize.height }
  }

  const bandWidth = childLayouts.reduce(
    (sum, c, idx) => sum + c.layout.width + (idx > 0 ? spacing.internalNodeGap : 0),
    0,
  )
  const rowHeight = childLayouts.reduce((m, c) => Math.max(m, c.layout.height), 0)
  const subtreeWidth = Math.max(rootSize.width, bandWidth)
  positions.set(rootId, { x: subtreeWidth / 2, y: rootSize.height / 2 })

  const cursorY = rootSize.height + spacing.internalLayerGap
  let cursorX = (subtreeWidth - bandWidth) / 2
  for (const c of childLayouts) {
    for (const [id, pos] of c.layout.positions) {
      positions.set(id, { x: pos.x + cursorX, y: pos.y + cursorY })
    }
    cursorX += c.layout.width + spacing.internalNodeGap
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

  // Chain column anchored at the right edge of the root.
  let cursorY = rootSize.height + spacing.internalLayerGap
  const chainColumnLeft = rootSize.width + spacing.internalRootGap
  let chainMaxRight = chainColumnLeft
  for (const m of chain) {
    const ms = sizeById.get(m) ?? DEFAULT_NODE_SIZE
    positions.set(m, { x: chainColumnLeft + ms.width / 2, y: cursorY + ms.height / 2 })
    cursorY += ms.height + spacing.internalLayerGap
    chainMaxRight = Math.max(chainMaxRight, chainColumnLeft + ms.width)
  }
  // Drop the trailing layer gap — block height ends at the
  // bottom of the last chain member, not at the next would-be
  // slot.
  if (chain.length > 0) cursorY -= spacing.internalLayerGap

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
