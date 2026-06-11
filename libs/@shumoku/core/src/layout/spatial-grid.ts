// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Uniform-grid candidate-pair index for geometric proximity queries.
 *
 * EXACT-equivalence accelerator: callers re-test every candidate with the
 * precise predicate they used before; the grid only prunes pairs whose
 * (inflated) bounding boxes cannot overlap. Two geometries that satisfy any
 * overlap/intersection/within-distance-d predicate have overlapping bounding
 * boxes (inflated by d/2 each), and overlapping bounding boxes always share
 * at least one grid cell — so the candidate set is a superset of every true
 * pair and the caller's counts come out identical to the O(n²) scan.
 *
 * Cell-key hash collisions merely merge unrelated cells (extra candidates,
 * never missing ones), so correctness is collision-proof.
 */
export class BBoxGrid {
  private cells = new Map<number, number[]>()
  private readonly cellSize: number

  constructor(cellSize: number) {
    this.cellSize = Math.max(1, cellSize)
  }

  private cellKey(cx: number, cy: number): number {
    // Bounded coordinates (layout space / cellSize) keep this collision-free
    // in practice; a collision would only add candidates.
    return cx * 131072 + cy
  }

  /** Register item `idx` as covering the bbox [x1,y1]-[x2,y2]. */
  insert(idx: number, x1: number, y1: number, x2: number, y2: number): void {
    const cx1 = Math.floor(Math.min(x1, x2) / this.cellSize)
    const cy1 = Math.floor(Math.min(y1, y2) / this.cellSize)
    const cx2 = Math.floor(Math.max(x1, x2) / this.cellSize)
    const cy2 = Math.floor(Math.max(y1, y2) / this.cellSize)
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        const key = this.cellKey(cx, cy)
        const list = this.cells.get(key)
        if (list) list.push(idx)
        else this.cells.set(key, [idx])
      }
    }
  }

  /**
   * Invoke `cb` exactly once per unordered candidate pair (i < j) that
   * shares at least one cell.
   */
  forEachCandidatePair(cb: (i: number, j: number) => void): void {
    const seen = new Set<number>()
    for (const list of this.cells.values()) {
      for (let a = 0; a < list.length; a++) {
        const ia = list[a]
        if (ia === undefined) continue
        for (let b = a + 1; b < list.length; b++) {
          const ib = list[b]
          if (ib === undefined || ia === ib) continue
          const i = ia < ib ? ia : ib
          const j = ia < ib ? ib : ia
          // Items stay well under 2^21, so the packed key is collision-free.
          const key = i * 2097152 + j
          if (seen.has(key)) continue
          seen.add(key)
          cb(i, j)
        }
      }
    }
  }

  /**
   * Invoke `cb` once per registered item whose cells overlap the bbox
   * (deduped per query).
   */
  query(x1: number, y1: number, x2: number, y2: number, cb: (idx: number) => void): void {
    const cx1 = Math.floor(Math.min(x1, x2) / this.cellSize)
    const cy1 = Math.floor(Math.min(y1, y2) / this.cellSize)
    const cx2 = Math.floor(Math.max(x1, x2) / this.cellSize)
    const cy2 = Math.floor(Math.max(y1, y2) / this.cellSize)
    const seen = new Set<number>()
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        const list = this.cells.get(this.cellKey(cx, cy))
        if (!list) continue
        for (const idx of list) {
          if (seen.has(idx)) continue
          seen.add(idx)
          cb(idx)
        }
      }
    }
  }
}
