// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Multi-row wrap post-process.
 *
 * Tidy-tree gives every parent's children a single horizontal row,
 * which is correct in the textbook sense but produces visually
 * unreasonable layouts when a single tier carries 10+ subgraphs.
 * The user's reported pain (50N / 11 area subgraphs at one row,
 * canvas widening past 4500px) is exactly this case.
 *
 * This pass detects rows of subgraphs that exceed `maxPerRow`,
 * leaves the first chunk where it sits, and shifts each subsequent
 * chunk down by `rowGap`. The shift cascades through the subgraph's
 * internal contents (nodes, ports, nested subgraph bounds) so the
 * inside of a wrapped subgraph travels with its container.
 *
 * Heuristic: rows are detected by approximate Y bucketing
 * (`yBucket`) rather than strict equality, because the layout
 * sometimes rounds positions slightly differently per subgraph.
 * Subgraphs whose tops land within the bucket are treated as one
 * row, regardless of compound parent — for the screenshot case
 * this correctly groups eps-sw01's 5 area-subgraphs and eps-sw02's
 * 7 into one logical row of 12.
 *
 * The pass returns the updated root bounds so the renderer's
 * viewport / camera fits the new vertical extent.
 */

import type { Bounds, Node, Subgraph } from '../models/types.js'
import type { ResolvedPort } from './resolved-types.js'

export interface WrapWideRowsOptions {
  /** Subgraphs per row above which a wrap kicks in. Default 5. */
  maxPerRow?: number
  /** Vertical gap added between wrapped rows. Default 280. */
  rowGap?: number
  /** Y buckets are this tall — subgraphs whose top.y lands in the
   *  same bucket are considered one row. Default 40. */
  yBucket?: number
  /** Horizontal gap between subgraphs within a wrapped row.
   *  Default 60. */
  intraRowGap?: number
}

/**
 * Detect wide rows of subgraphs in `subgraphs` and wrap the
 * overflow downward. Mutates `nodes`, `ports`, and `subgraphs` in
 * place. Returns the updated bounds covering the new layout.
 */
export function wrapWideRows(
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  subgraphs: Map<string, Subgraph>,
  bounds: Bounds,
  options: WrapWideRowsOptions = {},
): Bounds {
  const maxPerRow = options.maxPerRow ?? 5
  const rowGap = options.rowGap ?? 280
  const yBucket = options.yBucket ?? 40
  const intraRowGap = options.intraRowGap ?? 60

  // Group subgraphs by Y bucket (top of bounds).
  const rows = new Map<number, string[]>()
  for (const [id, sg] of subgraphs) {
    if (!sg.bounds) continue
    const bucket = Math.round(sg.bounds.y / yBucket) * yBucket
    const list = rows.get(bucket)
    if (list) list.push(id)
    else rows.set(bucket, [id])
  }

  for (const [_y, sgIds] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    if (sgIds.length <= maxPerRow) continue

    // Stable sort by x (left to right) for predictable wrap groupings.
    const ordered = [...sgIds].sort((a, b) => {
      const ax = subgraphs.get(a)?.bounds?.x ?? 0
      const bx = subgraphs.get(b)?.bounds?.x ?? 0
      return ax - bx
    })

    // Determine an even chunk size that produces visually balanced
    // rows. Splitting 11 into 4+4+3 reads better than 5+5+1.
    const chunkCount = Math.ceil(ordered.length / maxPerRow)
    const chunkSize = Math.ceil(ordered.length / chunkCount)

    // Original row span and centroid — wrapped chunks will be
    // re-centred on the same x mid-point so the layout stays
    // visually anchored to where the original row was.
    const originalLeft = subgraphs.get(ordered[0] ?? '')?.bounds?.x ?? 0
    const lastSg = subgraphs.get(ordered[ordered.length - 1] ?? '')
    const originalRight = (lastSg?.bounds?.x ?? 0) + (lastSg?.bounds?.width ?? 0)
    const rowCentreX = (originalLeft + originalRight) / 2

    // For each chunk, compute target left edge so the chunk's own
    // width is centred on `rowCentreX`. Then walk the chunk and
    // shift each subgraph from its current x to the target slot.
    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
      const start = chunkIdx * chunkSize
      const end = Math.min(start + chunkSize, ordered.length)
      if (start >= end) break

      let chunkWidth = 0
      for (let i = start; i < end; i++) {
        chunkWidth += subgraphs.get(ordered[i] ?? '')?.bounds?.width ?? 0
        if (i < end - 1) chunkWidth += intraRowGap
      }
      const chunkStartX = rowCentreX - chunkWidth / 2

      let cursorX = chunkStartX
      for (let i = start; i < end; i++) {
        const id = ordered[i]
        if (!id) continue
        const sg = subgraphs.get(id)
        if (!sg?.bounds) continue
        const dx = cursorX - sg.bounds.x
        const dy = chunkIdx * rowGap
        if (dx !== 0 || dy !== 0) {
          shiftSubgraphSubtree(id, dx, dy, nodes, ports, subgraphs)
        }
        cursorX += sg.bounds.width + intraRowGap
      }
    }
  }

  // Bounds may have grown vertically. Recompute height by sweeping
  // every node and subgraph after the shifts.
  let maxY = bounds.y + bounds.height
  for (const node of nodes.values()) {
    if (node.position && node.size) {
      maxY = Math.max(maxY, node.position.y + node.size.height / 2)
    }
  }
  for (const sg of subgraphs.values()) {
    if (sg.bounds) {
      maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
    }
  }
  return { ...bounds, height: maxY - bounds.y + 50 }
}

/**
 * Recursively shift a subgraph, every node parented to it, every
 * resolved port of those nodes, and every nested subgraph beneath
 * it by `dy`. The X coordinate is untouched.
 */
function shiftSubgraphSubtree(
  subgraphId: string,
  dx: number,
  dy: number,
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  subgraphs: Map<string, Subgraph>,
): void {
  const sg = subgraphs.get(subgraphId)
  if (!sg?.bounds) return
  subgraphs.set(subgraphId, {
    ...sg,
    bounds: { ...sg.bounds, x: sg.bounds.x + dx, y: sg.bounds.y + dy },
  })

  // Shift child nodes parented to this subgraph.
  for (const [nodeId, node] of nodes) {
    if (node.parent !== subgraphId) continue
    if (node.position) {
      nodes.set(nodeId, {
        ...node,
        position: { x: node.position.x + dx, y: node.position.y + dy },
      })
    }
  }
  // Shift their ports (port id format is `nodeId:portKey`).
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

  // Recurse into nested subgraphs.
  for (const [innerId, innerSg] of subgraphs) {
    if (innerSg.parent === subgraphId) {
      shiftSubgraphSubtree(innerId, dx, dy, nodes, ports, subgraphs)
    }
  }
}
