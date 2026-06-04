// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Subgraph-aware re-packing for group-dominated graphs.
 *
 * The outer tidy-tree lays the block forest out as a single row
 * (every disconnected root becomes a child of one virtual root).
 * For a hand-authored, link-rich topology that's fine — the
 * forest is small and the row reads naturally. But an
 * auto-discovered graph is typically **link-poor and
 * group-heavy**: hundreds of unlinked nodes spread into one
 * multi-thousand-px row, and because subgraph hulls are a
 * post-process bbox over wherever members landed (see
 * {@link ./hulls.ts}), members of one subgraph end up interleaved
 * with another's, so every hull stretches across the canvas and
 * they all overlap.
 *
 * This pass runs *after* the tidy-tree + spine alignment and
 * *before* hull computation. It:
 *
 *   1. groups the laid-out blocks into connected components,
 *      **split at subgraph boundaries** so every component
 *      belongs to exactly one subgraph (each keeps its internal
 *      tidy-tree layout),
 *   2. classifies components by link participation: the **linked
 *      backbone** holds the dependency/tier order the tidy-tree
 *      encoded as vertical position, so it is frozen in place;
 *      only the **unlinked remainder** is moved,
 *   3. shelf-packs that remainder into a compact, roughly-square
 *      grid **per subgraph** and drops it as a band directly below
 *      the backbone, so the unlinked bulk stops stretching the
 *      canvas and bloating the hulls without disturbing the
 *      topology.
 *
 * When the graph has *no* linked backbone (a pure link-poor
 * auto-discovery dump) every component is "remainder" and the whole
 * thing is compacted — the original behaviour.
 *
 * It only engages when the natural layout is pathologically wide
 * (aspect over {@link RepackOptions.maxAspect}) and there's more
 * than one component to move — a single connected tree, however
 * wide, is left untouched.
 */

import type { NetworkGraph, Node } from '../../../models/types.js'
import type { Spacing } from './spacing.js'
import type { BlockChildren, BlockMembers, InternalLayout, Position, Size } from './types.js'

export interface RepackOptions {
  /** Engage only when the laid-out width ÷ height exceeds this. */
  maxAspect?: number
  /** A subgraph cluster never wraps below this width. */
  minWrapWidth?: number
  /** Target width ÷ height for each packed cluster. */
  targetAspect?: number
}

const DEFAULT_MAX_ASPECT = 2
const DEFAULT_MIN_WRAP_WIDTH = 600
const DEFAULT_TARGET_ASPECT = 1.6

interface Component {
  blocks: string[]
  /** Tight bbox of member-node extents, in current coords. */
  min: Position
  max: Position
  /** Subgraph the component is packed under (undefined = top-level). */
  sg: string | undefined
  /** Deterministic ordering key (smallest block id). */
  key: string
}

interface PackedBox {
  width: number
  height: number
  /** Place the box's top-left at (ox, oy), writing block translations. */
  place: (ox: number, oy: number) => void
  empty: boolean
}

interface ShelfItem {
  width: number
  height: number
  key: string
  place: (ox: number, oy: number) => void
}

/**
 * Re-pack the block layout by subgraph. Mutates `blockPositions`
 * in place. Returns true when it actually re-packed (so callers
 * know positions changed), false when the layout was left as-is.
 */
