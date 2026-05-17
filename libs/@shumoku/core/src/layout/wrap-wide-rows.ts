// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Logical-parent re-grouping + multi-row wrap for leaf subgraphs.
 *
 * The compound layout flattens every same-depth subgraph into one
 * horizontal row regardless of which uplink it actually serves. For a
 * network diagram with two distribution switches that each feed 5-7
 * area subgraphs, that produces a "10+ wide" single row even though
 * half hang off one uplink and half off another. This pass moves
 * each subgraph below the node that actually uplinks to it.
 *
 * Pass shape:
 *   1. Identify **leaf subgraphs** — subgraphs that do not contain
 *      other subgraphs. Container subgraphs (anything wrapping a
 *      nested subgraph) are left strictly alone; touching them
 *      would invalidate the compound nesting that the original
 *      tidy-tree pass already settled on.
 *   2. For each leaf subgraph, find its **logical parent** — a node
 *      outside the subgraph that connects to one of its internal
 *      nodes via a link. The logical parent is required to live
 *      outside the leaf subgraph's own enclosing container, so
 *      moving the leaf doesn't conflict with the container's
 *      bounds.
 *   3. Group leaf subgraphs by logical parent.
 *   4. Sort parents top-to-bottom by their y position. Each group
 *      is placed directly below the parent (or below the previous
 *      group's floor — whichever is lower), so groups whose parents
 *      share an x column don't overlap.
 *   5. Inside a group, if the children exceed `maxPerRow`, fold
 *      into multiple sub-rows centred under the parent's x.
 *   6. Cascade the (dx, dy) shift through every parented node,
 *      port, and (rare) nested subgraph beneath each leaf.
 */

import type { Bounds, Link, Node, Subgraph } from '../models/types.js'
import type { ResolvedPort } from './resolved-types.js'

export interface WrapWideRowsOptions {
  /** Hard cap on sub-row count — overrides the width heuristic.
   *  Default 8. Most real network deployments don't have more than
   *  this many access subgraphs hanging off one distribution
   *  switch; beyond it the wrap kicks in regardless of width. */
  maxPerRow?: number
  /** Sub-row width budget. A group whose total laid-out width
   *  (subgraphs + gaps) stays under this number renders as a
   *  single row; over it the group folds into multiple sub-rows.
   *  Default 4000 — wide enough to keep typical 5-6-subgraph
   *  distributions on one row, narrow enough to fold the
   *  pathological 12+ case. */
  maxRowWidth?: number
  /** Vertical gap between sub-rows of one group. Default 200. */
  rowGap?: number
  /** Horizontal gap between subgraphs within a sub-row. Default 60. */
  intraRowGap?: number
  /** Y drop below the parent (or previous group floor) before this group's first sub-row. Default 240. */
  groupYDrop?: number
}

interface LayoutContext {
  nodes: Map<string, Node>
  ports: Map<string, ResolvedPort>
  subgraphs: Map<string, Subgraph>
  links: readonly Link[]
}

export function wrapWideRows(
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  subgraphs: Map<string, Subgraph>,
  links: readonly Link[],
  bounds: Bounds,
  options: WrapWideRowsOptions = {},
): Bounds {
  const maxPerRow = options.maxPerRow ?? 8
  const maxRowWidth = options.maxRowWidth ?? 4000
  const rowGap = options.rowGap ?? 200
  const intraRowGap = options.intraRowGap ?? 60
  const groupYDrop = options.groupYDrop ?? 240

  const ctx: LayoutContext = { nodes, ports, subgraphs, links }

  // Leaf subgraphs only. Anything that contains another subgraph
  // is a structural container (e.g. the "NEW GROUP" + "NOC" pair
  // in the user's screenshot wrapping the core gear) and must stay
  // where the tidy-tree placed it — moving the container would
  // also have to move its internal sub-layout, and we already gave
  // up on that path because it broke compound nesting.
  const isLeafSubgraph = new Set<string>(subgraphs.keys())
  for (const sg of subgraphs.values()) {
    if (sg.parent && isLeafSubgraph.has(sg.parent)) {
      isLeafSubgraph.delete(sg.parent)
    }
  }

  const logicalParentOf = buildLogicalParentMap(ctx, isLeafSubgraph)

  // Bucket leaf subgraphs by logical parent. Subgraphs without an
  // outside uplink (root-level isolated areas etc.) are skipped.
  const groups = new Map<string, string[]>()
  for (const [sgId, parentNodeId] of logicalParentOf) {
    const list = groups.get(parentNodeId)
    if (list) list.push(sgId)
    else groups.set(parentNodeId, [sgId])
  }

  // Sort logical parents top-to-bottom by y. Each group is then
  // placed strictly below earlier groups' floors so parents that
  // share an x column don't crash into each other.
  const sortedParents = [...groups.keys()]
    .filter((id) => nodes.get(id)?.position)
    .sort((a, b) => (nodes.get(a)?.position?.y ?? 0) - (nodes.get(b)?.position?.y ?? 0))

  let floorY = -Infinity

  for (const parentNodeId of sortedParents) {
    const sgIds = groups.get(parentNodeId)
    if (!sgIds || sgIds.length === 0) continue
    const parentNode = nodes.get(parentNodeId)
    if (!parentNode?.position) continue

    const ordered = [...sgIds]
      .filter((id) => subgraphs.get(id)?.bounds)
      .sort((a, b) => {
        const ax = subgraphs.get(a)?.bounds?.x ?? 0
        const bx = subgraphs.get(b)?.bounds?.x ?? 0
        return ax - bx
      })
    if (ordered.length === 0) continue

    const anchorX = parentNode.position.x
    const startY = Math.max(parentNode.position.y + groupYDrop, floorY + groupYDrop)

    // Decide chunk count from total width *and* hard count cap.
    // Width-based keeps small fan-outs on a single row even when
    // the count is mildly higher than the legacy maxPerRow=5;
    // count-based caps the pathological "30 subgraphs at one
    // tier" case so we don't try to draw a 12000px row.
    const totalWidth = ordered.reduce((acc, id, idx) => {
      const w = subgraphs.get(id)?.bounds?.width ?? 0
      return acc + w + (idx < ordered.length - 1 ? intraRowGap : 0)
    }, 0)
    const widthChunks = Math.max(1, Math.ceil(totalWidth / maxRowWidth))
    const countChunks = Math.max(1, Math.ceil(ordered.length / maxPerRow))
    const chunkCount = Math.max(widthChunks, countChunks)
    const chunkSize = Math.ceil(ordered.length / chunkCount)

    let lastChunkBottom = startY
    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
      const start = chunkIdx * chunkSize
      const end = Math.min(start + chunkSize, ordered.length)
      if (start >= end) break

      let chunkWidth = 0
      for (let i = start; i < end; i++) {
        chunkWidth += subgraphs.get(ordered[i] ?? '')?.bounds?.width ?? 0
        if (i < end - 1) chunkWidth += intraRowGap
      }
      const chunkStartX = anchorX - chunkWidth / 2
      const chunkTopY = chunkIdx === 0 ? startY : lastChunkBottom + rowGap
      let maxChunkBottom = chunkTopY

      let cursorX = chunkStartX
      for (let i = start; i < end; i++) {
        const id = ordered[i]
        if (!id) continue
        const sg = subgraphs.get(id)
        if (!sg?.bounds) continue
        const dx = cursorX - sg.bounds.x
        const dy = chunkTopY - sg.bounds.y
        if (dx !== 0 || dy !== 0) {
          shiftSubgraphSubtree(id, dx, dy, ctx)
        }
        cursorX += sg.bounds.width + intraRowGap
        maxChunkBottom = Math.max(maxChunkBottom, chunkTopY + sg.bounds.height)
      }
      lastChunkBottom = maxChunkBottom
    }
    floorY = Math.max(floorY, lastChunkBottom)
  }

  // Recompute bounds covering the final layout.
  let maxY = bounds.y + bounds.height
  let minY = bounds.y
  let maxX = bounds.x + bounds.width
  let minX = bounds.x
  for (const node of nodes.values()) {
    if (!node.position) continue
    const half = node.size ? { w: node.size.width / 2, h: node.size.height / 2 } : { w: 60, h: 30 }
    minX = Math.min(minX, node.position.x - half.w)
    maxX = Math.max(maxX, node.position.x + half.w)
    minY = Math.min(minY, node.position.y - half.h)
    maxY = Math.max(maxY, node.position.y + half.h)
  }
  for (const sg of subgraphs.values()) {
    if (!sg.bounds) continue
    minX = Math.min(minX, sg.bounds.x)
    maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
    minY = Math.min(minY, sg.bounds.y)
    maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
  }
  const pad = 50
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

/**
 * For each *leaf* subgraph, find a node outside that subgraph (and
 * outside its enclosing compound container, if any) that connects
 * to one of the subgraph's internal nodes via a link.
 *
 * Excluding the enclosing container's other inhabitants is what
 * stops the algorithm from picking, say, the central router as a
 * "parent" for some nested area subgraph just because they share
 * the outer container.
 *
 * Tie-break order: highest cross-link count → highest overall
 * degree → lexicographic id.
 */
function buildLogicalParentMap(
  ctx: LayoutContext,
  isLeafSubgraph: ReadonlySet<string>,
): Map<string, string> {
  const { nodes, subgraphs, links } = ctx
  const subgraphOf = new Map<string, string>()
  for (const [id, node] of nodes) {
    subgraphOf.set(id, node.parent ?? '')
  }

  const degree = new Map<string, number>()
  for (const l of links) {
    degree.set(l.from.node, (degree.get(l.from.node) ?? 0) + 1)
    degree.set(l.to.node, (degree.get(l.to.node) ?? 0) + 1)
  }

  const result = new Map<string, string>()
  for (const sg of subgraphs.values()) {
    if (!isLeafSubgraph.has(sg.id)) continue

    const insiders = new Set<string>()
    for (const [nodeId, parent] of subgraphOf) {
      if (parent === sg.id) insiders.add(nodeId)
    }
    if (insiders.size === 0) continue

    const enclosingId = sg.parent ?? ''

    const candidates = new Map<string, number>()
    for (const l of links) {
      const fromIn = insiders.has(l.from.node)
      const toIn = insiders.has(l.to.node)
      if (fromIn === toIn) continue
      const outside = fromIn ? l.to.node : l.from.node
      if (insiders.has(outside)) continue
      // Skip candidates that live inside our own enclosing
      // container — moving the leaf inside its own enclosing
      // container would collide with the container's bounds.
      // Candidates living in *other* subgraphs are fine; moving
      // the leaf below them places it outside that subgraph, not
      // inside it.
      const outsideParent = subgraphOf.get(outside) ?? ''
      if (enclosingId && outsideParent === enclosingId) continue
      candidates.set(outside, (candidates.get(outside) ?? 0) + 1)
    }
    // Only re-arrange subgraphs with an unambiguous logical
    // parent. A subgraph that uplinks to multiple distinct
    // outside peers (e.g. NOC connecting to both ONU and the
    // distribution switch; the central NEW GROUP connecting to
    // every area below) is structurally a hub — moving it
    // anywhere would just relocate the mess. Leaf area subgraphs
    // have exactly one outside peer (their uplink target).
    if (candidates.size !== 1) continue

    let best: { id: string; count: number; deg: number } | null = null
    for (const [id, count] of candidates) {
      const deg = degree.get(id) ?? 0
      if (
        !best ||
        count > best.count ||
        (count === best.count && deg > best.deg) ||
        (count === best.count && deg === best.deg && id < best.id)
      ) {
        best = { id, count, deg }
      }
    }
    if (best) result.set(sg.id, best.id)
  }
  return result
}

function shiftSubgraphSubtree(
  subgraphId: string,
  dx: number,
  dy: number,
  ctx: LayoutContext,
): void {
  const { nodes, ports, subgraphs } = ctx
  const sg = subgraphs.get(subgraphId)
  if (!sg?.bounds) return
  subgraphs.set(subgraphId, {
    ...sg,
    bounds: { ...sg.bounds, x: sg.bounds.x + dx, y: sg.bounds.y + dy },
  })

  for (const [nodeId, node] of nodes) {
    if (node.parent !== subgraphId) continue
    if (node.position) {
      nodes.set(nodeId, {
        ...node,
        position: { x: node.position.x + dx, y: node.position.y + dy },
      })
    }
  }
  for (const [portId, port] of ports) {
    const colon = portId.indexOf(':')
    if (colon < 0) continue
    const nodeId = portId.slice(0, colon)
    if (nodes.get(nodeId)?.parent !== subgraphId) continue
    ports.set(portId, {
      ...port,
      absolutePosition: {
        x: port.absolutePosition.x + dx,
        y: port.absolutePosition.y + dy,
      },
    })
  }
  for (const [innerId, innerSg] of subgraphs) {
    if (innerSg.parent === subgraphId) {
      shiftSubgraphSubtree(innerId, dx, dy, ctx)
    }
  }
}
