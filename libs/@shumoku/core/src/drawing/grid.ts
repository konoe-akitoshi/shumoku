// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Box } from './metrics.js'
import { type PortPlan, round } from './ports.js'
import { type FrameId, frameKey, type Geometry, type Problem, ROOT } from './problem.js'

/** Where lines may run: the coordinates they may turn at, and which steps are shut or in a frame. */
export interface Grid {
  xs: number[]
  ys: number[]
  nx: number
  ny: number
  /** A step from `(ix, iy)` to `(ix + 1, iy)` is at index `iy * nx + ix`; vertical likewise. */
  blockedH: Uint8Array
  blockedV: Uint8Array
  /** Bit `i` of chunk `i >> 5` is set for a step inside the `i`th frame. */
  frameH: Uint32Array[]
  frameV: Uint32Array[]
  frames: FrameId[]
}

const EPS = 1e-3

function lowerBound(a: readonly number[], v: number): number {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((a[mid] ?? 0) < v) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The grid the lines are routed on: the edges of every box that must be avoided (kept a pitch
 * clear), the ports and where lines first turn, and the middle of each gap between them, which
 * is where a corridor's lines run. A card is an obstacle; a frame is not, but a step inside
 * one is marked so that a line that has no business there can be charged for it.
 */
export function buildGrid(problem: Problem, geometry: Geometry, plans: readonly PortPlan[]): Grid {
  const { pitch } = problem.metrics
  const obstacles: Box[] = []
  for (const item of problem.items) {
    const boxes =
      item.kind === 'unit'
        ? (item.members ?? []).map((m) => geometry.boxes.get(m.node.id))
        : [geometry.boxes.get(item.id)]
    for (const b of boxes) {
      if (b)
        obstacles.push({
          x: b.x - pitch,
          y: b.y - pitch,
          width: b.width + 2 * pitch,
          height: b.height + 2 * pitch,
        })
    }
  }

  const axis = (
    low: (b: Box) => number,
    high: (b: Box) => number,
    ports: (p: PortPlan) => number[],
  ) => {
    const raw = new Set<number>()
    for (const b of obstacles) {
      raw.add(round(low(b)))
      raw.add(round(high(b)))
    }
    for (const p of plans) for (const v of ports(p)) raw.add(round(v))
    const base = [...raw].sort((a, b) => a - b)
    const all = new Set(base)
    for (const [i, v] of base.entries()) {
      const next = base[i + 1]
      if (next !== undefined && next - v >= 2 * pitch) all.add(round((v + next) / 2))
    }
    return [...all].sort((a, b) => a - b)
  }
  const xs = axis(
    (b) => b.x,
    (b) => b.x + b.width,
    (p) => [p.at.x, p.lead.x],
  )
  const ys = axis(
    (b) => b.y,
    (b) => b.y + b.height,
    (p) => [p.at.y, p.lead.y],
  )
  const nx = xs.length
  const ny = ys.length

  const blockedH = new Uint8Array(nx * ny)
  const blockedV = new Uint8Array(nx * ny)
  /** Calls `mark` for every step strictly inside the box, horizontal and vertical. */
  const eachStep = (box: Box, mark: (h: number | undefined, v: number | undefined) => void) => {
    const x0 = box.x
    const x1 = box.x + box.width
    const y0 = box.y
    const y1 = box.y + box.height
    for (let iy = lowerBound(ys, y0 + EPS); iy < ny && (ys[iy] ?? 0) < y1 - EPS; iy++) {
      for (let ix = lowerBound(xs, x0 - EPS); ix + 1 < nx && (xs[ix + 1] ?? 0) <= x1 + EPS; ix++) {
        mark(iy * nx + ix, undefined)
      }
    }
    for (let ix = lowerBound(xs, x0 + EPS); ix < nx && (xs[ix] ?? 0) < x1 - EPS; ix++) {
      for (let iy = lowerBound(ys, y0 - EPS); iy + 1 < ny && (ys[iy + 1] ?? 0) <= y1 + EPS; iy++) {
        mark(undefined, iy * nx + ix)
      }
    }
  }
  for (const b of obstacles) {
    eachStep(b, (h, v) => {
      if (h !== undefined) blockedH[h] = 1
      if (v !== undefined) blockedV[v] = 1
    })
  }

  const frames = problem.frames.filter((f) => f.id !== ROOT).map((f) => f.id)
  const chunks = Math.ceil(frames.length / 32)
  const frameH = Array.from({ length: chunks }, () => new Uint32Array(nx * ny))
  const frameV = Array.from({ length: chunks }, () => new Uint32Array(nx * ny))
  for (const [i, id] of frames.entries()) {
    const box = geometry.boxes.get(frameKey(id))
    const h = frameH[i >> 5]
    const v = frameV[i >> 5]
    if (!box || !h || !v) continue
    const bit = 1 << (i & 31)
    eachStep(box, (hi, vi) => {
      if (hi !== undefined) h[hi] = (h[hi] ?? 0) | bit
      if (vi !== undefined) v[vi] = (v[vi] ?? 0) | bit
    })
  }
  return { xs, ys, nx, ny, blockedH, blockedV, frameH, frameV, frames }
}