export function repackBySubgraph(
  blockPositions: Map<string, Position>,
  internal: Map<string, InternalLayout>,
  blockMembers: BlockMembers,
  blockChildren: BlockChildren,
  nodesById: Map<string, Node>,
  graph: NetworkGraph,
  spacing: Spacing,
  options: RepackOptions = {},
): boolean {
  const maxAspect = options.maxAspect ?? DEFAULT_MAX_ASPECT
  const minWrapWidth = options.minWrapWidth ?? DEFAULT_MIN_WRAP_WIDTH
  const targetAspect = options.targetAspect ?? DEFAULT_TARGET_ASPECT
  const gap = spacing.outerNodeGap
  const pad = spacing.subgraphPadding
  const label = spacing.subgraphLabelHeight

  const blockSize = (b: string): Size => {
    const layout = internal.get(b)
    return { width: layout?.width ?? 0, height: layout?.height ?? 0 }
  }

  // 1. Connected components of the block forest.
  const components = findComponents(
    blockPositions,
    blockMembers,
    blockChildren,
    blockSize,
    nodesById,
  )
  if (components.length <= 1) return false

  // Classify components by link participation. The *linked
  // backbone* carries the dependency/tier structure the tidy-tree
  // already encoded as vertical order — shuffling it would scatter
  // the cores across the canvas. So we freeze the backbone where it
  // is and only sweep the *unlinked remainder* (degree-0 nodes,
  // typically the bulk of an auto-discovered graph) into a band.
  const degree = new Map<string, number>()
  for (const l of graph.links) {
    degree.set(l.from.node, (degree.get(l.from.node) ?? 0) + 1)
    degree.set(l.to.node, (degree.get(l.to.node) ?? 0) + 1)
  }
  const isPeripheral = (c: Component): boolean => {
    for (const b of c.blocks) {
      for (const m of blockMembers.get(b) ?? []) {
        if ((degree.get(m) ?? 0) > 0) return false
      }
    }
    return true
  }
  const backbone: Component[] = []
  const peripheral: Component[] = []
  for (const c of components) (isPeripheral(c) ? peripheral : backbone).push(c)

  const bboxOf = (cs: Component[]) => {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const c of cs) {
      minX = Math.min(minX, c.min.x)
      minY = Math.min(minY, c.min.y)
      maxX = Math.max(maxX, c.max.x)
      maxY = Math.max(maxY, c.max.y)
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
  }

  // 2. Gate: only engage on a pathologically wide layout.
  const all = bboxOf(components)
  if (!(all.width > 0 && all.height > 0)) return false
  if (all.width / all.height <= maxAspect) return false

  // 3. Choose the packing set and its origin.
  //    - No backbone (pure link-poor graph): compact everything,
  //      anchored at the original top-left — the legacy behaviour.
  //    - Backbone present: leave it untouched (tier order intact)
  //      and pack only the peripheral nodes into a band directly
  //      beneath it.
  let packList: Component[]
  let originX: number
  let originY: number
  if (backbone.length === 0) {
    packList = components
    originX = all.minX
    originY = all.minY
  } else {
    if (peripheral.length === 0) return false
    const back = bboxOf(backbone)
    packList = peripheral
    originX = back.minX
    originY = back.maxY + gap
  }

  // 4. Index the packing set by subgraph + build the subgraph tree.
  const componentsBySg = new Map<string | undefined, Component[]>()
  for (const c of packList) {
    const list = componentsBySg.get(c.sg) ?? []
    list.push(c)
    componentsBySg.set(c.sg, list)
  }
  for (const list of componentsBySg.values()) list.sort((a, b) => a.key.localeCompare(b.key))

  const childSubgraphs = new Map<string | undefined, string[]>()
  const sgIds = new Set<string>()
  for (const s of graph.subgraphs ?? []) sgIds.add(s.id)
  for (const s of graph.subgraphs ?? []) {
    const parent = s.parent && sgIds.has(s.parent) ? s.parent : undefined
    const list = childSubgraphs.get(parent) ?? []
    list.push(s.id)
    childSubgraphs.set(parent, list)
  }
  for (const list of childSubgraphs.values()) list.sort((a, b) => a.localeCompare(b))

  // 5. Recursively pack each subgraph container.
  const packContainer = (sgId: string | undefined): PackedBox => {
    const items: ShelfItem[] = []

    for (const childSg of childSubgraphs.get(sgId) ?? []) {
      const box = packContainer(childSg)
      if (box.empty) continue
      items.push({ width: box.width, height: box.height, key: `sg:${childSg}`, place: box.place })
    }

    for (const comp of componentsBySg.get(sgId) ?? []) {
      const w = comp.max.x - comp.min.x
      const h = comp.max.y - comp.min.y
      items.push({
        width: w,
        height: h,
        key: `c:${comp.key}`,
        place: (ox, oy) => translateComponent(comp, ox, oy, blockPositions),
      })
    }

    if (items.length === 0) {
      return { width: 0, height: 0, place: () => {}, empty: true }
    }

    const content = shelfPack(items, gap, minWrapWidth, targetAspect)

    // Top-level container adds no padding/label band; a real
    // subgraph reserves its hull padding so sibling hulls — which
    // hulls.ts recomputes as content + padding — never touch.
    if (sgId === undefined) {
      return {
        width: content.width,
        height: content.height,
        empty: false,
        place: (ox, oy) => content.place(ox, oy),
      }
    }
    return {
      width: content.width + pad * 2,
      height: content.height + pad * 2 + label,
      empty: false,
      place: (ox, oy) => content.place(ox + pad, oy + pad + label),
    }
  }

  packContainer(undefined).place(originX, originY)
  return true
}

/** Translate every block of a component so its bbox min lands at (ox, oy). */
function translateComponent(
  comp: Component,
  ox: number,
  oy: number,
  blockPositions: Map<string, Position>,
): void {
  const dx = ox - comp.min.x
  const dy = oy - comp.min.y
  if (dx === 0 && dy === 0) return
  for (const b of comp.blocks) {
    const pos = blockPositions.get(b)
    if (!pos) continue
    blockPositions.set(b, { x: pos.x + dx, y: pos.y + dy })
  }
}

/**
 * Shelf-pack items into rows targeting a roughly-square area.
 * Items are placed tallest-first so each shelf is reasonably
 * tight. Returns the content size and a `place` that positions
 * every item relative to a caller-supplied origin.
 */
function shelfPack(
  items: ShelfItem[],
  gap: number,
  minWrapWidth: number,
  targetAspect: number,
): { width: number; height: number; place: (ox: number, oy: number) => void } {
  const totalArea = items.reduce((sum, it) => sum + it.width * it.height, 0)
  const targetWidth = Math.max(minWrapWidth, Math.sqrt(totalArea * targetAspect))

  const sorted = [...items].sort((a, b) => b.height - a.height || a.key.localeCompare(b.key))

  const slots: Array<{ item: ShelfItem; x: number; y: number }> = []
  let x = 0
  let y = 0
  let rowHeight = 0
  let maxWidth = 0
  let rowStart = true
  for (const item of sorted) {
    if (!rowStart && x + gap + item.width > targetWidth) {
      y += rowHeight + gap
      x = 0
      rowHeight = 0
      rowStart = true
    }
    const ix = rowStart ? x : x + gap
    slots.push({ item, x: ix, y })
    x = ix + item.width
    if (x > maxWidth) maxWidth = x
    if (item.height > rowHeight) rowHeight = item.height
    rowStart = false
  }

  return {
    width: maxWidth,
    height: y + rowHeight,
    place: (ox, oy) => {
      for (const slot of slots) slot.item.place(ox + slot.x, oy + slot.y)
    },
  }
}

/**
 * Partition blocks into connected components over the block tree,
 * **split at subgraph boundaries** — an edge between two blocks in
 * different subgraphs is not traversed. Every component therefore
 * belongs to exactly one subgraph, so packing it into that
 * subgraph's region keeps the subgraph's members contiguous and
 * its recomputed hull never spills into a sibling's. A
 * cross-subgraph link just becomes a longer edge between regions.
 */
function findComponents(
  blockPositions: Map<string, Position>,
  blockMembers: BlockMembers,
  blockChildren: BlockChildren,
  blockSize: (b: string) => Size,
  nodesById: Map<string, Node>,
): Component[] {
  // Each block's subgraph (members of a block always share one).
  const sgOfBlock = (b: string): string | undefined => {
    const first = blockMembers.get(b)?.[0]
    return first ? nodesById.get(first)?.parent : undefined
  }

  // Undirected adjacency from the parent→children block tree,
  // restricted to same-subgraph edges.
  const adj = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    const la = adj.get(a) ?? []
    la.push(b)
    adj.set(a, la)
  }
  for (const [parent, kids] of blockChildren) {
    for (const child of kids) {
      if (sgOfBlock(parent) !== sgOfBlock(child)) continue
      link(parent, child)
      link(child, parent)
    }
  }

  const seen = new Set<string>()
  const components: Component[] = []
  for (const start of blockMembers.keys()) {
    if (seen.has(start)) continue
    const sg = sgOfBlock(start)
    // BFS the same-subgraph component.
    const blocks: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length > 0) {
      const b = queue.shift()
      if (b === undefined) continue
      blocks.push(b)
      for (const n of adj.get(b) ?? []) {
        if (seen.has(n)) continue
        seen.add(n)
        queue.push(n)
      }
    }

    // Member-node bbox.
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let key = blocks[0] ?? start
    for (const b of blocks) {
      if (b.localeCompare(key) < 0) key = b
      const pos = blockPositions.get(b)
      if (!pos) continue
      const sz = blockSize(b)
      minX = Math.min(minX, pos.x - sz.width / 2)
      minY = Math.min(minY, pos.y - sz.height / 2)
      maxX = Math.max(maxX, pos.x + sz.width / 2)
      maxY = Math.max(maxY, pos.y + sz.height / 2)
    }
    if (!Number.isFinite(minX)) {
      minX = minY = maxX = maxY = 0
    }

    components.push({ blocks, min: { x: minX, y: minY }, max: { x: maxX, y: maxY }, sg, key })
  }
  return components
}
